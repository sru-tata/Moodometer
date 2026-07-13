import { LineChart, Line, ResponsiveContainer } from "recharts";

export function KpiCard({ label, value, sub, icon, accent = "text-moodplum" }) {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        {icon && <span className="text-moodlilac">{icon}</span>}
      </div>
      <p className={`text-3xl font-bold mt-1 ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export function RiskBadge({ level }) {
  const styles = {
    High: "bg-moodcoral/20 text-moodcoral",
    Medium: "bg-moodgold/20 text-moodplum",
    Low: "bg-moodmint/20 text-moodplum",
  };
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${styles[level] || "bg-gray-100 text-gray-500"}`}>
      {level}
    </span>
  );
}

export function Sparkline({ data, dataKey, color = "#7C5CBF" }) {
  if (!data || data.length < 2) return <div className="h-8" />;
  return (
    <div style={{ width: "100%", height: 32 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScoreDial({ score, label }) {
  const safe = score ?? 0;
  const color = safe >= 70 ? "#4FD6B9" : safe >= 50 ? "#F2B84B" : "#F2664B";
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (safe / 100) * circumference;
  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#EDEAF6" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="55" textAnchor="middle" fontSize="22" fontWeight="700" fill="#3D2C5F">
          {score ?? "—"}
        </text>
      </svg>
      {label && <p className="text-xs text-gray-500 mt-1 text-center">{label}</p>}
    </div>
  );
}
