import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const STATUSES = [
  "Новий",
  "Документи підготовлені",
  "Рахунок виставлений",
  "Договір підписаний",
  "Роботи виконані",
  "Закритий",
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [objects, setObjects] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params: Record<string, string> = {};
    if (q) params.q = q;
    if (status) params.status = status;
    const data = await api.listObjects(params);
    setObjects(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    load();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800">Terzi Docs CRM</h1>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{user?.name}</span>
          <button onClick={logout} className="text-purple-600 hover:underline">
            Вийти
          </button>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Об'єкти</h2>
          <Link
            to="/objects/new"
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            + Новий об'єкт
          </Link>
        </div>

        <form onSubmit={onSearchSubmit} className="flex gap-3 mb-4">
          <input
            className="border rounded px-3 py-2 flex-1"
            placeholder="Пошук: номер договору, KeyCRM, ПІБ, телефон, адреса"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="border rounded px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Всі статуси</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">Пошук</button>
        </form>

        {loading ? (
          <div className="text-gray-500">Завантаження...</div>
        ) : (
          <div className="bg-white rounded shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-2">№ Договору</th>
                  <th className="px-4 py-2">Клієнт</th>
                  <th className="px-4 py-2">Адреса</th>
                  <th className="px-4 py-2">Сума</th>
                  <th className="px-4 py-2">Менеджер</th>
                  <th className="px-4 py-2">Статус</th>
                </tr>
              </thead>
              <tbody>
                {objects.map((o) => (
                  <tr key={o.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link to={`/objects/${o.id}`} className="text-purple-600 hover:underline">
                        №{o.contract_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{o.client_name}</td>
                    <td className="px-4 py-2">{o.object_address}</td>
                    <td className="px-4 py-2">{Number(o.total_amount).toLocaleString("uk-UA")} грн</td>
                    <td className="px-4 py-2">{o.manager_name}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-1 rounded bg-purple-100 text-purple-700 text-xs">
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {objects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
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
