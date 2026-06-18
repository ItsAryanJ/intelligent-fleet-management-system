import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import api from "@/lib/api"
import {
  BarChart3, TrendingUp, AlertTriangle, Users, Bus,
  Award, Shield, Clock,
} from "lucide-react"
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts"

export function AnalyticsPage() {
  const { data: fleetData } = useQuery({
    queryKey: ["analytics", "fleet-utilization"],
    queryFn: async () => {
      const res = await api.get("/analytics/fleet-utilization")
      return res.data
    },
  })

  const { data: incidentData } = useQuery({
    queryKey: ["analytics", "incidents"],
    queryFn: async () => {
      const res = await api.get("/analytics/incidents")
      return res.data
    },
  })

  const { data: driverData } = useQuery({
    queryKey: ["analytics", "driver-performance"],
    queryFn: async () => {
      const res = await api.get("/analytics/driver-performance")
      return res.data
    },
  })

  const fleetChart = Object.entries(fleetData?.status_breakdown || {}).map(([name, value]) => ({
    name, value: value as number,
  }))

  const incidentByType = Object.entries(incidentData?.by_type || {}).map(([name, value]) => ({
    name, count: value as number,
  }))

  const incidentBySeverity = Object.entries(incidentData?.by_severity || {}).map(([name, value]) => ({
    name, value: value as number,
  }))

  const drivers = (driverData?.drivers || []).slice(0, 10)

  const COLORS = ["#10b981", "#64748b", "#f59e0b", "#ef4444", "#6366f1"]

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Operations Analytics</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Performance insights and operational metrics
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fleet Status Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Bus className="w-4 h-4 text-brand-500" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Fleet Status Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={fleetChart} cx="50%" cy="50%" innerRadius={65} outerRadius={105} paddingAngle={3} dataKey="value">
                {fleetChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e2e8f0", fontSize: "12px" }} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-slate-400">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Incidents by Type */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Incidents by Type (30 days)</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={incidentByType} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} width={120} />
              <Tooltip contentStyle={{ backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e2e8f0", fontSize: "12px" }} />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Incident Severity Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Severity Breakdown</h3>
          </div>
          <div className="space-y-4">
            {incidentBySeverity.map((item) => {
              const total = incidentBySeverity.reduce((s, i) => s + i.value, 0) || 1
              const pct = ((item.value / total) * 100).toFixed(1)
              const color = item.name === "P1" ? "#ef4444" : item.name === "P2" ? "#f59e0b" : "#3b82f6"
              return (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.name}</span>
                    <span className="text-sm font-bold" style={{ color }}>{item.value} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Driver Performance Rankings */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Driver Performance Rankings</h3>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {drivers.map((driver: any) => (
              <div key={driver.driver_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  driver.rank <= 3 ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                }`}>
                  {driver.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{driver.name}</p>
                  <p className="text-[10px] text-slate-500">{driver.employee_id}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-600 dark:text-brand-400">{driver.overall_score}</p>
                  <p className="text-[10px] text-slate-500">score</p>
                </div>
              </div>
            ))}
            {drivers.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">No driver data available</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
