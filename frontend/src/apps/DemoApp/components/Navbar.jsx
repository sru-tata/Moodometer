import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.get("/system/status").then((r) => setStatus(r.data)).catch(() => {});
  }, []);

  return (
    <header className="bg-moodplum text-white sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-moodgold">
            <Activity size={16} strokeWidth={2.5} />
          </span>
          <span className="font-semibold tracking-tight">Mood-O-Meter</span>
          {user?.role === "admin" && (
            <span className="ml-2 text-[10px] uppercase tracking-wide bg-moodgold text-moodplum px-2 py-0.5 rounded-full font-bold">
              HR Admin
            </span>
          )}
          {status && !status.mongo_connected && (
            <span
              title="Using local in-memory demo data (NeuroNest MongoDB cluster not reachable from this network)"
              className="hidden sm:inline-flex items-center gap-1 ml-2 text-[10px] uppercase tracking-wide bg-white/10 px-2 py-0.5 rounded-full text-moodlilac"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-moodgold" /> offline demo data
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden sm:inline text-moodlilac">{user?.full_name}</span>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="bg-white/10 hover:bg-white/20 transition px-3 py-1.5 rounded-lg"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
