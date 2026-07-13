import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, ComposedChart, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { ArrowRight, Download, Search, Sparkles, Users } from "lucide-react";
import api from "../api/client";
import Navbar from "../components/Navbar";
import DepartmentHeatmap from "../components/DepartmentHeatmap";
import EmployeeDrilldownModal from "../components/EmployeeDrilldownModal";
import EventAccordion from "../components/EventAccordion";
import { KpiCard, RiskBadge, ScoreDial } from "../components/UI";
import { GradientDefs, ChartTooltip, MOOD_COLORS } from "../components/charts/ChartTheme";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "insights", label: "AI Insights" },
  { key: "attrition", label: "Attrition Prediction" },
  { key: "events", label: "Events" },
];

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

function downloadWithAuth(path, filename) {
  const token = localStorage.getItem("mood_token");
  fetch(`${API_BASE}/DemoApp${path}`, { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => res.blob())
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    });
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("overview");
  const [dashboard, setDashboard] = useState(null);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [attrition, setAttrition] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventForm, setEventForm] = useState({ title: "", description: "", department_id: "", event_date: "" });
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [deptFilter, setDeptFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/admin/dashboard").then((r) => setDashboard(r.data));
    api.get("/admin/events").then((r) => setEvents(r.data));
  }, []);

  useEffect(() => {
    setInsightsLoading(true);
    api.get("/admin/insights").then((r) => setInsights(r.data)).finally(() => setInsightsLoading(false));
  }, []);

  useEffect(() => {
    const params = {};
    if (deptFilter) params.department_id = deptFilter;
    if (riskFilter) params.risk_level = riskFilter;
    if (search) params.search = search;
    api.get("/admin/attrition", { params }).then((r) => setAttrition(r.data));
  }, [deptFilter, riskFilter, search]);

  async function handleAddEvent(e) {
    e.preventDefault();
    if (!eventForm.title) return;
    const payload = {
      title: eventForm.title,
      description: eventForm.description || null,
      department_id: eventForm.department_id || null,
      event_date: eventForm.event_date ? new Date(eventForm.event_date).toISOString() : null,
    };
    const res = await api.post("/admin/events", payload);
    setEvents([res.data, ...events]);
    setEventForm({ title: "", description: "", department_id: "", event_date: "" });
  }

  const departmentOptions = useMemo(
    () => dashboard?.department_heatmap?.map((d) => ({ id: d.department_id, name: d.department })) || [],
    [dashboard]
  );

  if (!dashboard) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <p className="text-center text-gray-400 mt-20">Loading dashboard...</p>
      </div>
    );
  }

  const moodPieData = Object.entries(dashboard.mood_distribution).map(([name, value]) => ({ name, value }));
  const moodTotal = moodPieData.reduce((sum, m) => sum + m.value, 0);

  // Stitch actual weekly history + projected forecast into one continuous
  // series so the forecast chart reads as "where we've been -> where we're
  // headed" instead of two disconnected charts.
  const forecastTimeline = attrition
    ? [
        ...(attrition.weekly_history || []).map((w) => ({ week: w.week, actual: w.score, forecast: null })),
        ...(attrition.forecast_series || []).map((f, i) => ({
          week: f.week,
          actual: null,
          // bridge the gap so the forecast line connects to the last actual point
          forecast: i === 0 ? f.score : f.score,
        })),
      ]
    : [];
  if (forecastTimeline.length && attrition?.weekly_history?.length) {
    const bridgeIndex = attrition.weekly_history.length - 1;
    forecastTimeline[bridgeIndex].forecast = forecastTimeline[bridgeIndex].actual;
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-moodplum">Organization Pulse Dashboard</h1>
            <p className="text-gray-500">Real-time sentiment intelligence across the workforce.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => downloadWithAuth("/admin/export/departments.csv", "department_scorecard.csv")}
              className="flex items-center gap-1.5 text-xs font-medium bg-white border border-gray-200 hover:border-moodviolet text-moodplum px-3 py-2 rounded-lg transition"
            >
              <Download size={14} /> Departments CSV
            </button>
            <button
              onClick={() => downloadWithAuth("/admin/export/attrition.csv", "attrition_risk_report.csv")}
              className="flex items-center gap-1.5 text-xs font-medium bg-white border border-gray-200 hover:border-moodviolet text-moodplum px-3 py-2 rounded-lg transition"
            >
              <Download size={14} /> Attrition CSV
            </button>
          </div>
        </div>

        <div className="flex gap-2 border-b overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                tab === t.key ? "border-moodviolet text-moodviolet" : "border-transparent text-gray-500 hover:text-moodplum"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="bg-white rounded-2xl shadow-soft p-5 flex items-center gap-4 col-span-2 sm:col-span-1">
                <ScoreDial score={dashboard.wellbeing_score} />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Wellbeing Score</p>
                  <p className="text-xs text-gray-400 mt-1">Composite of all 5 indices</p>
                </div>
              </div>
              <KpiCard label="Total Employees" value={dashboard.total_employees} icon={<Users size={16} />} />
              <KpiCard label="Participation (7d)" value={`${dashboard.participation_rate}%`} />
              <KpiCard label="Workload Health" value={dashboard.org_indices.workload_index ?? "—"} sub="Higher = healthier" />
              <KpiCard label="Total Check-ins" value={dashboard.total_checkins} />
            </div>

            <DepartmentHeatmap
              departments={dashboard.department_heatmap}
              onSelectDepartment={(d) => {
                setDeptFilter(d.department_id);
                setTab("attrition");
              }}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-soft p-6">
                <h2 className="font-semibold text-moodplum mb-4">Org-Wide Trend (12 weeks)</h2>
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <AreaChart data={dashboard.trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <GradientDefs />
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEECF6" vertical={false} />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                      <Area type="monotone" dataKey="overall_score" name="Overall Score" stroke="#3D2C5F" fill="url(#gradOverall)" strokeWidth={3} dot={false} />
                      <Area type="monotone" dataKey="workload_index" name="Workload Health" stroke="#F2664B" fill="url(#gradWorkload)" strokeWidth={2} dot={false} fillOpacity={0.5} />
                      <Area type="monotone" dataKey="motivation_index" name="Motivation" stroke="#7C5CBF" fill="url(#gradMotivation)" strokeWidth={2} dot={false} fillOpacity={0.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-gray-400 mt-2">Trends matter more than snapshots — a stable-looking score can mask a steep decline.</p>
              </div>

              <div className="bg-white rounded-2xl shadow-soft p-6">
                <h2 className="font-semibold text-moodplum mb-4">Mood Distribution</h2>
                <div className="relative" style={{ width: "100%", height: 220 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={moodPieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={85}
                        paddingAngle={3}
                        cornerRadius={6}
                        stroke="none"
                      >
                        {moodPieData.map((entry) => (
                          <Cell key={entry.name} fill={MOOD_COLORS[entry.name]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-2xl font-bold text-moodplum">{moodTotal}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">check-ins</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2 justify-center">
                  {moodPieData.map((m) => (
                    <span key={m.name} className="text-[11px] flex items-center gap-1 text-gray-600">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: MOOD_COLORS[m.name] }} />
                      {m.name} <span className="text-gray-400">({m.value})</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-soft p-6">
              <h2 className="font-semibold text-moodplum mb-4">All 5 Mood Dimensions — Org Average</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {Object.entries(dashboard.org_indices).map(([key, val]) => (
                  <ScoreDial
                    key={key}
                    score={val}
                    label={key.replace("_index", "").replace(/^\w/, (c) => c.toUpperCase())}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "insights" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-moodplum to-moodviolet rounded-2xl shadow-soft p-6 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={18} className="text-moodgold" />
                <h2 className="font-semibold">Executive Summary</h2>
                {insights && (
                  <span className="text-[10px] uppercase tracking-wide bg-white/15 px-2 py-0.5 rounded-full">
                    {insights.llm_generated ? "AI-generated" : "auto-generated"}
                  </span>
                )}
              </div>
              <p className="text-sm text-moodlilac leading-relaxed">
                {insightsLoading ? "Analyzing organization-wide sentiment..." : insights?.executive_summary}
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-soft p-6">
              <h2 className="font-semibold text-moodplum mb-1">Department-Level Signals</h2>
              <p className="text-sm text-gray-500 mb-4">
                The system identifies significant month-over-month changes and highlights key contributing factors — plus a recommended action for each.
              </p>
              {insightsLoading ? (
                <p className="text-sm text-gray-400">Loading insights...</p>
              ) : !insights || insights.insights.length === 0 ? (
                <p className="text-sm text-gray-400">No significant shifts detected this period.</p>
              ) : (
                <div className="space-y-3">
                  {insights.insights.map((ins, i) => (
                    <div
                      key={i}
                      className={`rounded-xl p-4 border ${
                        ins.severity === "high" ? "border-moodcoral/40 bg-moodcoral/5" : "border-moodgold/40 bg-moodgold/5"
                      }`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="font-semibold text-moodplum">{ins.headline}</p>
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                            ins.severity === "high" ? "bg-moodcoral text-white" : "bg-moodgold text-moodplum"
                          }`}
                        >
                          {ins.severity}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{ins.detail}</p>
                      <p className="text-xs text-moodviolet mt-2 font-medium flex items-center gap-1">
                        <ArrowRight size={12} /> {ins.recommended_action}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "attrition" && attrition && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <KpiCard label="High Risk" value={attrition.high_risk_count} accent="text-moodcoral" />
              <KpiCard label="Medium Risk" value={attrition.medium_risk_count} accent="text-moodgold" />
              <KpiCard label="Low Risk" value={attrition.low_risk_count} accent="text-moodmint" />
            </div>

            {forecastTimeline.length > 0 && (
              <div className="bg-white rounded-2xl shadow-soft p-6">
                <h2 className="font-semibold text-moodplum mb-1">Trend Forecasting</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Actual weekly sentiment score, projected 4 weeks forward based on recent trajectory.
                </p>
                <div style={{ width: "100%", height: 240 }}>
                  <ResponsiveContainer>
                    <ComposedChart data={forecastTimeline} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <GradientDefs />
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEECF6" vertical={false} />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                      <ReferenceLine
                        x={attrition.weekly_history?.[attrition.weekly_history.length - 1]?.week}
                        stroke="#B9A6E0"
                        strokeDasharray="4 4"
                        label={{ value: "Today", position: "top", fontSize: 10, fill: "#7C5CBF" }}
                      />
                      <Area type="monotone" dataKey="actual" name="Actual" stroke="#3D2C5F" fill="url(#gradOverall)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                      <Area
                        type="monotone"
                        dataKey="forecast"
                        name="Forecast"
                        stroke="#7C5CBF"
                        strokeDasharray="6 4"
                        fill="url(#gradForecast)"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-soft p-6">
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search employee by name or email..."
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-moodviolet"
                  />
                </div>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="text-sm rounded-lg border border-gray-200 px-3 py-2 bg-white"
                >
                  <option value="">All departments</option>
                  {departmentOptions.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="text-sm rounded-lg border border-gray-200 px-3 py-2 bg-white"
                >
                  <option value="">All risk levels</option>
                  <option value="High">High risk</option>
                  <option value="Medium">Medium risk</option>
                  <option value="Low">Low risk</option>
                </select>
              </div>

              <h2 className="font-semibold text-moodplum mb-4">
                Employee Risk Ranking <span className="text-gray-400 font-normal text-sm">({attrition.employees.length} shown)</span>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="text-left text-gray-400 text-xs uppercase">
                      <th className="py-2">Employee</th>
                      <th>Department</th>
                      <th>Risk</th>
                      <th className="w-32">Score</th>
                      <th>Tenure</th>
                      <th>Absenteeism</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {attrition.employees.map((e) => (
                      <tr
                        key={e.user_id}
                        className="border-t hover:bg-moodlilac/5 cursor-pointer"
                        onClick={() => setSelectedEmployee(e.user_id)}
                      >
                        <td className="py-2.5 font-medium text-moodplum">{e.full_name}</td>
                        <td className="text-gray-500">{e.department}</td>
                        <td><RiskBadge level={e.risk_level} /></td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold w-8">{e.risk_score}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${e.risk_score}%`,
                                  background: e.risk_level === "High" ? "#F2664B" : e.risk_level === "Medium" ? "#F2B84B" : "#4FD6B9",
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="text-gray-500">{e.tenure_months}mo</td>
                        <td className="text-gray-500">{e.absenteeism_days}d</td>
                        <td className="text-moodviolet text-xs whitespace-nowrap">View →</td>
                      </tr>
                    ))}
                    {attrition.employees.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-gray-400">No employees match this filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "events" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form onSubmit={handleAddEvent} className="bg-white rounded-2xl shadow-soft p-6 space-y-3 h-fit">
              <h2 className="font-semibold text-moodplum">Record a major initiative</h2>
              <p className="text-xs text-gray-400 -mt-2">
                Backdate the event to see its impact immediately using existing check-in history.
              </p>
              <input
                required
                placeholder="Title (e.g. Supply Chain Reorg)"
                value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <textarea
                placeholder="Description"
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                rows={3}
              />
              <select
                value={eventForm.department_id}
                onChange={(e) => setEventForm({ ...eventForm, department_id: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">Organization-wide</option>
                {departmentOptions.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Event date</label>
                <input
                  type="date"
                  value={eventForm.event_date}
                  onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })}
                  max={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button className="w-full bg-moodplum hover:bg-moodviolet text-white rounded-lg py-2 text-sm font-medium transition">
                Add Event
              </button>
            </form>

            <div className="lg:col-span-2 bg-white rounded-2xl shadow-soft p-6">
              <h2 className="font-semibold text-moodplum mb-1">Event Impact Analysis</h2>
              <p className="text-sm text-gray-500 mb-4">
                Expand an event to see real before/after statistics, computed from actual check-in
                data from 30 days before the event through today.
              </p>
              <div className="space-y-3">
                {events.map((e) => (
                  <EventAccordion key={e.id} event={e} />
                ))}
                {events.length === 0 && <p className="text-sm text-gray-400">No events recorded yet.</p>}
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedEmployee && (
        <EmployeeDrilldownModal userId={selectedEmployee} onClose={() => setSelectedEmployee(null)} />
      )}
    </div>
  );
}
