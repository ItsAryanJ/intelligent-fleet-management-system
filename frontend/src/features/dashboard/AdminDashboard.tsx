import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import api from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import type { KPI } from "@/types"
import {
  Bus, AlertTriangle, CheckCircle2, Clock, Users, Route,
  TrendingUp, Activity, Calendar, BarChart3, Zap, Shield,
  Database, Server, UserCog, Settings, Bell, MapPin,
} from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"

const INCIDENT_TYPE_COLORS: Record<string, string> = {
  BREAKDOWN: "#ef4444", DELAY: "#f59e0b", ACCIDENT: "#dc2626",
  COMPLAINT: "#8b5cf6", SECURITY: "#f97316", ROUTE_DEVIATION: "#06b6d4", OTHER: "#64748b",
}

export function AdminDashboard() {
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

  const { data: fleetData } = useQuery({
    queryKey: ["analytics", "fleet-utilization"],
    queryFn: async () => { const res = await api.get("/analytics/fleet-utilization"); return res.data },
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
  const statusBreakdown = Object.entries(fleetData?.status_breakdown || {}).map(
    ([name, value]) => ({ name, value: value as number })
  )

  const ADMIN_KPIS = [
    { key: "total_vehicles", label: "Total Fleet", icon: Bus, color: "from-blue-500 to-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
    { key: "active_vehicles", label: "Active Now", icon: Activity, color: "from-emerald-500 to-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
    { key: "total_users", label: "Total Users", icon: Users, color: "from-violet-500 to-violet-600", bg: "bg-violet-50 dark:bg-violet-900/20" },
    { key: "total_depots", label: "Depots", icon: MapPin, color: "from-orange-500 to-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
    { key: "open_incidents", label: "Open Incidents", icon: AlertTriangle, color: "from-amber-500 to-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
    { key: "sla_breached_30d", label: "SLA Breached", icon: Shield, color: "from-red-500 to-red-600", bg: "bg-red-50 dark:bg-red-900/20" },
    { key: "total_routes", label: "Active Routes", icon: Route, color: "from-cyan-500 to-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-900/20" },
    { key: "todays_duties", label: "Today's Duties", icon: Calendar, color: "from-pink-500 to-pink-600", bg: "bg-pink-50 dark:bg-pink-900/20" },
  ]

  const QUICK_ACTIONS = [
    { label: "User Management", icon: UserCog, path: "/users", color: "text-violet-600 bg-violet-50 dark:bg-violet-900/20" },
    { label: "Fleet Vehicles", icon: Bus, path: "/vehicles", color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
    { label: "Incidents", icon: AlertTriangle, path: "/incidents", color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
    { label: "Analytics", icon: BarChart3, path: "/analytics", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" },
    { label: "Live Fleet", icon: MapPin, path: "/avls", color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20" },
    { label: "Duty Schedule", icon: Calendar, path: "/duties", color: "text-pink-600 bg-pink-50 dark:bg-pink-900/20" },
  ]

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Admin Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            System-wide operations overview — Welcome, {user?.first_name}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-semibold border border-red-200 dark:border-red-800/30">
          <Shield className="w-3.5 h-3.5" />
          Administrator
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {ADMIN_KPIS.map((card, idx) => (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            className="kpi-card group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {(kpis as any)[card.key]?.toLocaleString() ?? 0}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{card.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl hover:shadow-md transition-all border border-slate-100 dark:border-slate-800 hover:border-brand-200 dark:hover:border-brand-800"
            >
              <div className={`p-3 rounded-xl ${action.color}`}>
                <action.icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{action.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Operations Trend */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="lg:col-span-2 bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Operations Trend (7-Day)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trendChartData}>
              <defs>
                <linearGradient id="adminColorUtil" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="adminColorDuties" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e2e8f0", fontSize: "12px" }} />
              <Legend />
              <Area type="monotone" dataKey="utilization" name="Utilization %" stroke="#6366f1" fill="url(#adminColorUtil)" strokeWidth={2} />
              <Area type="monotone" dataKey="duties" name="Duties" stroke="#10b981" fill="url(#adminColorDuties)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Incident Breakdown */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Incidents by Type</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={incidentTypeData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                {incidentTypeData.map((entry) => (<Cell key={entry.name} fill={entry.color} />))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e2e8f0", fontSize: "12px" }} />
              <Legend iconType="circle" iconSize={8} formatter={(value) => <span className="text-xs text-slate-400">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Fleet Status Breakdown */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Fleet Status Breakdown</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={statusBreakdown}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} />
            <Tooltip contentStyle={{ backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e2e8f0", fontSize: "12px" }} />
            <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  )
}
