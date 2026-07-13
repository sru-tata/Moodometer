import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import api from "../api/client";
import { RiskBadge, ScoreDial } from "./UI";
import { GradientDefs, ChartTooltip } from "./charts/ChartTheme";

const INDEX_LABELS = {
  motivation_index: "Motivation",
  growth_index: "Growth",
  leadership_index: "Leadership Trust",
  workload_index: "Workload Health",
  belonging_index: "Belonging",
};

export default function EmployeeDrilldownModal({ userId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/admin/employee/${userId}`).then((res) => setData(res.data)).finally(() => setLoading(false));
  }, [userId]);

  const chartData = (data?.checkins || []).map((c) => ({
    date: new Date(c.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    Motivation: c.motivation_index,
    Growth: c.growth_index,
    "Leadership Trust": c.leadership_index,
    "Workload Health": c.workload_index,
    Belonging: c.belonging_index,
  }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="float-right text-gray-400 hover:text-moodplum">
          <X size={20} />
        </button>

        {loading || !data ? (
          <p className="text-gray-400 py-10 text-center">Loading employee profile...</p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
              <ScoreDial score={data.attrition?.risk_score} label="Attrition Risk" />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-moodplum">{data.user.full_name}</h2>
                <p className="text-sm text-gray-500">{data.user.email}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs bg-moodlilac/20 text-moodplum px-2 py-1 rounded-full">
                    {data.user.department?.name || "Unassigned"}
                  </span>
                  {data.attrition && <RiskBadge level={data.attrition.risk_level} />}
                  <span className="text-xs text-gray-500">Tenure: {data.user.tenure_months}mo</span>
                  <span className="text-xs text-gray-500">Absenteeism: {data.user.absenteeism_days}d</span>
                  <span className="text-xs text-gray-500">Performance: {data.user.performance_rating}/5</span>
                  <span className="text-xs text-gray-500">Learning: {data.user.learning_participation}%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
              {Object.entries(INDEX_LABELS).map(([key, label]) => (
                <div key={key} className="bg-moodplum/5 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-moodplum">{data.average_indices[key] ?? "—"}</p>
                  <p className="text-[11px] text-gray-500">{label}</p>
                </div>
              ))}
            </div>

            {chartData.length > 1 ? (
              <div>
                <h3 className="font-semibold text-moodplum mb-2 text-sm">Check-in history</h3>
                <div style={{ width: "100%", height: 240 }}>
                  <ResponsiveContainer>
                    <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <GradientDefs />
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEECF6" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                      <Area type="monotone" dataKey="Motivation" stroke="#7C5CBF" fill="url(#gradMotivation)" strokeWidth={2} dot={{ r: 2 }} />
                      <Area type="monotone" dataKey="Growth" stroke="#4FD6B9" fill="url(#gradGrowth)" strokeWidth={2} dot={{ r: 2 }} />
                      <Area type="monotone" dataKey="Leadership Trust" stroke="#F2B84B" fill="url(#gradLeadership)" strokeWidth={2} dot={{ r: 2 }} />
                      <Area type="monotone" dataKey="Workload Health" stroke="#F2664B" fill="url(#gradWorkload)" strokeWidth={2} dot={{ r: 2 }} />
                      <Area type="monotone" dataKey="Belonging" stroke="#3D2C5F" fill="url(#gradBelonging)" strokeWidth={2} dot={{ r: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Not enough check-in history yet to plot a trend.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
