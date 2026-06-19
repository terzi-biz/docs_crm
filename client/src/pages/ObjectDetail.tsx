import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import EstimateReview from "./EstimateReview";

const STATUSES = [
  "Новий",
  "Документи підготовлені",
  "Рахунок виставлений",
  "Договір підписаний",
  "Роботи виконані",
  "Закритий",
];

const DOC_LABELS: Record<string, string> = {
  contract: "Договір",
  estimate: "Кошторис",
  invoice: "Рахунок",
};

export default function ObjectDetail() {
  const { id } = useParams();
  const [obj, setObj] = useState<any>(null);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const data = await api.getObject(id!);
    setObj(data);
  }

  useEffect(() => {
    load();
  }, [id]);

  if (!obj) return <div className="p-6">Завантаження...</div>;

  const latestEstimate = obj.estimates[0];

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setBusyAction("upload");
    try {
      await api.uploadEstimate(id!, file);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyAction("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function runAction(action: () => Promise<any>, key: string) {
    setError("");
    setBusyAction(key);
    try {
      await action();
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyAction("");
    }
  }

  async function changeStatus(status: string) {
    await runAction(() => api.setStatus(id!, status), "status");
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">
            Об'єкт №{obj.contract_number} — {obj.client_name}
          </h1>
          <div className="flex gap-3">
            <Link to={`/objects/${id}/edit`} className="text-purple-600 hover:underline text-sm">
              Редагувати
            </Link>
            <Link to="/" className="text-purple-600 hover:underline text-sm">
              ← До списку
            </Link>
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded mb-4">{error}</div>}

        <div className="bg-white rounded shadow p-5 mb-6 grid grid-cols-2 gap-3 text-sm">
          <Info label="Сделка KeyCRM" value={obj.keycrm_deal_number} />
          <Info label="Дата договору" value={obj.contract_date} />
          <Info label="Адреса об'єкту" value={obj.object_address} />
          <Info label="Площа" value={obj.object_area ? `${obj.object_area} м²` : "—"} />
          <Info label="Вид робіт" value={obj.work_type || "—"} />
          <Info label="Товщина стяжки" value={obj.screed_thickness || "—"} />
          <Info label="Строк виконання" value={obj.work_duration || "—"} />
          <Info label="Менеджер" value={obj.manager_name || "—"} />
          <Info label="Телефон" value={obj.client_phone || "—"} />
          <Info label="Email" value={obj.client_email || "—"} />
          <Info
            label="Оплата"
            value={
              obj.payment_mode === "full"
                ? `100% — ${Number(obj.full_payment_amount).toLocaleString("uk-UA")} грн`
                : `Аванс ${Number(obj.advance_payment).toLocaleString("uk-UA")} + Остаток ${Number(
                    obj.final_payment
                  ).toLocaleString("uk-UA")} грн`
            }
          />
          <Info label="Загальна сума" value={`${Number(obj.total_amount).toLocaleString("uk-UA")} грн`} />

          <div className="col-span-2 flex items-center gap-2 mt-2">
            <span className="text-gray-500">Статус:</span>
            <select
              className="border rounded px-2 py-1"
              value={obj.status}
              onChange={(e) => changeStatus(e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded shadow p-5 mb-6">
          <h2 className="font-medium mb-3">Кошторис</h2>
          {!latestEstimate ? (
            <div>
              <p className="text-gray-500 text-sm mb-2">Кошторис ще не завантажено (XLSX або PDF).</p>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.pdf" onChange={uploadFile} />
              {busyAction === "upload" && <span className="ml-2 text-sm text-gray-500">Обробка...</span>}
            </div>
          ) : latestEstimate.status === "confirmed" ? (
            <div className="text-sm">
              <p className="text-green-700 mb-2">Кошторис підтверджено. Разом: {Number(latestEstimate.grand_total).toLocaleString("uk-UA")} грн</p>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.pdf" onChange={uploadFile} />
              <span className="text-gray-400 text-xs ml-2">(завантажте новий файл для перегенерації)</span>
            </div>
          ) : (
            <EstimateReview estimate={latestEstimate} onSaved={load} />
          )}
        </div>

        <div className="bg-white rounded shadow p-5 mb-6">
          <h2 className="font-medium mb-3">Генерація документів</h2>
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              onClick={() => runAction(() => api.generateContract(id!), "contract")}
              disabled={!!busyAction}
              className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
            >
              Створити договір
            </button>
            <button
              onClick={() => runAction(() => api.generateEstimateDoc(id!), "estimate")}
              disabled={!!busyAction || latestEstimate?.status !== "confirmed"}
              className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
            >
              Створити кошторис
            </button>
            {obj.payment_mode === "advance_final" ? (
              <>
                <button
                  onClick={() => runAction(() => api.generateInvoice(id!, "advance"), "invoice_a")}
                  disabled={!!busyAction}
                  className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
                >
                  Рахунок на аванс
                </button>
                <button
                  onClick={() => runAction(() => api.generateInvoice(id!, "final"), "invoice_f")}
                  disabled={!!busyAction}
                  className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
                >
                  Рахунок на остаток
                </button>
              </>
            ) : (
              <button
                onClick={() => runAction(() => api.generateInvoice(id!, "full"), "invoice_full")}
                disabled={!!busyAction}
                className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
              >
                Рахунок на 100%
              </button>
            )}
            <button
              onClick={() => runAction(() => api.generatePackage(id!), "package")}
              disabled={!!busyAction || latestEstimate?.status !== "confirmed"}
              className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40"
            >
              {busyAction === "package" ? "Створення..." : "Створити весь пакет"}
            </button>
          </div>
          {latestEstimate?.status !== "confirmed" && (
            <p className="text-xs text-gray-400">
              Кошторис та повний пакет потребують підтвердженого кошторису.
            </p>
          )}
        </div>

        <div className="bg-white rounded shadow p-5">
          <h2 className="font-medium mb-3">Історія документів</h2>
          {obj.documents.length === 0 ? (
            <p className="text-gray-400 text-sm">Документи ще не створювались.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="px-2 py-1">Тип</th>
                  <th className="px-2 py-1">Версія</th>
                  <th className="px-2 py-1">Створено</th>
                  <th className="px-2 py-1">Файли</th>
                </tr>
              </thead>
              <tbody>
                {obj.documents.map((d: any) => (
                  <tr key={d.id} className="border-t">
                    <td className="px-2 py-1">
                      {DOC_LABELS[d.type]}
                      {d.invoice_kind ? ` (${d.invoice_kind})` : ""}
                    </td>
                    <td className="px-2 py-1">v{d.version}</td>
                    <td className="px-2 py-1">{d.created_at}</td>
                    <td className="px-2 py-1 flex gap-3">
                      {d.docx_path && (
                        <a className="text-purple-600 hover:underline" href={api.downloadUrl(d.id, "docx")}>
                          DOCX
                        </a>
                      )}
                      {d.pdf_path && (
                        <a className="text-purple-600 hover:underline" href={api.downloadUrl(d.id, "pdf")}>
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-gray-400 text-xs">{label}</div>
      <div>{value}</div>
    </div>
  );
}
