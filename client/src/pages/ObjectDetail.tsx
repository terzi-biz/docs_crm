import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api } from "../api";
import EstimateBlock from "./EstimateReview";
import StatusStepper, { STATUSES } from "../components/StatusStepper";

const DOC_LABELS: Record<string, string> = {
  contract: "Договір",
  estimate: "Кошторис",
  invoice: "Рахунок",
  act: "Акт",
  commercial_offer: "Комерційна пропозиція",
};

const INVOICE_KIND_LABELS: Record<string, string> = {
  advance: "аванс",
  final: "остаток",
  full: "100%",
};

export default function ObjectDetail() {
  const { id } = useParams();
  const location = useLocation();
  const [obj, setObj] = useState<any>(null);
  const [error, setError] = useState("");
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [busyAction, setBusyAction] = useState("");
  const [toast, setToast] = useState((location.state as any)?.toast || "");

  async function load() {
    const data = await api.getObject(id!);
    setObj(data);
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!obj) return <div className="p-6 text-gray-500">Завантаження...</div>;

  const latestEstimate = obj.estimates[0];
  const isConfirmed = latestEstimate?.status === "confirmed";

  async function runAction(action: () => Promise<any>, key: string) {
    setError("");
    setMissingFields([]);
    setBusyAction(key);
    try {
      await action();
      await load();
    } catch (e: any) {
      setError(e.message);
      setMissingFields(e.missingFields || []);
    } finally {
      setBusyAction("");
    }
  }

  async function changeStatus(status: string) {
    await runAction(() => api.setStatus(id!, status), "status");
  }

  const requiredObjectFieldsFilled = !!(obj.client_phone && obj.client_email && obj.object_area && obj.work_type && obj.manager_name);
  const invoiceReady = obj.payment_mode === "full" ? !!obj.full_payment_amount : !!obj.advance_payment || !!obj.final_payment;

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      <header className="bg-[#0b1830] text-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          Об'єкт №{obj.contract_number} <span className="text-[#c9a44c]">— {obj.client_name}</span>
        </h1>
        <div className="flex gap-4 text-sm items-center">
          <Link
            to={`/objects/${id}/edit`}
            className="flex items-center gap-2 bg-[#c9a44c] text-[#0b1830] font-semibold px-4 py-2 rounded hover:brightness-95"
          >
            <span aria-hidden>✏️</span> Редагувати об'єкт
          </Link>
          <Link to="/" className="text-[#c9a44c] hover:underline">
            ← До списку
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {toast && (
          <div className="bg-green-50 text-green-700 text-sm p-3 rounded mb-4 border border-green-200">{toast}</div>
        )}
        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded mb-4 flex items-center justify-between">
            <span>{error}</span>
            {missingFields.length > 0 && (
              <Link to={`/objects/${id}/edit`} className="font-medium underline whitespace-nowrap ml-3">
                Перейти до редагування
              </Link>
            )}
          </div>
        )}
        {!requiredObjectFieldsFilled && (
          <div className="bg-amber-50 text-amber-800 text-sm p-3 rounded mb-4 border border-amber-200 flex items-center justify-between">
            <span>Заповніть обов'язкові поля об'єкту, щоб розблокувати генерацію документів.</span>
            <Link to={`/objects/${id}/edit`} className="font-medium underline whitespace-nowrap ml-3">
              Перейти до редагування
            </Link>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="mb-4">
            <StatusStepper status={obj.status} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
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
          </div>

          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
            <span className="text-gray-500 text-sm">Статус (ручна зміна):</span>
            <select
              className="border rounded px-2 py-1 text-sm"
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h2 className="font-semibold text-[#0b1830] mb-1">Автоматична обробка кошторису</h2>
          <p className="text-xs text-gray-500 mb-4">
            Завантажте файл від прораба — система сама розпізнає матеріали та роботи.
          </p>
          <EstimateBlock estimate={{ objectId: obj.id, row: latestEstimate }} onSaved={load} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h2 className="font-semibold text-[#0b1830] mb-3">Пакет документів TERZI</h2>
          <div className="flex flex-wrap gap-3 mb-3">
            <button
              onClick={() => runAction(() => api.generateDocument(id!, "contract"), "contract")}
              disabled={!!busyAction || !requiredObjectFieldsFilled}
              title={!requiredObjectFieldsFilled ? "Заповніть телефон, email, площу, вид робіт та менеджера об'єкту, щоб створити договір." : ""}
              className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-sm"
            >
              Створити договір
            </button>
            <button
              onClick={() => runAction(() => api.generateDocument(id!, "estimate"), "estimate")}
              disabled={!!busyAction || !isConfirmed}
              title={!isConfirmed ? "Завантажте та підтвердіть кошторис у блоці вище, щоб створити документ кошторису." : ""}
              className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-sm"
            >
              Створити кошторис
            </button>
            {obj.payment_mode === "advance_final" ? (
              <>
                <button
                  onClick={() => runAction(() => api.generateDocument(id!, "invoice_advance"), "invoice_a")}
                  disabled={!!busyAction || !invoiceReady}
                  title={!invoiceReady ? "Вкажіть суму авансу в даних об'єкту, щоб створити рахунок на аванс." : ""}
                  className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-sm"
                >
                  Рахунок на аванс
                </button>
                <button
                  onClick={() => runAction(() => api.generateDocument(id!, "invoice_final"), "invoice_f")}
                  disabled={!!busyAction || !invoiceReady}
                  title={!invoiceReady ? "Вкажіть суму остатку в даних об'єкту, щоб створити рахунок на остаток." : ""}
                  className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-sm"
                >
                  Рахунок на остаток
                </button>
              </>
            ) : (
              <button
                onClick={() => runAction(() => api.generateDocument(id!, "invoice_full"), "invoice_full")}
                disabled={!!busyAction || !invoiceReady}
                title={!invoiceReady ? "Вкажіть повну суму оплати в даних об'єкту, щоб створити рахунок на 100%." : ""}
                className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-sm"
              >
                Рахунок на 100%
              </button>
            )}
            <button
              onClick={() => runAction(() => api.generateDocument(id!, "act"), "act")}
              disabled={!!busyAction || (obj.status !== "Роботи виконані" && obj.status !== "Закрито")}
              title={
                obj.status !== "Роботи виконані" && obj.status !== "Закрито"
                  ? "Акт можна створити лише після того, як статус об'єкту стане 'Роботи виконані' або 'Закрито'."
                  : ""
              }
              className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-sm"
            >
              Створити акт
            </button>
            <button
              onClick={() => runAction(() => api.generateDocument(id!, "commercial_offer"), "commercial_offer")}
              disabled={!!busyAction}
              className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-sm"
            >
              Комерційна пропозиція
            </button>
            <button
              onClick={() => runAction(() => api.generatePackage(id!), "package")}
              disabled={!!busyAction || !isConfirmed}
              title={!isConfirmed ? "Завантажте та підтвердіть кошторис, щоб створити повний пакет документів." : ""}
              className="btn-navy px-5 py-2 rounded disabled:opacity-40 text-sm font-medium"
            >
              {busyAction === "package" ? "Створення..." : "Створити повний пакет"}
            </button>
          </div>
          {obj.status !== "Роботи виконані" && obj.status !== "Закрито" && (
            <p className="text-xs text-gray-400">Акт можна створити лише після того, як роботи виконані.</p>
          )}
          {!isConfirmed && (
            <p className="text-xs text-gray-400">Кошторис та повний пакет потребують підтвердженого кошторису.</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-[#0b1830] mb-3">Історія документів</h2>
          {obj.documents.length === 0 ? (
            <p className="text-gray-400 text-sm">Документи ще не створювались.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-2 py-2">Тип</th>
                  <th className="px-2 py-2">Версія</th>
                  <th className="px-2 py-2">Створено</th>
                  <th className="px-2 py-2">Автор</th>
                  <th className="px-2 py-2">Статус</th>
                  <th className="px-2 py-2">DOCX</th>
                  <th className="px-2 py-2">PDF</th>
                </tr>
              </thead>
              <tbody>
                {obj.documents.map((d: any) => (
                  <tr key={d.id} className="border-t">
                    <td className="px-2 py-2">
                      {DOC_LABELS[d.type]}
                      {d.invoice_kind ? ` (${INVOICE_KIND_LABELS[d.invoice_kind] || d.invoice_kind})` : ""}
                    </td>
                    <td className="px-2 py-2">v{d.version}</td>
                    <td className="px-2 py-2">{d.created_at}</td>
                    <td className="px-2 py-2">{d.created_by_name || "—"}</td>
                    <td className="px-2 py-2">
                      {d.status === "created_no_pdf" ? (
                        <span className="text-amber-600">тільки DOCX</span>
                      ) : (
                        <span className="text-green-700">створено</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {d.docx_path ? (
                        <button
                          className="text-[#0b1830] font-medium hover:underline"
                          onClick={() => api.downloadDocument(d.id, "docx", `${DOC_LABELS[d.type] || d.type}_v${d.version}.docx`).catch((e) => setError(e.message))}
                        >
                          Завантажити
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {d.pdf_path ? (
                        <button
                          className="text-[#0b1830] font-medium hover:underline"
                          onClick={() => api.downloadDocument(d.id, "pdf", `${DOC_LABELS[d.type] || d.type}_v${d.version}.pdf`).catch((e) => setError(e.message))}
                        >
                          Завантажити
                        </button>
                      ) : (
                        <span className="text-gray-400">не сформовано</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-gray-400 text-xs">{label}</div>
      <div className="text-[#0b1830] font-medium">{value}</div>
    </div>
  );
}
