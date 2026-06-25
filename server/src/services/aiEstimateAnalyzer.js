import { z } from "zod";

const LineItemSchema = z.object({
  position: z.number().optional().default(0),
  name: z.string().min(1),
  unit: z.string().optional().default(""),
  quantity: z.number().nonnegative(),
  price: z.number().nonnegative(),
  sum: z.number().nonnegative(),
  category: z.enum(["materials", "works"]),
  confidence: z.number().min(0).max(1).optional().default(0.5),
  source_text: z.string().optional().default(""),
});

const AiResultSchema = z.object({
  materials: z.array(LineItemSchema).default([]),
  works: z.array(LineItemSchema).default([]),
  materials_total: z.number().optional().default(0),
  works_total: z.number().optional().default(0),
  grand_total: z.number().optional().default(0),
  warnings: z.array(z.string()).optional().default([]),
  parser_confidence: z.number().min(0).max(1).optional().default(0.5),
});

export function isAiEnabled() {
  return String(process.env.AI_ENABLED).toLowerCase() === "true";
}

export function aiConfigError() {
  if (!isAiEnabled()) return null;
  const provider = process.env.AI_PROVIDER || "";
  if (provider === "anthropic" && !process.env.ANTHROPIC_API_KEY) {
    return "AI-анализ включён, но ANTHROPIC_API_KEY не настроен.";
  }
  if (provider === "openai" && !process.env.OPENAI_API_KEY) {
    return "AI-анализ включён, но OPENAI_API_KEY не настроен.";
  }
  if (provider !== "openai" && provider !== "anthropic") {
    return "AI-анализ включён, но AI_PROVIDER не настроен (openai или anthropic).";
  }
  return null;
}

const SYSTEM_PROMPT = `Ти — асистент, що структурує будівельні кошториси.
Тобі дають сирий текст або рядки таблиці кошторису (можуть бути різного формату — від двох різних прорабів).
Поверни СУВОРО JSON без жодного додаткового тексту, у форматі:
{
  "materials": [{"position":1,"name":"...","unit":"...","quantity":0,"price":0,"sum":0,"category":"materials","confidence":0.0,"source_text":"..."}],
  "works": [{"position":1,"name":"...","unit":"...","quantity":0,"price":0,"sum":0,"category":"works","confidence":0.0,"source_text":"..."}],
  "materials_total": 0,
  "works_total": 0,
  "grand_total": 0,
  "warnings": ["..."],
  "parser_confidence": 0.0
}
ПРАВИЛА:
- НЕ вигадуй ціни чи кількості, яких немає в тексті.
- НЕ змінюй сенс рядків кошторису.
- Лише структуруй наявні дані з тексту.
- Якщо sum відсутня, обчисли як quantity*price і додай попередження ("warnings").
- Якщо рядок неповний (немає ціни чи кількості) — додай попередження та постав низьку confidence.
- "source_text" — оригінальний рядок із вхідного тексту, з якого взято дані.`;

async function callOpenAi(rawText) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: rawText.slice(0, 20000) },
      ],
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callAnthropic(rawText) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.AI_MODEL || "claude-sonnet-4-6";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: rawText.slice(0, 20000) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.content[0].text;
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI не повернув JSON");
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Sends raw estimate text to the configured AI provider and returns a
 * validated, normalized result. Throws if AI is disabled/misconfigured or
 * the model's response doesn't match the expected schema.
 */
export async function analyzeWithAi(rawText) {
  const configError = aiConfigError();
  if (configError) throw new Error(configError);

  const provider = process.env.AI_PROVIDER;
  const raw = provider === "anthropic" ? await callAnthropic(rawText) : await callOpenAi(rawText);
  const json = extractJson(raw);
  const parsed = AiResultSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("AI повернув дані у невірному форматі: " + parsed.error.message);
  }
  return normalizeAndRecalculate(parsed.data);
}

/** Recompute sums/totals and flag mismatches, regardless of where the data came from. */
export function normalizeAndRecalculate(result) {
  const warnings = [...(result.warnings || [])];

  function normalizeItems(items, category) {
    return items
      .filter((i) => i.name && i.name.trim())
      .map((item, idx) => {
        const quantity = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        let sum = Number(item.sum) || 0;
        const expected = Math.round(quantity * price * 100) / 100;
        if (sum === 0 && expected > 0) {
          sum = expected;
        } else if (Math.abs(sum - expected) > Math.max(1, expected * 0.02)) {
          warnings.push(
            `Рядок "${item.name}": сума (${sum}) не відповідає кількість×ціна (${expected}). Перевірте вручну.`
          );
        }
        return {
          position: idx + 1,
          name: String(item.name).trim(),
          unit: item.unit || "",
          quantity: Math.round(quantity * 100) / 100,
          price: Math.round(price * 100) / 100,
          sum: Math.round(sum * 100) / 100,
          category,
          confidence: item.confidence ?? 0.5,
          source_text: item.source_text || "",
        };
      });
  }

  const materials = normalizeItems(result.materials || [], "materials");
  const works = normalizeItems(result.works || [], "works");
  const materials_total = Math.round(materials.reduce((s, m) => s + m.sum, 0) * 100) / 100;
  const works_total = Math.round(works.reduce((s, w) => s + w.sum, 0) * 100) / 100;

  if (materials.length === 0 && works.length === 0) {
    warnings.push("Не знайдено жодного рядка матеріалів або робіт. Потрібна ручна перевірка.");
  }

  return {
    materials,
    works,
    materials_total,
    works_total,
    grand_total: Math.round((materials_total + works_total) * 100) / 100,
    warnings,
    parser_confidence: result.parser_confidence ?? 0.5,
  };
}
