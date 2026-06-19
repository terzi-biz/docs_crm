import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ObjectForm from "./pages/ObjectForm";
import ObjectDetail from "./pages/ObjectDetail";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Завантаження...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/objects/new"
        element={
          <ProtectedRoute>
            <ObjectForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/objects/:id/edit"
        element={
          <ProtectedRoute>
            <ObjectForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/objects/:id"
        element={
          <ProtectedRoute>
            <ObjectDetail />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
