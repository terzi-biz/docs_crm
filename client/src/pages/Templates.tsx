import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const TYPES = [
  { value: "contract", label: "Договір" },
  { value: "estimate", label: "Кошторис" },
  { value: "invoice", label: "Рахунок" },
  { value: "act", label: "Акт" },
  { value: "commercial_offer", label: "Комерційна пропозиція" },
];

export default function Templates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [type, setType] = useState("contract");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    const data = await api.listTemplates();
    setTemplates(data);
  }

  useEffect(() => {
    load();
  }, []);

  if (user?.role !== "administrator") {
    return (
      <div className="p-6 text-gray-500">
        Доступ лише для адміністратора. <Link to="/" className="text-[#0b1830] underline">На головну</Link>
      </div>
    );
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name.trim()) return;
    setError("");
    setBusy(true);
    try {
      await api.uploadTemplate({ type, name, is_active: isActive, file });
      setName("");
      setFile(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(t: any) {
    setError("");
    try {
      await api.patchTemplate(t.id, { is_active: !t.is_active });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function remove(t: any) {
    setError("");
    try {
      await api.deleteTemplate(t.id);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      <header className="bg-[#0b1830] text-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Шаблони документів</h1>
        <Link to="/" className="text-[#c9a44c] hover:underline text-sm">
          ← До списку
        </Link>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded mb-4">{error}</div>}

        <form onSubmit={upload} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6 flex flex-wrap gap-3 items-end">
          <select className="border rounded px-3 py-2" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            className="border rounded px-3 py-2 flex-1 min-w-[200px]"
            placeholder="Назва шаблону"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="file"
            accept=".docx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Активний
          </label>
          <button disabled={busy} className="btn-navy px-4 py-2 rounded text-sm font-medium">
            {busy ? "Завантаження..." : "Завантажити"}
          </button>
        </form>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3">Тип</th>
                <th className="px-4 py-3">Назва</th>
                <th className="px-4 py-3">Версія</th>
                <th className="px-4 py-3">Активний</th>
                <th className="px-4 py-3">Оновлено</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-3">{TYPES.find((x) => x.value === t.type)?.label || t.type}</td>
                  <td className="px-4 py-3">{t.name}</td>
                  <td className="px-4 py-3">v{t.version}</td>
                  <td className="px-4 py-3">
                    {t.is_active ? (
                      <span className="text-green-700 font-medium">активний</span>
                    ) : (
                      <span className="text-gray-400">неактивний</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{t.updated_at}</td>
                  <td className="px-4 py-3 flex gap-3">
                    <a className="text-[#0b1830] hover:underline" href={api.templateDownloadUrl(t.id)}>
                      Завантажити
                    </a>
                    <button onClick={() => toggleActive(t)} className="text-[#0b1830] hover:underline">
                      {t.is_active ? "Деактивувати" : "Активувати"}
                    </button>
                    <button onClick={() => remove(t)} className="text-red-600 hover:underline">
                      Видалити
                    </button>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    Шаблонів ще немає
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
