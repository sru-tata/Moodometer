import { useState } from "react";
import { ChevronDown, TrendingUp, TrendingDown, Minus, CalendarClock, Users2 } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import api from "../api/client";
import { GradientDefs, ChartTooltip, INDEX_COLOR_MAP } from "./charts/ChartTheme";

const INDEX_LABELS = {
  motivation_index: "Motivation",
  growth_index: "Growth",
  leadership_index: "Leadership",
  workload_index: "Workload",
  belonging_index: "Belonging",
};

function DeltaPill({ value }) {
  if (value === null || value === undefined) {
    return <span className="text-[11px] text-gray-400">no data</span>;
  }
  const Icon = value > 0.5 ? TrendingUp : value < -0.5 ? TrendingDown : Minus;
  const color = value > 0.5 ? "text-moodmint bg-moodmint/10" : value < -0.5 ? "text-moodcoral bg-moodcoral/10" : "text-gray-400 bg-gray-100";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${color}`}>
      <Icon size={11} strokeWidth={2.5} />
      {value > 0 ? "+" : ""}{value}
    </span>
  );
}

function ImpactPanel({ impact }) {
  if (!impact) return <p className="text-sm text-gray-400 py-4">Loading impact analysis...</p>;

  const noAfterData = impact.after.checkin_count === 0;

  return (
    <div className="pt-4 space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1 bg-moodplum/5 px-2 py-1 rounded-full">
          <CalendarClock size={12} /> {impact.days_since_event} day{impact.days_since_event === 1 ? "" : "s"} since event
        </span>
        <span className="inline-flex items-center gap-1 bg-moodplum/5 px-2 py-1 rounded-full">
          <Users2 size={12} /> Scope: {impact.scope}
        </span>
      </div>

      {noAfterData && (
        <div className="bg-moodgold/10 border border-moodgold/30 rounded-xl p-3 text-xs text-moodplum">
          No check-ins recorded yet since this event — the "after" comparison will fill in as your
          team submits pulse checks. Baseline ("before") data is already shown below.
        </div>
      )}

      {/* Overall score comparison */}
      <div className="grid grid-cols-3 items-center gap-3">
        <div className="text-center">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide">Before</p>
          <p className="text-2xl font-bold text-moodplum">{impact.before.overall_score ?? "—"}</p>
          <p className="text-[10px] text-gray-400">{impact.before.window_label}</p>
        </div>
        <div className="text-center">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Change</p>
          <DeltaPill value={impact.overall_delta} />
        </div>
        <div className="text-center">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide">After</p>
          <p className="text-2xl font-bold text-moodplum">{impact.after.overall_score ?? "—"}</p>
          <p className="text-[10px] text-gray-400">{impact.after.window_label}</p>
        </div>
      </div>

      {/* Per-dimension deltas */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {Object.entries(INDEX_LABELS).map(([key, label]) => (
          <div key={key} className="bg-moodplum/5 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-gray-500 flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: INDEX_COLOR_MAP[key] }} />
              {label}
            </p>
            <p className="text-sm font-bold text-moodplum mt-0.5">{impact.after.indices[key] ?? "—"}</p>
            <DeltaPill value={impact.deltas[key]} />
          </div>
        ))}
      </div>

      {/* Timeline with reference line at event date */}
      {impact.timeline.length > 1 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Weekly sentiment score — 30 days before through today</p>
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer>
              <AreaChart data={impact.timeline} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <GradientDefs />
                <CartesianGrid strokeDasharray="3 3" stroke="#EEECF6" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine
                  x={impact.timeline.find((t) => t.period === "after")?.date}
                  stroke="#F2664B"
                  strokeDasharray="4 4"
                  label={{ value: "Event", position: "insideTopLeft", fontSize: 10, fill: "#F2664B" }}
                />
                <Area type="monotone" dataKey="score" name="Overall Score" stroke="#3D2C5F" fill="url(#gradOverall)" strokeWidth={2} dot={{ r: 2 }} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EventAccordion({ event }) {
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !impact) {
      setLoading(true);
      try {
        const res = await api.get(`/admin/events/${event.id}/impact`);
        setImpact(res.data);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-moodplum/[0.02] transition">
        <div>
          <p className="font-medium text-moodplum">{event.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(event.event_date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
          </p>
          {event.description && <p className="text-sm text-gray-600 mt-1">{event.description}</p>}
        </div>
        <ChevronDown size={18} className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {loading ? <p className="text-sm text-gray-400 py-4">Loading impact analysis...</p> : <ImpactPanel impact={impact} />}
        </div>
      )}
    </div>
  );
}
