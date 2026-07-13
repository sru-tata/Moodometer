import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import api from "../api/client";
import Navbar from "../components/Navbar";
import PulseCheckFlow from "../components/PulseCheckFlow";
import { useAuth } from "../context/AuthContext";
import { GradientDefs, ChartTooltip } from "../components/charts/ChartTheme";

const INDEX_LABELS = {
  motivation_index: "Motivation",
  growth_index: "Growth",
  leadership_index: "Leadership Trust",
  workload_index: "Workload Health",
  belonging_index: "Belonging",
};

const MOOD_EMOJI = {
  Energized: "⚡",
  Motivated: "🙂",
  Neutral: "😐",
  Stressed: "😟",
  Frustrated: "😣",
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState(null);
  const [history, setHistory] = useState([]);
  const [mode, setMode] = useState("loading"); // loading | prompt | flow | result
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState("");

  async function loadAll() {
    const [q, h] = await Promise.all([api.get("/questions/weekly"), api.get("/checkins/me")]);
    setQuestions(q.data);
    setHistory(h.data);
    setMode("prompt");
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleComplete(mood, answers) {
    setError("");
    try {
      const res = await api.post("/checkins", { mood, ...answers });
      setLastResult(res.data);
      const h = await api.get("/checkins/me");
      setHistory(h.data);
      setMode("result");
    } catch (err) {
      setError(err?.response?.data?.detail || "Something went wrong.");
      setMode("prompt");
    }
  }

  const chartData = [...history].reverse().map((c) => ({
    date: new Date(c.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    Motivation: c.motivation_index,
    Growth: c.growth_index,
    "Leadership Trust": c.leadership_index,
    "Workload Health": c.workload_index,
    Belonging: c.belonging_index,
  }));

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-moodplum">Hi {user?.full_name?.split(" ")[0]}</h1>
          <p className="text-gray-500">Your weekly pulse check takes under 30 seconds.</p>
        </div>

        {error && <p className="text-sm text-moodcoral">{error}</p>}

        {mode === "loading" && <p className="text-gray-400">Loading...</p>}

        {mode === "prompt" && questions && (
          <div className="bg-gradient-to-br from-moodplum to-moodviolet rounded-2xl shadow-soft p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-lg">
                {history.length === 0 ? "Ready for your first pulse check?" : "Ready for another pulse check?"}
              </p>
              <p className="text-moodlilac text-sm mt-1">
                {history.length === 0
                  ? "6 quick taps — mood + 5 questions — and you're done."
                  : `You've checked in ${history.length} time${history.length > 1 ? "s" : ""} so far. This is a demo, so feel free to check in again anytime.`}
              </p>
            </div>
            <button
              onClick={() => setMode("flow")}
              className="shrink-0 bg-white text-moodplum font-semibold rounded-xl px-6 py-3 hover:bg-moodlilac transition"
            >
              Start Pulse Check
            </button>
          </div>
        )}

        {mode === "flow" && questions && (
          <PulseCheckFlow moods={questions.moods} questions={questions.questions} onComplete={handleComplete} />
        )}

        {mode === "result" && lastResult && (
          <div className="bg-white rounded-2xl shadow-soft p-6 sm:p-8 text-center space-y-6">
            <div>
              <p className="text-4xl mb-2">{MOOD_EMOJI[lastResult.mood]}</p>
              <p className="text-moodplum font-semibold text-lg">Thanks for checking in!</p>
              <p className="text-sm text-gray-500">Here's how your response maps to the five mood dimensions.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Object.entries(INDEX_LABELS).map(([key, label]) => (
                <div key={key} className="bg-moodplum/5 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-moodplum">{lastResult[key]}</p>
                  <p className="text-[11px] text-gray-500">{label}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setMode("prompt")}
              className="bg-moodplum hover:bg-moodviolet transition text-white rounded-lg px-6 py-2.5 font-medium"
            >
              Done
            </button>
          </div>
        )}

        {history.length > 0 && mode !== "flow" && (
          <div className="bg-white rounded-2xl shadow-soft p-6">
            <h2 className="font-semibold text-moodplum mb-4">Your trend over time</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <GradientDefs />
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEECF6" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                  <Area type="monotone" dataKey="Motivation" stroke="#7C5CBF" fill="url(#gradMotivation)" strokeWidth={2} dot={{ r: 3 }} />
                  <Area type="monotone" dataKey="Growth" stroke="#4FD6B9" fill="url(#gradGrowth)" strokeWidth={2} dot={{ r: 3 }} />
                  <Area type="monotone" dataKey="Leadership Trust" stroke="#F2B84B" fill="url(#gradLeadership)" strokeWidth={2} dot={{ r: 3 }} />
                  <Area type="monotone" dataKey="Workload Health" stroke="#F2664B" fill="url(#gradWorkload)" strokeWidth={2} dot={{ r: 3 }} />
                  <Area type="monotone" dataKey="Belonging" stroke="#3D2C5F" fill="url(#gradBelonging)" strokeWidth={2} dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
