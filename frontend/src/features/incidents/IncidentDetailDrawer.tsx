import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import api from "@/lib/api"
import { useToast } from "@/components/shared/Toast"
import { useAuthStore } from "@/store/auth"
import type { Incident, IncidentEvent } from "@/types"
import {
  X, Clock, User, Bus, MapPin, Shield, Timer,
  CheckCircle2, AlertTriangle, Send, UserPlus, Loader2,
} from "lucide-react"

interface Props {
  incidentId: string | null
  onClose: () => void
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-500",
  ACKNOWLEDGED: "bg-amber-500",
  ASSIGNED: "bg-blue-500",
  IN_PROGRESS: "bg-violet-500",
  RESOLVED: "bg-emerald-500",
  CLOSED: "bg-slate-500",
}

const EVENT_ICONS: Record<string, typeof Clock> = {
  created: AlertTriangle,
  assigned: UserPlus,
  acknowledged: CheckCircle2,
  resolved: CheckCircle2,
  panic: Shield,
  note: Send,
}

export function IncidentDetailDrawer({ incidentId, onClose }: Props) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [noteText, setNoteText] = useState("")
  const [resolveNotes, setResolveNotes] = useState("")
  const [showResolve, setShowResolve] = useState(false)

  const { data: incident, isLoading } = useQuery({
    queryKey: ["incident", incidentId],
    queryFn: async () => {
      const res = await api.get(`/incidents/${incidentId}`)
      return res.data as Incident & { events: IncidentEvent[] }
    },
    enabled: !!incidentId,
  })

  const addEventMutation = useMutation({
    mutationFn: async (data: { event_type: string; description: string }) =>
      api.post(`/incidents/${incidentId}/events`, data),
    onSuccess: () => {
      toast({ variant: "success", title: "Note added", description: "Timeline updated." })
      setNoteText("")
      queryClient.invalidateQueries({ queryKey: ["incident", incidentId] })
    },
    onError: (err: any) => {
      toast({ variant: "error", title: "Error", description: err.response?.data?.detail || "Failed to add note." })
    },
  })

  const resolveMutation = useMutation({
    mutationFn: async () =>
      api.post(`/incidents/${incidentId}/resolve`, { status: "RESOLVED", notes: resolveNotes }),
    onSuccess: () => {
      toast({ variant: "success", title: "Incident resolved", description: "SLA tracking stopped." })
      setShowResolve(false)
      setResolveNotes("")
      queryClient.invalidateQueries({ queryKey: ["incident", incidentId] })
      queryClient.invalidateQueries({ queryKey: ["incidents"] })
    },
    onError: (err: any) => {
      toast({ variant: "error", title: "Error", description: err.response?.data?.detail || "Failed to resolve." })
    },
  })

  if (!incidentId) return null

  return (
    <AnimatePresence>
      <motion.div
        key="incident-drawer-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        key="incident-drawer"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-full w-full max-w-lg z-50 bg-white dark:bg-surface-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          </div>
        ) : incident ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/90 dark:bg-surface-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-bold text-slate-800 dark:text-white">
                    {incident.incident_no}
                  </span>
                  <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[incident.status] || "bg-slate-400"} ${incident.sla_breached ? "animate-pulse" : ""}`} />
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {incident.status.replace("_", " ")}
                  </span>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <h2 className="text-base font-semibold text-slate-800 dark:text-white mt-3">
                {incident.title}
              </h2>

              {incident.sla_breached && (
                <div className="mt-2 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse inline-block">
                  ⚠️ SLA BREACHED
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 p-5 space-y-6">
              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3">
                <DetailItem icon={Shield} label="Severity" value={incident.severity} />
                <DetailItem icon={AlertTriangle} label="Type" value={incident.incident_type.replace("_", " ")} />
                <DetailItem icon={User} label="Reported By" value={incident.reported_by_name || "—"} />
                <DetailItem icon={UserPlus} label="Assigned To" value={incident.assigned_to_name || "Unassigned"} />
                {incident.vehicle_reg && <DetailItem icon={Bus} label="Vehicle" value={incident.vehicle_reg} />}
                {incident.location_description && <DetailItem icon={MapPin} label="Location" value={incident.location_description} />}
                {incident.sla_remaining_mins != null && incident.sla_remaining_mins > 0 && (
                  <DetailItem
                    icon={Timer}
                    label="SLA Remaining"
                    value={incident.sla_remaining_mins > 60
                      ? `${Math.floor(incident.sla_remaining_mins / 60)}h ${incident.sla_remaining_mins % 60}m`
                      : `${incident.sla_remaining_mins}m`
                    }
                  />
                )}
                <DetailItem icon={Clock} label="Created" value={new Date(incident.created_at).toLocaleString("en-IN")} />
              </div>

              {incident.description && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Description</h4>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{incident.description}</p>
                </div>
              )}

              {/* Timeline */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">Timeline</h4>
                <div className="space-y-3">
                  {(incident.events || []).map((event, idx) => {
                    const Icon = EVENT_ICONS[event.event_type] || Clock
                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex gap-3"
                      >
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <Icon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          </div>
                          {idx < (incident.events || []).length - 1 && (
                            <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 mt-1" />
                          )}
                        </div>
                        <div className="pb-3 flex-1">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}
                          </p>
                          {event.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{event.description}</p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1">
                            {new Date(event.created_at).toLocaleString("en-IN")}
                          </p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              {/* Add note */}
              {!["RESOLVED", "CLOSED"].includes(incident.status) && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Add Note</h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Type a note..."
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && noteText.trim()) {
                          addEventMutation.mutate({ event_type: "note", description: noteText.trim() })
                        }
                      }}
                    />
                    <button
                      onClick={() => noteText.trim() && addEventMutation.mutate({ event_type: "note", description: noteText.trim() })}
                      disabled={!noteText.trim() || addEventMutation.isPending}
                      className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500 disabled:opacity-50 transition-colors"
                    >
                      {addEventMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Action footer */}
            {!["RESOLVED", "CLOSED"].includes(incident.status) && (
              <div className="sticky bottom-0 p-4 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-surface-900/90 backdrop-blur-xl">
                {showResolve ? (
                  <div className="space-y-3">
                    <textarea
                      value={resolveNotes}
                      onChange={(e) => setResolveNotes(e.target.value)}
                      placeholder="Resolution notes..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowResolve(false)}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => resolveMutation.mutate()}
                        disabled={resolveMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-md shadow-emerald-500/20"
                      >
                        {resolveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        Confirm Resolve
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowResolve(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors shadow-md shadow-emerald-500/20"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Resolve Incident
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            Incident not found
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

function DetailItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
      <div>
        <p className="text-[10px] text-slate-400">{label}</p>
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{value}</p>
      </div>
    </div>
  )
}
