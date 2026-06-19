import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Не авторизовано" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Невірний токен" });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "administrator") {
    return res.status(403).json({ error: "Доступ лише для адміністратора" });
  }
  next();
}
