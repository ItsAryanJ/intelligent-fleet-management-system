import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import api from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { useToast } from "@/components/shared/Toast"
import type { Duty, Notice } from "@/types"
import {
  Bus, Clock, Route, MapPin, AlertTriangle, CheckCircle2,
  Gauge, Fuel, Heart, Shield, AlertOctagon, Megaphone,
  ChevronRight, Phone, Navigation, Timer,
} from "lucide-react"

export function DriverDashboard() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Today's duties for the driver
  const { data: myDuties = [], isLoading: dutiesLoading } = useQuery({
    queryKey: ["duties", "my-duties"],
    queryFn: async () => { const res = await api.get("/duties/my-duties"); return res.data as Duty[] },
  })

  // Recent notices
  const { data: notices = [] } = useQuery({
    queryKey: ["notices", "feed", "driver"],
    queryFn: async () => {
      const res = await api.get("/notices/feed")
      return (res.data as Notice[]).slice(0, 3)
    },
  })

  // Acknowledge a duty
  const ackMutation = useMutation({
    mutationFn: async (dutyId: string) => api.post(`/duties/${dutyId}/acknowledge`),
    onSuccess: () => {
      toast({ variant: "success", title: "Duty Acknowledged", description: "You have confirmed your duty assignment." })
      queryClient.invalidateQueries({ queryKey: ["duties", "my-duties"] })
    },
    onError: () => { toast({ variant: "error", title: "Failed", description: "Could not acknowledge duty." }) },
  })

  // Panic button (creates a P1 incident via dedicated panic endpoint with geolocation)
  const panicMutation = useMutation({
    mutationFn: async () => {
      // Attempt to capture real GPS coordinates
      let latitude: number | undefined
      let longitude: number | undefined
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, enableHighAccuracy: true })
        )
        latitude = pos.coords.latitude
        longitude = pos.coords.longitude
      } catch {
        // Geolocation unavailable — send without coordinates
      }
      return api.post("/incidents/panic", null, {
        params: { latitude, longitude },
      })
    },
    onSuccess: () => {
      toast({ variant: "warning", title: "Emergency Reported", description: "Control Center has been alerted." })
    },
    onError: () => {
      toast({ variant: "error", title: "Panic Failed", description: "Could not alert Control Center. Please call emergency services directly." })
    },
  })

  // Report delay (creates a DELAY incident)
  const delayMutation = useMutation({
    mutationFn: async () => api.post("/incidents", {
      incident_type: "DELAY",
      severity: "P3",
      title: `Delay Report — ${myDuties[0]?.route_name || "Unknown Route"}`,
      description: `Driver ${user?.first_name} reports a delay on ${myDuties[0]?.route_name || "route"}.`,
      vehicle_id: myDuties[0]?.vehicle_id || undefined,
    }),
    onSuccess: () => {
      toast({ variant: "info", title: "Delay Reported", description: "Control Center has been notified." })
    },
  })

  const currentDuty = myDuties[0] || null
  const SHIFT_TIMES: Record<string, string> = {
    MORNING: "06:00 — 14:00", AFTERNOON: "14:00 — 22:00",
    EVENING: "18:00 — 02:00", NIGHT: "22:00 — 06:00",
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Driver Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {user?.first_name} {user?.last_name} — {user?.employee_id}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/30">
          <Navigation className="w-3.5 h-3.5" />
          Driver
        </div>
      </div>

      {/* Panic Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        onClick={() => { if (confirm("Are you sure? This will alert the Control Center immediately.")) panicMutation.mutate() }}
        disabled={panicMutation.isPending}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold text-lg shadow-lg shadow-red-500/30 flex items-center justify-center gap-3 transition-all disabled:opacity-50"
      >
        <AlertOctagon className="w-6 h-6" />
        {panicMutation.isPending ? "ALERTING..." : "EMERGENCY PANIC"}
      </motion.button>

      {/* Today's Duty */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-brand-500" />
          Today's Duty
        </h3>
        {dutiesLoading ? (
          <div className="h-24 skeleton rounded-lg" />
        ) : !currentDuty ? (
          <div className="text-center py-8 text-slate-400">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
            <p className="text-sm">No duty assigned for today</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-[10px] font-medium text-slate-400 uppercase">Shift</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">{currentDuty.shift}</p>
                <p className="text-[10px] text-slate-400">{SHIFT_TIMES[currentDuty.shift] || "—"}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-[10px] font-medium text-slate-400 uppercase">Vehicle</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5 flex items-center gap-1"><Bus className="w-3.5 h-3.5 text-blue-500" />{currentDuty.vehicle_reg || "—"}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-[10px] font-medium text-slate-400 uppercase">Route</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5 flex items-center gap-1"><Route className="w-3.5 h-3.5 text-violet-500" />{currentDuty.route_code || "—"}</p>
                <p className="text-[10px] text-slate-400">{currentDuty.route_name || ""}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-[10px] font-medium text-slate-400 uppercase">Status</p>
                <p className={`text-sm font-bold mt-0.5 ${currentDuty.status === "ACKNOWLEDGED" ? "text-emerald-600" : currentDuty.status === "PUBLISHED" ? "text-blue-600" : "text-slate-600"}`}>
                  {currentDuty.status}
                </p>
              </div>
            </div>

            {/* Conductor Info */}
            {currentDuty.conductor_name && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800/30">
                <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center text-white text-xs font-bold">
                  {currentDuty.conductor_name.split(" ").map((n: string) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">Paired Conductor</p>
                  <p className="text-sm text-violet-600 dark:text-violet-400">{currentDuty.conductor_name}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              {currentDuty.status === "PUBLISHED" && (
                <button
                  onClick={() => ackMutation.mutate(currentDuty.id)}
                  disabled={ackMutation.isPending}
                  className="flex-1 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 transition-colors disabled:opacity-50"
                >
                  {ackMutation.isPending ? "Acknowledging..." : "✓ Acknowledge Duty"}
                </button>
              )}
              <button
                onClick={() => delayMutation.mutate()}
                disabled={delayMutation.isPending}
                className="flex-1 py-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm font-semibold hover:bg-amber-200 dark:hover:bg-amber-900/40 transition-colors border border-amber-200 dark:border-amber-800/30 disabled:opacity-50"
              >
                <Timer className="w-4 h-4 inline mr-1" />
                {delayMutation.isPending ? "Reporting..." : "Report Delay"}
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* All Duties Today */}
      {myDuties.length > 1 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">All Duties Today ({myDuties.length})</h3>
          <div className="space-y-2">
            {myDuties.slice(1).map((duty) => (
              <div key={duty.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{duty.shift}</span>
                  <span className="text-xs text-slate-400">{duty.route_code} • {duty.vehicle_reg}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${duty.status === "ACKNOWLEDGED" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                  {duty.status}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Notices */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-500" /> Recent Notices
          </h3>
          <button onClick={() => navigate("/notices")} className="text-xs text-brand-500 font-medium">View All →</button>
        </div>
        {notices.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No new notices</p>
        ) : (
          <div className="space-y-2">
            {notices.map((n) => (
              <div key={n.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${n.priority === "URGENT" ? "bg-red-100 text-red-600" : n.priority === "HIGH" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"}`}>{n.priority}</span>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{n.title}</p>
                </div>
                {n.summary && <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{n.summary}</p>}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => navigate("/incidents")} className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-surface-900 border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all">
          <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600"><AlertTriangle className="w-4 h-4" /></div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Report Incident</span>
        </button>
        <button onClick={() => navigate("/avls")} className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-surface-900 border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all">
          <div className="p-2.5 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600"><MapPin className="w-4 h-4" /></div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Route Map</span>
        </button>
      </div>
    </div>
  )
}
