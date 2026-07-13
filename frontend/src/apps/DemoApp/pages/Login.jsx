import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Activity } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(role) {
    if (role === "admin") {
      setEmail("admin@moodometer.io");
      setPassword("admin123");
    } else {
      setEmail("employee@moodometer.io");
      setPassword("employee123");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-moodplum via-moodviolet to-moodlilac px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="mx-auto mb-3 w-14 h-14 rounded-2xl bg-moodplum flex items-center justify-center text-white">
            <Activity size={26} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-moodplum">Mood-O-Meter</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time pulse of employee sentiment</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-moodviolet"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-moodviolet"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-moodcoral">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-moodplum hover:bg-moodviolet transition text-white rounded-lg py-2.5 font-medium disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 border-t pt-4">
          <p className="text-xs text-gray-500 mb-2 text-center">Quick demo access</p>
          <div className="flex gap-2">
            <button
              onClick={() => fillDemo("employee")}
              className="flex-1 text-xs rounded-lg border border-moodviolet text-moodviolet py-2 hover:bg-moodviolet/5"
            >
              Fill Employee Demo
            </button>
            <button
              onClick={() => fillDemo("admin")}
              className="flex-1 text-xs rounded-lg border border-moodplum text-moodplum py-2 hover:bg-moodplum/5"
            >
              Fill Admin Demo
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          New employee?{" "}
          <Link to="/register" className="text-moodviolet font-medium hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
