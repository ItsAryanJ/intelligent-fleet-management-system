import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import api from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import type { Incident } from "@/types"
import {
  AlertTriangle, Shield, Timer, Activity, Bus, MapPin,
  Radio, Clock, Zap, Eye, ChevronRight, CheckCircle2,
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export function ControlOperatorDashboard() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const { data: analyticsData } = useQuery({
    queryKey: ["analytics", "executive"],
    queryFn: async () => { const res = await api.get("/analytics/executive"); return res.data },
  })

  const { data: slaData } = useQuery({
    queryKey: ["incidents", "sla"],
    queryFn: async () => { const res = await api.get("/incidents/sla-status"); return res.data },
  })

  const { data: incidentsData } = useQuery({
    queryKey: ["incidents", "control", "open"],
    queryFn: async () => {
      const res = await api.get("/incidents", { params: { status: "OPEN", page_size: 5 } })
      return res.data
    },
    refetchInterval: 15000,
  })

  const { data: trendData } = useQuery({
    queryKey: ["analytics", "trend"],
    queryFn: async () => { const res = await api.get("/analytics/trend"); return res.data },
  })

  const kpis = analyticsData?.kpis || {}
  const openIncidents: Incident[] = incidentsData?.items || []
  const trendChartData = trendData?.trend || []

  const SEVERITY_DOTS: Record<string, string> = {
    P1: "bg-red-500 animate-pulse", P2: "bg-amber-500", P3: "bg-blue-500",
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Control Center</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time operations monitoring — {user?.first_name}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-200 dark:border-blue-800/30">
          <Radio className="w-3.5 h-3.5" />
          Control Operator
        </div>
      </div>

      {/* SLA Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-red-500" />
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">SLA Breached</span>
          </div>
          <p className="text-3xl font-bold text-red-700 dark:text-red-300">{slaData?.breached?.count || 0}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
          <div className="flex items-center gap-2 mb-2">
            <Timer className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">At Risk</span>
          </div>
          <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">{slaData?.at_risk?.count || 0}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">On Track</span>
          </div>
          <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{slaData?.on_track?.count || 0}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Active Vehicles</span>
          </div>
          <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{kpis.active_vehicles || 0}<span className="text-lg text-blue-400">/{kpis.total_vehicles || 0}</span></p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Incident Feed */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Open Incidents (Live)
            </h3>
            <button onClick={() => navigate("/incidents")} className="text-xs text-brand-500 hover:text-brand-400 font-medium">View All →</button>
          </div>
          <div className="space-y-3">
            {openIncidents.length === 0 && (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No open incidents</p>
              </div>
            )}
            {openIncidents.map((inc) => (
              <div key={inc.id}
                onClick={() => navigate("/incidents")}
                className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors">
                <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${SEVERITY_DOTS[inc.severity] || "bg-slate-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{inc.incident_no}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">{inc.severity}</span>
                    {inc.sla_breached && <span className="text-[10px] font-bold text-red-500 animate-pulse">SLA!</span>}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">{inc.title}</p>
                  {inc.vehicle_reg && <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1"><Bus className="w-3 h-3" />{inc.vehicle_reg}</span>}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Daily Operations Chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Daily Incident Volume</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e2e8f0", fontSize: "12px" }} />
              <Bar dataKey="incidents" name="Incidents" fill="#ef4444" radius={[6, 6, 0, 0]} />
              <Bar dataKey="duties" name="Duties" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Open Live Map", icon: MapPin, path: "/avls", color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20" },
          { label: "Report Incident", icon: AlertTriangle, path: "/incidents", color: "text-red-600 bg-red-50 dark:bg-red-900/20" },
          { label: "Duty Schedule", icon: Clock, path: "/duties", color: "text-violet-600 bg-violet-50 dark:bg-violet-900/20" },
          { label: "Notices", icon: Eye, path: "/notices", color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
        ].map((action) => (
          <button key={action.path} onClick={() => navigate(action.path)}
            className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-surface-900 border border-slate-200 dark:border-slate-800 hover:shadow-md hover:border-brand-200 dark:hover:border-brand-800 transition-all">
            <div className={`p-2.5 rounded-lg ${action.color}`}><action.icon className="w-4 h-4" /></div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
