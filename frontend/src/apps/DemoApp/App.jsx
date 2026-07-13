import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import AdminDashboard from "./pages/AdminDashboard";

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="text-center text-gray-400 mt-20">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  }
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          loading ? null : user ? (
            <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />
          ) : (
            <Login />
          )
        }
      />
      <Route
        path="/register"
        element={
          loading ? null : user ? (
            <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />
          ) : (
            <Register />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute role="user">
            <EmployeeDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <AppRoutes />
    </AuthProvider>
  );
}
