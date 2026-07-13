import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, Users } from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Tooltip,
} from "recharts";
import { GradientDefs, ChartTooltip, INDEX_COLOR_MAP } from "./charts/ChartTheme";

const INDEX_LABELS = {
  motivation_index: "Motivation",
  growth_index: "Growth",
  leadership_index: "Leadership",
  workload_index: "Workload",
  belonging_index: "Belonging",
};

function heatStyle(score) {
  if (score === null || score === undefined) {
    return { background: "linear-gradient(135deg, #F1EFF8, #E8E4F3)", text: "text-gray-400" };
  }
  if (score >= 70) return { background: "linear-gradient(135deg, #4FD6B9, #37B89E)", text: "text-white" };
  if (score >= 50) return { background: "linear-gradient(135deg, #F2C572, #F2B84B)", text: "text-moodplum" };
  return { background: "linear-gradient(135deg, #F98A5B, #F2664B)", text: "text-white" };
}

export default function DepartmentHeatmap({ departments, onSelectDepartment }) {
  const [selected, setSelected] = useState(null);

  function handleSelect(d) {
    const next = selected?.department_id === d.department_id ? null : d;
    setSelected(next);
    if (next && onSelectDepartment) onSelectDepartment(next);
  }

  const radarData = selected
    ? Object.entries(INDEX_LABELS).map(([key, label]) => ({
        dimension: label,
        score: selected.indices[key] ?? 0,
        fullMark: 100,
      }))
    : [];

  return (
    <div className="bg-white rounded-2xl shadow-soft p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-moodplum">Department Heat Map</h2>
        <span className="text-[11px] text-gray-400">30-day average vs. prior 30 days</span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Click a department to see its index breakdown and jump to Attrition Prediction filtered to that team.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {departments.map((d) => {
          const style = heatStyle(d.overall_score);
          const isSelected = selected?.department_id === d.department_id;
          const TrendIcon = d.trend > 0 ? TrendingUp : d.trend < 0 ? TrendingDown : Minus;
          return (
            <button
              key={d.department_id}
              onClick={() => handleSelect(d)}
              style={{ background: style.background }}
              className={`relative overflow-hidden rounded-2xl p-4 text-left transition-all duration-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 ${style.text} ${
                isSelected ? "ring-4 ring-moodviolet/40" : ""
              }`}
            >
              <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
              <p className="text-sm font-semibold relative">{d.department}</p>
              <p className="text-3xl font-bold relative mt-0.5">{d.overall_score ?? "—"}</p>
              {d.trend !== null && d.trend !== undefined && (
                <p className="text-xs font-medium relative flex items-center gap-1 mt-1 opacity-90">
                  <TrendIcon size={12} strokeWidth={2.5} />
                  {Math.abs(d.trend)} vs last month
                </p>
              )}
              <p className="text-[11px] relative mt-2 opacity-80 flex items-center gap-1">
                <Users size={11} /> {d.headcount} · {d.participants_30d} checked in
              </p>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-6 border-t pt-5 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div>
            <h3 className="font-semibold text-moodplum mb-1">{selected.department}</h3>
            <p className="text-xs text-gray-400 mb-4">Five-dimension index breakdown, 30-day average</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(INDEX_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between bg-moodplum/5 rounded-lg px-3 py-2">
                  <span className="text-xs text-gray-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: INDEX_COLOR_MAP[key] }} />
                    {label}
                  </span>
                  <span className="text-sm font-bold text-moodplum">{selected.indices[key] ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <RadarChart data={radarData} outerRadius="75%">
                <GradientDefs />
                <PolarGrid stroke="#E8E4F3" />
                <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: "#6B7280" }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="score" stroke="#7C5CBF" fill="url(#gradMotivation)" fillOpacity={1} strokeWidth={2} />
                <Tooltip content={<ChartTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
