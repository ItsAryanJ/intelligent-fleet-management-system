import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import api from "@/lib/api"
import {
  Activity, Cpu, HardDrive, MemoryStick, Clock,
  Database, Wifi, MapPin, Route, Server,
} from "lucide-react"

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className={`h-full rounded-full ${color}`}
      />
    </div>
  )
}

export function SystemHealthPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["system-health"],
    queryFn: async () => { const res = await api.get("/system/health"); return res.data },
    refetchInterval: 15000,
  })

  const sys = data?.system || {}
  const services = data?.services || {}

  const memPercent = sys.memory_percent || 0
  const cpuPercent = sys.cpu_percent || 0
  const diskPercent = sys.disk_percent || 0

  const SERVICE_ICONS: Record<string, any> = {
    database: Database, redis: Server, websocket: Wifi,
    geofence_engine: MapPin, route_deviation_engine: Route,
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">System Health</h1>
        <p className="text-sm text-slate-500 mt-1">Real-time infrastructure monitoring</p>
      </div>

      {/* Status Banner */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className={`p-4 rounded-xl flex items-center gap-3 ${data?.status === "healthy" ? "bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30" : "bg-red-50 dark:bg-red-900/10 border border-red-200"}`}>
        <div className={`w-3 h-3 rounded-full ${data?.status === "healthy" ? "bg-emerald-500 animate-pulse-dot" : "bg-red-500"}`} />
        <div>
          <p className={`text-sm font-bold ${data?.status === "healthy" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700"}`}>
            System {data?.status === "healthy" ? "Operational" : "Degraded"}
          </p>
          <p className="text-[11px] text-slate-500">v{data?.version || "—"} • {data?.environment || "—"}</p>
        </div>
      </motion.div>

      {/* Resource Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-bold text-slate-500 uppercase">CPU</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{cpuPercent}%</p>
          <ProgressBar value={cpuPercent} color={cpuPercent > 80 ? "bg-red-500" : cpuPercent > 50 ? "bg-amber-500" : "bg-blue-500"} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="p-5 bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <MemoryStick className="w-4 h-4 text-violet-500" />
            <span className="text-xs font-bold text-slate-500 uppercase">Memory</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{memPercent}%</p>
          <p className="text-[11px] text-slate-400 mb-2">{sys.memory_used_gb || 0} / {sys.memory_total_gb || 0} GB</p>
          <ProgressBar value={memPercent} color={memPercent > 85 ? "bg-red-500" : memPercent > 60 ? "bg-amber-500" : "bg-violet-500"} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="p-5 bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <HardDrive className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold text-slate-500 uppercase">Disk</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{diskPercent}%</p>
          <p className="text-[11px] text-slate-400 mb-2">{sys.disk_used_gb || 0} / {sys.disk_total_gb || 0} GB</p>
          <ProgressBar value={diskPercent} color={diskPercent > 90 ? "bg-red-500" : diskPercent > 70 ? "bg-amber-500" : "bg-emerald-500"} />
        </motion.div>
      </div>

      {/* Uptime */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="p-4 bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20">
          <Clock className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">System Uptime</p>
          <p className="text-xs text-slate-400">{sys.uptime_hours ? `${Math.floor(sys.uptime_hours / 24)}d ${Math.round(sys.uptime_hours % 24)}h` : "—"}</p>
        </div>
      </motion.div>

      {/* Services */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-brand-500" /> Services
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(services).map(([name, status]) => {
            const Icon = SERVICE_ICONS[name] || Server
            const isActive = status === "connected" || status === "active"
            return (
              <div key={name} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className={`p-2 rounded-lg ${isActive ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
                  <Icon className={`w-4 h-4 ${isActive ? "text-emerald-500" : "text-red-500"}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-white capitalize">{name.replace(/_/g, " ")}</p>
                </div>
                <span className={`w-2.5 h-2.5 rounded-full ${isActive ? "bg-emerald-500 animate-pulse-dot" : "bg-red-500"}`} />
              </div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
