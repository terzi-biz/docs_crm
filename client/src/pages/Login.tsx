import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b1830]">
      <form onSubmit={onSubmit} className="bg-white shadow-xl rounded-xl p-8 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-[#0b1830]">
          TERZI <span className="text-[#c9a44c]">Docs CRM</span>
        </h1>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Email</label>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Пароль</label>
          <input
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </div>
        <button disabled={busy} className="w-full btn-navy rounded py-2 font-medium disabled:opacity-50">
          {busy ? "Вхід..." : "Увійти"}
        </button>
      </form>
    </div>
  );
}
