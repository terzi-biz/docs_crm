import { useState } from "react";
import { api } from "../api";

type Item = { position: number; name: string; unit: string; quantity: number; price: number; sum: number };

export default function EstimateReview({
  estimate,
  onSaved,
}: {
  estimate: any;
  onSaved: (e: any) => void;
}) {
  const [materials, setMaterials] = useState<Item[]>(JSON.parse(estimate.materials_json));
  const [works, setWorks] = useState<Item[]>(JSON.parse(estimate.works_json));
  const [busy, setBusy] = useState(false);

  function updateItem(list: Item[], setList: (v: Item[]) => void, idx: number, field: keyof Item, value: string) {
    const next = [...list];
    const item = { ...next[idx], [field]: field === "name" || field === "unit" ? value : Number(value) };
    if (field === "quantity" || field === "price") {
      item.sum = Math.round(item.quantity * item.price * 100) / 100;
    }
    next[idx] = item;
    setList(next);
  }

  function addRow(list: Item[], setList: (v: Item[]) => void) {
    setList([...list, { position: list.length + 1, name: "", unit: "", quantity: 0, price: 0, sum: 0 }]);
  }

  function removeRow(list: Item[], setList: (v: Item[]) => void, idx: number) {
    setList(list.filter((_, i) => i !== idx));
  }

  const materialsTotal = materials.reduce((s, m) => s + Number(m.sum || 0), 0);
  const worksTotal = works.reduce((s, w) => s + Number(w.sum || 0), 0);

  async function confirm() {
    setBusy(true);
    try {
      const updated = await api.updateEstimate(estimate.id, { materials, works, status: "confirmed" });
      onSaved(updated);
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    setBusy(true);
    try {
      const updated = await api.updateEstimate(estimate.id, { materials, works, status: "draft" });
      onSaved(updated);
    } finally {
      setBusy(false);
    }
  }

  function Table({ title, list, setList }: { title: string; list: Item[]; setList: (v: Item[]) => void }) {
    return (
      <div className="mb-4">
        <h4 className="font-medium mb-1">{title}</h4>
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">Назва</th>
              <th className="border px-2 py-1">Од.</th>
              <th className="border px-2 py-1">К-ть</th>
              <th className="border px-2 py-1">Ціна</th>
              <th className="border px-2 py-1">Сума</th>
              <th className="border px-2 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((item, idx) => (
              <tr key={idx}>
                <td className="border px-1">
                  <input
                    className="w-full px-1"
                    value={item.name}
                    onChange={(e) => updateItem(list, setList, idx, "name", e.target.value)}
                  />
                </td>
                <td className="border px-1 w-16">
                  <input
                    className="w-full px-1"
                    value={item.unit}
                    onChange={(e) => updateItem(list, setList, idx, "unit", e.target.value)}
                  />
                </td>
                <td className="border px-1 w-20">
                  <input
                    type="number"
                    className="w-full px-1"
                    value={item.quantity}
                    onChange={(e) => updateItem(list, setList, idx, "quantity", e.target.value)}
                  />
                </td>
                <td className="border px-1 w-24">
                  <input
                    type="number"
                    className="w-full px-1"
                    value={item.price}
                    onChange={(e) => updateItem(list, setList, idx, "price", e.target.value)}
                  />
                </td>
                <td className="border px-1 w-24 text-right pr-2">{item.sum.toFixed(2)}</td>
                <td className="border px-1 text-center">
                  <button onClick={() => removeRow(list, setList, idx)} className="text-red-500">
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => addRow(list, setList)} className="text-purple-600 text-sm mt-1">
          + Додати рядок
        </button>
      </div>
    );
  }

  return (
    <div>
      <Table title="Матеріали" list={materials} setList={setMaterials} />
      <Table title="Роботи" list={works} setList={setWorks} />
      <div className="text-right font-medium mb-3">
        Разом: {(materialsTotal + worksTotal).toLocaleString("uk-UA")} грн
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={saveDraft} disabled={busy} className="px-4 py-2 rounded bg-gray-100">
          Зберегти чернетку
        </button>
        <button
          onClick={confirm}
          disabled={busy}
          className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700"
        >
          Підтвердити кошторис
        </button>
      </div>
    </div>
  );
}
