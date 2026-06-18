import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import api from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import type { KPI } from "@/types"
import {
  Bus, AlertTriangle, CheckCircle2, Users, Route,
  TrendingUp, Activity, Calendar, BarChart3, Zap,
  Crown, Eye, Shield,
} from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"

const INCIDENT_TYPE_COLORS: Record<string, string> = {
  BREAKDOWN: "#ef4444", DELAY: "#f59e0b", ACCIDENT: "#dc2626",
  COMPLAINT: "#8b5cf6", SECURITY: "#f97316", ROUTE_DEVIATION: "#06b6d4", OTHER: "#64748b",
}

const SEVERITY_COLORS: Record<string, string> = {
  P1: "#ef4444", P2: "#f59e0b", P3: "#3b82f6",
}

export function ExecutiveDashboard() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const { data: analyticsData } = useQuery({
    queryKey: ["analytics", "executive"],
    queryFn: async () => { const res = await api.get("/analytics/executive"); return res.data },
  })

  const { data: trendData } = useQuery({
    queryKey: ["analytics", "trend"],
    queryFn: async () => { const res = await api.get("/analytics/trend"); return res.data },
  })

  const { data: incidentAnalytics } = useQuery({
    queryKey: ["analytics", "incidents"],
    queryFn: async () => { const res = await api.get("/analytics/incidents"); return res.data },
  })

  const { data: driverPerf } = useQuery({
    queryKey: ["analytics", "driver-performance"],
    queryFn: async () => { const res = await api.get("/analytics/driver-performance"); return res.data },
  })

  const { data: insightsData } = useQuery({
    queryKey: ["copilot", "insights"],
    queryFn: async () => { const res = await api.get("/copilot/insights"); return res.data },
  })

  const kpis: KPI = analyticsData?.kpis || {
    total_vehicles: 0, active_vehicles: 0, utilization_percent: 0,
    open_incidents: 0, resolution_rate: 0, sla_breached_30d: 0,
    total_users: 0, total_routes: 0, total_depots: 0, todays_duties: 0,
  }

  const trendChartData = trendData?.trend || []
  const incidentTypeData = Object.entries(incidentAnalytics?.by_type || {}).map(
    ([name, value]) => ({ name, value: value as number, color: INCIDENT_TYPE_COLORS[name] || "#64748b" })
  )
  const severityData = Object.entries(incidentAnalytics?.by_severity || {}).map(
    ([name, value]) => ({ name, value: value as number, color: SEVERITY_COLORS[name] || "#64748b" })
  )
  const topDrivers = (driverPerf?.drivers || []).slice(0, 5)
  const insights = insightsData?.insights || []

  const EXEC_KPIS = [
    { key: "utilization_percent", label: "Fleet Utilization", icon: TrendingUp, suffix: "%", color: "from-violet-500 to-violet-600 text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/20" },
    { key: "resolution_rate", label: "Incident Resolution", icon: CheckCircle2, suffix: "%", color: "from-emerald-500 to-emerald-600 text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
    { key: "open_incidents", label: "Open Incidents", icon: AlertTriangle, color: "from-amber-500 to-amber-600 text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
    { key: "sla_breached_30d", label: "SLA Breached (30d)", icon: Shield, color: "from-red-500 to-red-600 text-red-600", bg: "bg-red-50 dark:bg-red-900/20" },
    { key: "total_vehicles", label: "Total Fleet", icon: Bus, color: "from-blue-500 to-blue-600 text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
    { key: "total_users", label: "Workforce", icon: Users, color: "from-orange-500 to-orange-600 text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
  ]

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Executive Overview</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Strategic operations summary — {user?.first_name}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-semibold border border-amber-200 dark:border-amber-800/30">
          <Crown className="w-3.5 h-3.5" />
          Executive
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {EXEC_KPIS.map((card, idx) => (
          <motion.div key={card.key}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
            className="p-4 rounded-xl bg-white dark:bg-surface-900 border border-slate-200 dark:border-slate-800">
            <div className={`inline-flex p-2 rounded-lg ${card.bg} mb-3`}>
              <card.icon className={`w-4 h-4 ${card.color.split(" ").pop()}`} />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {(kpis as any)[card.key]?.toLocaleString() ?? 0}{card.suffix || ""}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{card.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Operations Trend */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Operations Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trendChartData}>
              <defs>
                <linearGradient id="execUtil" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="execDuties" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e2e8f0", fontSize: "12px" }} />
              <Legend />
              <Area type="monotone" dataKey="utilization" name="Utilization %" stroke="#6366f1" fill="url(#execUtil)" strokeWidth={2} />
              <Area type="monotone" dataKey="duties" name="Duties" stroke="#10b981" fill="url(#execDuties)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Incident Severity Distribution */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Incidents by Severity</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={severityData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                {severityData.map((entry) => (<Cell key={entry.name} fill={entry.color} />))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e2e8f0", fontSize: "12px" }} />
              <Legend iconType="circle" iconSize={8} formatter={(value) => <span className="text-xs text-slate-400">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Drivers */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Top Performing Drivers</h3>
          {topDrivers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No driver data available</p>
          ) : (
            <div className="space-y-3">
              {topDrivers.map((driver: any) => (
                <div key={driver.driver_id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${driver.rank <= 3 ? "bg-gradient-to-br from-amber-500 to-amber-600" : "bg-slate-400"}`}>
                      {driver.rank}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">{driver.name}</p>
                      <p className="text-[10px] text-slate-400">{driver.employee_id} • {driver.total_duties} duties</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-brand-600 dark:text-brand-400">{driver.overall_score}</p>
                    <p className="text-[10px] text-slate-400">Score</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Incident by Type */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Incidents by Category</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={incidentTypeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} width={100} />
              <Tooltip contentStyle={{ backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e2e8f0", fontSize: "12px" }} />
              <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* AI Insights */}
      {insights.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20"><Zap className="w-4 h-4 text-brand-500" /></div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">AI Insights</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.map((insight: any, idx: number) => (
              <div key={idx}
                className={`p-4 rounded-lg border ${insight.type === "warning" ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30" : insight.type === "success" ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30" : "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30"}`}>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{insight.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{insight.description}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Full Analytics", icon: BarChart3, path: "/analytics", color: "text-violet-600 bg-violet-50 dark:bg-violet-900/20" },
          { label: "Fleet Overview", icon: Bus, path: "/vehicles", color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
          { label: "AI Copilot", icon: Zap, path: "/copilot", color: "text-brand-600 bg-brand-50 dark:bg-brand-900/20" },
        ].map((a) => (
          <button key={a.path} onClick={() => navigate(a.path)}
            className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-surface-900 border border-slate-200 dark:border-slate-800 hover:shadow-md hover:border-brand-200 dark:hover:border-brand-800 transition-all">
            <div className={`p-2.5 rounded-lg ${a.color}`}><a.icon className="w-4 h-4" /></div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
