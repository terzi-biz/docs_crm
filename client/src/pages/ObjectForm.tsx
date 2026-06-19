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

export default function ObjectForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...emptyForm });
  const [workTypes, setWorkTypes] = useState<any[]>([]);
  const [newWorkType, setNewWorkType] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.workTypes().then(setWorkTypes);
    if (isEdit) {
      api.getObject(id!).then((o) =>
        setForm({
          ...emptyForm,
          ...o,
          object_area: String(o.object_area ?? ""),
          advance_payment: String(o.advance_payment ?? ""),
          final_payment: String(o.final_payment ?? ""),
          full_payment_amount: String(o.full_payment_amount ?? ""),
        })
      );
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
    setBusy(true);
    try {
      const payload = {
        ...form,
        object_area: form.object_area ? Number(form.object_area) : null,
        advance_payment: form.advance_payment ? Number(form.advance_payment) : 0,
        final_payment: form.final_payment ? Number(form.final_payment) : 0,
        full_payment_amount: form.full_payment_amount ? Number(form.full_payment_amount) : 0,
      };
      const saved = isEdit ? await api.updateObject(id!, payload) : await api.createObject(payload);
      navigate(`/objects/${saved.id}`);
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
          <Link to="/" className="text-purple-600 hover:underline text-sm">
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
          <Field label="Дата договору *">
            <input
              type="date"
              className="input"
              value={form.contract_date}
              onChange={(e) => update("contract_date", e.target.value)}
              required
            />
          </Field>
          <Field label="ПІБ клієнта *">
            <input
              className="input"
              value={form.client_name}
              onChange={(e) => update("client_name", e.target.value)}
              required
            />
          </Field>
          <Field label="Телефон клієнта">
            <input
              className="input"
              value={form.client_phone}
              onChange={(e) => update("client_phone", e.target.value)}
            />
          </Field>
          <Field label="Email клієнта">
            <input
              className="input"
              value={form.client_email}
              onChange={(e) => update("client_email", e.target.value)}
            />
          </Field>
          <Field label="Паспорт клієнта">
            <input
              className="input"
              value={form.client_passport}
              onChange={(e) => update("client_passport", e.target.value)}
            />
          </Field>
          <Field label="Адреса об'єкту *" full>
            <input
              className="input"
              value={form.object_address}
              onChange={(e) => update("object_address", e.target.value)}
              required
            />
          </Field>
          <Field label="Площа (м²)">
            <input
              type="number"
              className="input"
              value={form.object_area}
              onChange={(e) => update("object_area", e.target.value)}
            />
          </Field>
          <Field label="Вид робіт">
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
          <Field label="Менеджер">
            <input
              className="input"
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
              className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
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
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  required?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
