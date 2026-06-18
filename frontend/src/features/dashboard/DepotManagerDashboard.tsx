import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import api from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import {
  Bus, AlertTriangle, Users, Calendar, TrendingUp, Activity,
  MapPin, Warehouse, CheckCircle2, Clock, Wrench,
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"

const VEHICLE_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#10b981", IDLE: "#6366f1", MAINTENANCE: "#f59e0b",
  BREAKDOWN: "#ef4444", OUT_OF_SERVICE: "#64748b",
}

export function DepotManagerDashboard() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const depotId = user?.depot_id

  const { data: depotAnalytics } = useQuery({
    queryKey: ["analytics", "depot", depotId],
    queryFn: async () => {
      if (!depotId) return null
      const res = await api.get(`/analytics/depot/${depotId}`)
      return res.data
    },
    enabled: !!depotId,
  })

  const { data: analyticsData } = useQuery({
    queryKey: ["analytics", "executive"],
    queryFn: async () => { const res = await api.get("/analytics/executive"); return res.data },
  })

  const { data: fleetData } = useQuery({
    queryKey: ["analytics", "fleet-utilization"],
    queryFn: async () => { const res = await api.get("/analytics/fleet-utilization"); return res.data },
  })

  const { data: trendData } = useQuery({
    queryKey: ["analytics", "trend"],
    queryFn: async () => { const res = await api.get("/analytics/trend"); return res.data },
  })

  const kpis = analyticsData?.kpis || {}
  const depot = depotAnalytics || {}
  const trendChartData = trendData?.trend || []
  const statusBreakdown = Object.entries(fleetData?.status_breakdown || {}).map(
    ([name, value]) => ({ name, value: value as number, color: VEHICLE_STATUS_COLORS[name] || "#64748b" })
  )

  const DEPOT_KPIS = [
    { label: "Depot Vehicles", value: depot.total_vehicles || kpis.total_vehicles || 0, icon: Bus, color: "bg-blue-50 dark:bg-blue-900/20 text-blue-600" },
    { label: "Active Now", value: depot.active_vehicles || kpis.active_vehicles || 0, icon: Activity, color: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" },
    { label: "Utilization", value: `${depot.utilization_percent || kpis.utilization_percent || 0}%`, icon: TrendingUp, color: "bg-violet-50 dark:bg-violet-900/20 text-violet-600" },
    { label: "Depot Staff", value: depot.total_users || "—", icon: Users, color: "bg-orange-50 dark:bg-orange-900/20 text-orange-600" },
    { label: "Open Incidents", value: kpis.open_incidents || 0, icon: AlertTriangle, color: "bg-amber-50 dark:bg-amber-900/20 text-amber-600" },
    { label: "Today's Duties", value: kpis.todays_duties || 0, icon: Calendar, color: "bg-pink-50 dark:bg-pink-900/20 text-pink-600" },
  ]

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Depot Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {user?.depot_name || "All Depots"} — Managed by {user?.first_name}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs font-semibold border border-amber-200 dark:border-amber-800/30">
          <Warehouse className="w-3.5 h-3.5" />
          Depot Manager
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {DEPOT_KPIS.map((kpi, idx) => (
          <motion.div key={kpi.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
            className="p-4 rounded-xl bg-white dark:bg-surface-900 border border-slate-200 dark:border-slate-800">
            <div className={`inline-flex p-2 rounded-lg ${kpi.color} mb-3`}>
              <kpi.icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{kpi.value}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{kpi.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vehicle Status Breakdown */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Vehicle Status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                {statusBreakdown.map((entry) => (<Cell key={entry.name} fill={entry.color} />))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e2e8f0", fontSize: "12px" }} />
              <Legend iconType="circle" iconSize={8} formatter={(value) => <span className="text-xs text-slate-400">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Weekly Duty Trend */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Duty Allocation (7-Day)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e2e8f0", fontSize: "12px" }} />
              <Bar dataKey="duties" name="Duties" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              <Bar dataKey="incidents" name="Incidents" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Manage Vehicles", icon: Bus, path: "/vehicles", color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
          { label: "Duty Schedule", icon: Calendar, path: "/duties", color: "text-violet-600 bg-violet-50 dark:bg-violet-900/20" },
          { label: "Incidents", icon: AlertTriangle, path: "/incidents", color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
          { label: "Staff", icon: Users, path: "/users", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" },
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
