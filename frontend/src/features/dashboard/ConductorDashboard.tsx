import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import api from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { useToast } from "@/components/shared/Toast"
import type { Duty, Notice } from "@/types"
import {
  Clock, Route, Megaphone, AlertTriangle, CheckCircle2,
  Users, Ticket, FileText, MessageSquare, UserCheck,
  ChevronRight, ClipboardList, Shield,
} from "lucide-react"

export function ConductorDashboard() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Today's duties
  const { data: myDuties = [], isLoading: dutiesLoading } = useQuery({
    queryKey: ["duties", "my-duties"],
    queryFn: async () => { const res = await api.get("/duties/my-duties"); return res.data as Duty[] },
  })

  // Notices for conductor
  const { data: notices = [] } = useQuery({
    queryKey: ["notices", "feed", "conductor"],
    queryFn: async () => {
      const res = await api.get("/notices/feed")
      return (res.data as Notice[]).slice(0, 4)
    },
  })

  // My recent incidents
  const { data: myIncidents } = useQuery({
    queryKey: ["incidents", "mine"],
    queryFn: async () => {
      const res = await api.get("/incidents", { params: { page_size: 5 } })
      return res.data
    },
  })

  // Acknowledge
  const ackMutation = useMutation({
    mutationFn: async (dutyId: string) => api.post(`/duties/${dutyId}/acknowledge`),
    onSuccess: () => {
      toast({ variant: "success", title: "Duty Acknowledged", description: "You have confirmed your duty." })
      queryClient.invalidateQueries({ queryKey: ["duties", "my-duties"] })
    },
  })

  // Report passenger complaint
  const complaintMutation = useMutation({
    mutationFn: async () => api.post("/incidents", {
      incident_type: "COMPLAINT",
      severity: "P3",
      title: `Passenger Complaint — ${myDuties[0]?.route_name || "Route"}`,
      description: `Conductor ${user?.first_name} reporting a passenger complaint on ${myDuties[0]?.route_name || "route"}.`,
      vehicle_id: myDuties[0]?.vehicle_id || undefined,
    }),
    onSuccess: () => {
      toast({ variant: "info", title: "Complaint Logged", description: "Complaint has been submitted to Control Center." })
    },
  })

  // Report security issue
  const securityMutation = useMutation({
    mutationFn: async () => api.post("/incidents", {
      incident_type: "SECURITY",
      severity: "P2",
      title: `Security Issue — ${myDuties[0]?.route_name || "Route"}`,
      description: `Conductor ${user?.first_name} reports a security concern.`,
      vehicle_id: myDuties[0]?.vehicle_id || undefined,
    }),
    onSuccess: () => {
      toast({ variant: "warning", title: "Security Alert Sent", description: "Control Center has been notified." })
    },
  })

  const currentDuty = myDuties[0] || null
  const recentIncidents = myIncidents?.items || []
  const SHIFT_TIMES: Record<string, string> = {
    MORNING: "06:00 — 14:00", AFTERNOON: "14:00 — 22:00",
    EVENING: "18:00 — 02:00", NIGHT: "22:00 — 06:00",
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Conductor Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {user?.first_name} {user?.last_name} — {user?.employee_id}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 text-xs font-semibold border border-violet-200 dark:border-violet-800/30">
          <Ticket className="w-3.5 h-3.5" />
          Conductor
        </div>
      </div>

      {/* Today's Duty Card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-brand-500" /> Today's Assignment
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
                <p className="text-[10px] font-medium text-slate-400 uppercase">Route</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5 flex items-center gap-1">
                  <Route className="w-3.5 h-3.5 text-violet-500" />{currentDuty.route_code || "—"}
                </p>
                <p className="text-[10px] text-slate-400">{currentDuty.route_name || ""}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-[10px] font-medium text-slate-400 uppercase">Vehicle</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">{currentDuty.vehicle_reg || "—"}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-[10px] font-medium text-slate-400 uppercase">Status</p>
                <p className={`text-sm font-bold mt-0.5 ${currentDuty.status === "ACKNOWLEDGED" ? "text-emerald-600" : "text-blue-600"}`}>
                  {currentDuty.status}
                </p>
              </div>
            </div>

            {/* Paired Driver Info */}
            {currentDuty.driver_name && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">
                  {currentDuty.driver_name.split(" ").map((n: string) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Paired Driver</p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">{currentDuty.driver_name}</p>
                </div>
                <UserCheck className="w-4 h-4 text-emerald-400 ml-auto" />
              </div>
            )}

            {/* Actions */}
            {currentDuty.status === "PUBLISHED" && (
              <button
                onClick={() => ackMutation.mutate(currentDuty.id)}
                disabled={ackMutation.isPending}
                className="w-full py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 transition-colors disabled:opacity-50"
              >
                {ackMutation.isPending ? "Acknowledging..." : "✓ Acknowledge Duty"}
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* Quick Report Actions (Conductor-Specific) */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-violet-500" /> Quick Report
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => complaintMutation.mutate()}
            disabled={complaintMutation.isPending}
            className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50"
          >
            <MessageSquare className="w-5 h-5 text-amber-600" />
            <div className="text-left">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Passenger Complaint</p>
              <p className="text-[10px] text-amber-500">Log a complaint from a passenger</p>
            </div>
          </button>
          <button
            onClick={() => securityMutation.mutate()}
            disabled={securityMutation.isPending}
            className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            <Shield className="w-5 h-5 text-red-600" />
            <div className="text-left">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">Security Issue</p>
              <p className="text-[10px] text-red-500">Report a security concern</p>
            </div>
          </button>
          <button
            onClick={() => navigate("/incidents")}
            className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors"
          >
            <AlertTriangle className="w-5 h-5 text-blue-600" />
            <div className="text-left">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">General Incident</p>
              <p className="text-[10px] text-blue-500">Open full incident form</p>
            </div>
          </button>
        </div>
      </motion.div>

      {/* Notices & Announcements */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-500" /> Passenger Notices & Announcements
          </h3>
          <button onClick={() => navigate("/notices")} className="text-xs text-brand-500 font-medium">View All →</button>
        </div>
        {notices.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No notices</p>
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

      {/* My Recent Reports */}
      {recentIncidents.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" /> My Recent Reports
          </h3>
          <div className="space-y-2">
            {recentIncidents.slice(0, 3).map((inc: any) => (
              <div key={inc.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">{inc.incident_no}</span>
                  <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{inc.title}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${inc.status === "RESOLVED" || inc.status === "CLOSED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {inc.status}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
