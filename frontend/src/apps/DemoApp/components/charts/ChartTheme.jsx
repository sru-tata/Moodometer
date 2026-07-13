// Shared visual language for every recharts chart in the app: one palette,
// one tooltip style, one set of gradient defs — so the dashboard reads as a
// single designed system instead of a pile of default chart widgets.

export const CHART_COLORS = {
  motivation: "#7C5CBF",
  growth: "#4FD6B9",
  leadership: "#F2B84B",
  workload: "#F2664B",
  belonging: "#3D2C5F",
  overall: "#3D2C5F",
  forecast: "#B9A6E0",
};

export const INDEX_COLOR_MAP = {
  motivation_index: CHART_COLORS.motivation,
  growth_index: CHART_COLORS.growth,
  leadership_index: CHART_COLORS.leadership,
  workload_index: CHART_COLORS.workload,
  belonging_index: CHART_COLORS.belonging,
};

export const MOOD_COLORS = {
  Energized: "#4FD6B9",
  Motivated: "#F2B84B",
  Neutral: "#B9A6E0",
  Stressed: "#F98A5B",
  Frustrated: "#F2664B",
};

export function ChartTooltip({ active, payload, label, suffix = "" }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 px-3.5 py-2.5 text-xs">
      {label && <p className="font-semibold text-moodplum mb-1.5">{label}</p>}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color || p.fill }} />
            <span className="text-gray-500">{p.name}:</span>
            <span className="font-semibold text-moodplum">{p.value}{suffix}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Reusable <defs> block for gradient-filled Area/Bar charts. Drop this once
// inside any chart and reference fill={`url(#${id})`}.
export function GradientDefs() {
  return (
    <defs>
      <linearGradient id="gradMotivation" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={CHART_COLORS.motivation} stopOpacity={0.35} />
        <stop offset="100%" stopColor={CHART_COLORS.motivation} stopOpacity={0} />
      </linearGradient>
      <linearGradient id="gradGrowth" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={CHART_COLORS.growth} stopOpacity={0.35} />
        <stop offset="100%" stopColor={CHART_COLORS.growth} stopOpacity={0} />
      </linearGradient>
      <linearGradient id="gradLeadership" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={CHART_COLORS.leadership} stopOpacity={0.35} />
        <stop offset="100%" stopColor={CHART_COLORS.leadership} stopOpacity={0} />
      </linearGradient>
      <linearGradient id="gradWorkload" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={CHART_COLORS.workload} stopOpacity={0.35} />
        <stop offset="100%" stopColor={CHART_COLORS.workload} stopOpacity={0} />
      </linearGradient>
      <linearGradient id="gradBelonging" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={CHART_COLORS.belonging} stopOpacity={0.35} />
        <stop offset="100%" stopColor={CHART_COLORS.belonging} stopOpacity={0} />
      </linearGradient>
      <linearGradient id="gradOverall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={CHART_COLORS.overall} stopOpacity={0.28} />
        <stop offset="100%" stopColor={CHART_COLORS.overall} stopOpacity={0} />
      </linearGradient>
      <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={CHART_COLORS.forecast} stopOpacity={0.5} />
        <stop offset="100%" stopColor={CHART_COLORS.forecast} stopOpacity={0} />
      </linearGradient>
      <linearGradient id="gradHealthy" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#4FD6B9" stopOpacity={0.4} />
        <stop offset="100%" stopColor="#4FD6B9" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="gradRisk" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F2664B" stopOpacity={0.4} />
        <stop offset="100%" stopColor="#F2664B" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="heatLow" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F2664B" />
        <stop offset="100%" stopColor="#F98A5B" />
      </linearGradient>
      <linearGradient id="heatMid" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F2B84B" />
        <stop offset="100%" stopColor="#F5CE7A" />
      </linearGradient>
      <linearGradient id="heatHigh" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#4FD6B9" />
        <stop offset="100%" stopColor="#7EE3CE" />
      </linearGradient>
    </defs>
  );
}

export function heatGradientId(score) {
  if (score === null || score === undefined) return null;
  if (score >= 70) return "url(#heatHigh)";
  if (score >= 50) return "url(#heatMid)";
  return "url(#heatLow)";
}
