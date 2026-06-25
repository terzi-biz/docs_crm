import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api } from "../api";

const emptyForm = {
  keycrm_deal_number: "",
  contract_date: new Date().toISOString().slice(0, 10),
  client_name: "",
  client_phone: "",
  client_email: "",
  client_passport: "",
  object_address: "",
  object_area: "",
  work_type: "",
  screed_thickness: "",
  work_duration: "",
  manager_name: "",
  notes: "",
  payment_mode: "advance_final" as "advance_final" | "full",
  advance_payment: "",
  final_payment: "",
  full_payment_amount: "",
};

const GROUP_LABELS: Record<string, string> = {
  client: "Клієнт",
  object: "Об'єкт",
  payment: "Оплата",
  document: "Документи",
  estimate: "Кошторис",
  custom: "Додаткові поля",
};

const BAD_VALUES = ["test", "тест", "1", "2", "asdf", "qwerty"];

function validateForm(form: typeof emptyForm) {
  const errors: Record<string, string> = {};
  const name = form.client_name.trim();
  if (name.length < 3 || BAD_VALUES.includes(name.toLowerCase())) {
    errors.client_name = "Вкажіть реальне ПІБ клієнта (мінімум 3 символи)";
  }
  if (form.client_phone && !/^\+?\d[\d\s()-]{6,}$/.test(form.client_phone.trim())) {
    errors.client_phone = "Невірний формат телефону, напр. +380501234567";
  }
  if (form.client_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.client_email.trim())) {
    errors.client_email = "Невірний формат email";
  }
  if (form.object_address.trim().length < 5) {
    errors.object_address = "Вкажіть повну адресу об'єкту (мінімум 5 символів)";
  }
  if (form.object_area && (Number(form.object_area) <= 0 || Number.isNaN(Number(form.object_area)))) {
    errors.object_area = "Площа повинна бути числом більше нуля";
  }
  if (!form.contract_date) {
    errors.contract_date = "Вкажіть дату договору";
  }
  if (!form.work_type) {
    errors.work_type = "Вкажіть вид робіт";
  }
  if (form.manager_name && form.manager_name.trim().length < 2) {
    errors.manager_name = "Вкажіть ім'я менеджера (мінімум 2 символи)";
  }
  const totalCheck =
    form.payment_mode === "full"
      ? Number(form.full_payment_amount) || 0
      : (Number(form.advance_payment) || 0) + (Number(form.final_payment) || 0);
  if (totalCheck < 0) {
    errors.total_amount = "Сума не може бути від'ємною";
  }
  return errors;
}

export default function ObjectForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...emptyForm });
  const [workTypes, setWorkTypes] = useState<any[]>([]);
  const [newWorkType, setNewWorkType] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  useEffect(() => {
    api.workTypes().then(setWorkTypes);
    api.listCustomFields().then((fields: any[]) => setCustomFields(fields.filter((f) => f.is_active)));
    if (isEdit) {
      api.getObject(id!).then((o) => {
        setForm({
          ...emptyForm,
          ...o,
          object_area: String(o.object_area ?? ""),
          advance_payment: String(o.advance_payment ?? ""),
          final_payment: String(o.final_payment ?? ""),
          full_payment_amount: String(o.full_payment_amount ?? ""),
        });
        setCustomValues(o.custom_fields || {});
      });
    }
  }, [id]);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function addWorkType() {
    if (!newWorkType.trim()) return;
    const wt = await api.addWorkType(newWorkType.trim());
    setWorkTypes((prev) => [...prev, wt]);
    update("work_type", wt.name);
    setNewWorkType("");
  }

  const totalAmount =
    form.payment_mode === "full"
      ? Number(form.full_payment_amount) || 0
      : (Number(form.advance_payment) || 0) + (Number(form.final_payment) || 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const errors = validateForm(form);
    for (const f of customFields) {
      if (f.required && !customValues[f.key]?.trim()) {
        errors[`custom_${f.key}`] = `Заповніть поле "${f.label}"`;
      }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Виправте помилки у формі перед збереженням.");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        ...form,
        object_area: form.object_area ? Number(form.object_area) : null,
        advance_payment: form.advance_payment ? Number(form.advance_payment) : 0,
        final_payment: form.final_payment ? Number(form.final_payment) : 0,
        full_payment_amount: form.full_payment_amount ? Number(form.full_payment_amount) : 0,
        custom_fields: customValues,
      };
      const saved = isEdit ? await api.updateObject(id!, payload) : await api.createObject(payload);
      navigate(`/objects/${saved.id}`, { state: { toast: "Дані об'єкту оновлено" } });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">{isEdit ? "Редагувати об'єкт" : "Новий об'єкт"}</h1>
          <Link to="/" className="text-[#0b1830] font-medium hover:underline text-sm">
            ← До списку
          </Link>
        </div>

        {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
          <Field label="Номер сделки KeyCRM *" required>
            <input
              className="input"
              value={form.keycrm_deal_number}
              onChange={(e) => update("keycrm_deal_number", e.target.value)}
              required
            />
          </Field>
          <Field label="Дата договору *" error={fieldErrors.contract_date}>
            <input
              type="date"
              className="input"
              value={form.contract_date}
              onChange={(e) => update("contract_date", e.target.value)}
              required
            />
          </Field>
          <Field label="ПІБ клієнта *" error={fieldErrors.client_name}>
            <input
              className="input"
              placeholder="напр. Іваненко Іван Іванович"
              value={form.client_name}
              onChange={(e) => update("client_name", e.target.value)}
              required
            />
          </Field>
          <Field label="Телефон клієнта" error={fieldErrors.client_phone}>
            <input
              className="input"
              placeholder="напр. +380501234567"
              value={form.client_phone}
              onChange={(e) => update("client_phone", e.target.value)}
            />
          </Field>
          <Field label="Email клієнта" error={fieldErrors.client_email}>
            <input
              className="input"
              placeholder="напр. client@example.com"
              value={form.client_email}
              onChange={(e) => update("client_email", e.target.value)}
            />
          </Field>
          <Field label="Паспорт клієнта">
            <input
              className="input"
              placeholder="напр. СН123456"
              value={form.client_passport}
              onChange={(e) => update("client_passport", e.target.value)}
            />
          </Field>
          <Field label="Адреса об'єкту *" full error={fieldErrors.object_address}>
            <input
              className="input"
              placeholder="напр. м. Київ, вул. Хрещатик, 1, кв. 5"
              value={form.object_address}
              onChange={(e) => update("object_address", e.target.value)}
              required
            />
          </Field>
          <Field label="Площа (м²)" error={fieldErrors.object_area}>
            <input
              type="number"
              className="input"
              placeholder="напр. 120"
              value={form.object_area}
              onChange={(e) => update("object_area", e.target.value)}
            />
          </Field>
          <Field label="Вид робіт" error={fieldErrors.work_type}>
            <div className="flex gap-2">
              <select
                className="input"
                value={form.work_type}
                onChange={(e) => update("work_type", e.target.value)}
              >
                <option value="">—</option>
                {workTypes.map((w) => (
                  <option key={w.id} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-1">
              <input
                className="input flex-1"
                placeholder="Додати новий вид робіт"
                value={newWorkType}
                onChange={(e) => setNewWorkType(e.target.value)}
              />
              <button type="button" onClick={addWorkType} className="bg-gray-200 px-3 rounded text-sm">
                +
              </button>
            </div>
          </Field>
          <Field label="Товщина стяжки">
            <input
              className="input"
              placeholder="напр. 70 мм"
              value={form.screed_thickness}
              onChange={(e) => update("screed_thickness", e.target.value)}
            />
          </Field>
          <Field label="Строк виконання робіт">
            <input
              className="input"
              placeholder="напр. 3-5 днів"
              value={form.work_duration}
              onChange={(e) => update("work_duration", e.target.value)}
            />
          </Field>
          <Field label="Менеджер" error={fieldErrors.manager_name}>
            <input
              className="input"
              placeholder="напр. Петренко П.П."
              value={form.manager_name}
              onChange={(e) => update("manager_name", e.target.value)}
            />
          </Field>
          <Field label="Примітки" full>
            <textarea
              className="input"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </Field>

          {customFields.length > 0 && (
            <div className="col-span-2 border-t pt-4 mt-2">
              <h3 className="font-medium mb-2">Додаткові поля</h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(
                  customFields.reduce((acc: Record<string, any[]>, f) => {
                    (acc[f.group_name] ||= []).push(f);
                    return acc;
                  }, {})
                ).map(([group, fields]) => (
                  <div key={group} className="col-span-2">
                    <div className="text-xs uppercase text-gray-400 mb-1">{GROUP_LABELS[group] || group}</div>
                    <div className="grid grid-cols-2 gap-4">
                      {fields.map((f) => (
                        <Field
                          key={f.key}
                          label={`${f.label}${f.required ? " *" : ""}`}
                          error={fieldErrors[`custom_${f.key}`]}
                          help={f.help_text}
                        >
                          {f.field_type === "textarea" ? (
                            <textarea
                              className="input"
                              placeholder={f.placeholder || ""}
                              value={customValues[f.key] || ""}
                              onChange={(e) => setCustomValues((v) => ({ ...v, [f.key]: e.target.value }))}
                            />
                          ) : f.field_type === "checkbox" ? (
                            <input
                              type="checkbox"
                              checked={customValues[f.key] === "true"}
                              onChange={(e) =>
                                setCustomValues((v) => ({ ...v, [f.key]: e.target.checked ? "true" : "false" }))
                              }
                            />
                          ) : (
                            <input
                              type={f.field_type === "number" ? "number" : f.field_type === "date" ? "date" : "text"}
                              className="input"
                              placeholder={f.placeholder || ""}
                              value={customValues[f.key] || ""}
                              onChange={(e) => setCustomValues((v) => ({ ...v, [f.key]: e.target.value }))}
                            />
                          )}
                        </Field>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="col-span-2 border-t pt-4 mt-2">
            <h3 className="font-medium mb-2">Оплата</h3>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={form.payment_mode === "advance_final"}
                  onChange={() => update("payment_mode", "advance_final")}
                />
                Аванс + остаток
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={form.payment_mode === "full"}
                  onChange={() => update("payment_mode", "full")}
                />
                100% оплата
              </label>
            </div>

            {form.payment_mode === "advance_final" ? (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Авансовий платіж, грн">
                  <input
                    type="number"
                    className="input"
                    value={form.advance_payment}
                    onChange={(e) => update("advance_payment", e.target.value)}
                  />
                </Field>
                <Field label="Оплата остатку, грн">
                  <input
                    type="number"
                    className="input"
                    value={form.final_payment}
                    onChange={(e) => update("final_payment", e.target.value)}
                  />
                </Field>
              </div>
            ) : (
              <Field label="Повна сума оплати, грн">
                <input
                  type="number"
                  className="input"
                  value={form.full_payment_amount}
                  onChange={(e) => update("full_payment_amount", e.target.value)}
                />
              </Field>
            )}

            <div className="mt-3 text-sm text-gray-600">
              Загальна сума договору: <b>{totalAmount.toLocaleString("uk-UA")} грн</b>
            </div>
          </div>

          <div className="col-span-2 flex justify-end gap-3 mt-4">
            <Link to="/" className="px-4 py-2 rounded bg-gray-100">
              Відмінити
            </Link>
            <button
              disabled={busy}
              className="px-4 py-2 rounded btn-navy disabled:opacity-50"
            >
              {busy ? "Збереження..." : "Зберегти"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
  error,
  help,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  required?: boolean;
  error?: string;
  help?: string;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      {children}
      {help && !error && <div className="text-xs text-gray-400 mt-1">{help}</div>}
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}
