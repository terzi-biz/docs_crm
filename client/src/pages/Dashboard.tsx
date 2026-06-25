import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { STATUSES } from "../components/StatusStepper";

const STAT_CARDS = [
  { key: "total", label: "Всього об'єктів" },
  { key: "Новий об'єкт", label: "Нові" },
  { key: "Кошторис завантажено", label: "Кошторис завантажено" },
  { key: "Кошторис перевірено", label: "Кошторис перевірено" },
  { key: "Документи створено", label: "Документи створено" },
  { key: "Договір підписано", label: "Договір підписано" },
  { key: "Закрито", label: "Закрито" },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [objects, setObjects] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ total: 0, byStatus: {} });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [manager, setManager] = useState("");
  const [workType, setWorkType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params: Record<string, string> = {};
    if (q) params.q = q;
    if (status) params.status = status;
    if (manager) params.manager = manager;
    if (workType) params.workType = workType;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    const [data, statData] = await Promise.all([api.listObjects(params), api.objectStats()]);
    setObjects(data);
    setStats(statData);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, manager, workType, dateFrom, dateTo]);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    load();
  }

  const managers = Array.from(new Set(objects.map((o) => o.manager_name).filter(Boolean)));
  const workTypes = Array.from(new Set(objects.map((o) => o.work_type).filter(Boolean)));

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      <header className="bg-[#0b1830] text-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          TERZI <span className="text-[#c9a44c]">Docs CRM</span>
        </h1>
        <div className="flex items-center gap-4 text-sm">
          {user?.role === "administrator" && (
            <Link to="/templates" className="text-[#c9a44c] hover:underline">
              Шаблони документів
            </Link>
          )}
          <span className="text-gray-300">{user?.name}</span>
          <button onClick={logout} className="text-[#c9a44c] hover:underline">
            Вийти
          </button>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {STAT_CARDS.map((c) => (
            <div key={c.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="text-2xl font-bold text-[#0b1830]">
                {c.key === "total" ? stats.total : stats.byStatus?.[c.key] ?? 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[#0b1830]">Об'єкти</h2>
          <Link to="/objects/new" className="btn-gold px-4 py-2 rounded font-medium text-sm">
            + Новий об'єкт
          </Link>
        </div>

        <form onSubmit={onSearchSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 flex flex-wrap gap-3">
          <input
            className="border rounded px-3 py-2 flex-1 min-w-[220px]"
            placeholder="Пошук: KeyCRM, ПІБ, телефон, адреса"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="border rounded px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Всі статуси</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select className="border rounded px-3 py-2" value={manager} onChange={(e) => setManager(e.target.value)}>
            <option value="">Всі менеджери</option>
            {managers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select className="border rounded px-3 py-2" value={workType} onChange={(e) => setWorkType(e.target.value)}>
            <option value="">Всі види робіт</option>
            {workTypes.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
          <input type="date" className="border rounded px-3 py-2" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input type="date" className="border rounded px-3 py-2" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <button className="btn-navy px-4 py-2 rounded text-sm">Пошук</button>
        </form>

        {loading ? (
          <div className="text-gray-500">Завантаження...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3">№ Договору</th>
                  <th className="px-4 py-3">Клієнт</th>
                  <th className="px-4 py-3">Адреса</th>
                  <th className="px-4 py-3">Вид робіт</th>
                  <th className="px-4 py-3">Сума</th>
                  <th className="px-4 py-3">Менеджер</th>
                  <th className="px-4 py-3">Статус</th>
                </tr>
              </thead>
              <tbody>
                {objects.map((o) => (
                  <tr key={o.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/objects/${o.id}`} className="text-[#0b1830] font-medium hover:underline">
                        №{o.contract_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{o.client_name}</td>
                    <td className="px-4 py-3">{o.object_address}</td>
                    <td className="px-4 py-3">{o.work_type || "—"}</td>
                    <td className="px-4 py-3">{Number(o.total_amount).toLocaleString("uk-UA")} грн</td>
                    <td className="px-4 py-3">{o.manager_name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full bg-[#c9a44c]/15 text-[#0b1830] text-xs font-medium">
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {objects.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                      Об'єкти не знайдено
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
