import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import api from "@/lib/api"
import type { Incident } from "@/types"
import { IncidentFormModal } from "./IncidentFormModal"
import { IncidentDetailDrawer } from "./IncidentDetailDrawer"
import {
  AlertTriangle, Clock, User, Bus, MapPin,
  Filter, Search, ChevronRight, Shield, Timer, Plus,
} from "lucide-react"
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/StateDisplays"

const SEVERITY_CONFIG: Record<string, { label: string; class: string; dot: string }> = {
  P1: { label: "P1 Critical", class: "badge-p1", dot: "bg-red-500" },
  P2: { label: "P2 Major", class: "badge-p2", dot: "bg-amber-500" },
  P3: { label: "P3 Minor", class: "badge-p3", dot: "bg-blue-500" },
}

const STATUS_MAP: Record<string, string> = {
  OPEN: "bg-red-50 dark:bg-red-900/20 text-red-600",
  ACKNOWLEDGED: "bg-amber-50 dark:bg-amber-900/20 text-amber-600",
  ASSIGNED: "bg-blue-50 dark:bg-blue-900/20 text-blue-600",
  IN_PROGRESS: "bg-violet-50 dark:bg-violet-900/20 text-violet-600",
  RESOLVED: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600",
  CLOSED: "bg-slate-100 dark:bg-slate-800 text-slate-600",
}

export function IncidentsPage() {
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [severityFilter, setSeverityFilter] = useState("ALL")
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["incidents", page, statusFilter, severityFilter],
    queryFn: async () => {
      const params: any = { page, page_size: 20 }
      if (statusFilter !== "ALL") params.status = statusFilter
      if (severityFilter !== "ALL") params.severity = severityFilter
      const res = await api.get("/incidents", { params })
      return res.data
    },
  })

  const { data: slaData } = useQuery({
    queryKey: ["incidents", "sla"],
    queryFn: async () => {
      const res = await api.get("/incidents/sla-status")
      return res.data
    },
  })

  const incidents: Incident[] = data?.items || []
  const total = data?.total || 0

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Modal */}
      <IncidentFormModal open={formOpen} onClose={() => setFormOpen(false)} />
      <IncidentDetailDrawer incidentId={selectedId} onClose={() => setSelectedId(null)} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Incident Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{total} total incidents</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors shadow-md shadow-red-500/20"
        >
          <AlertTriangle className="w-4 h-4" />
          Report Incident
        </button>
      </div>

      {/* SLA Overview Cards */}
      {slaData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-red-500" />
              <span className="text-xs font-semibold text-red-600 dark:text-red-400">SLA Breached</span>
            </div>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{slaData.breached?.count || 0}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">At Risk</span>
            </div>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{slaData.at_risk?.count || 0}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">On Track</span>
            </div>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{slaData.on_track?.count || 0}</p>
          </motion.div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Status:</span>
          {["ALL", "OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED"].map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? "bg-brand-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
              {s === "ALL" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Severity:</span>
          {["ALL", "P1", "P2", "P3"].map((s) => (
            <button key={s} onClick={() => { setSeverityFilter(s); setPage(1) }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${severityFilter === s ? "bg-brand-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Incident List */}
      {isLoading ? (
        <LoadingState text="Loading incidents..." rows={5} />
      ) : isError ? (
        <ErrorState title="Failed to load incidents" description="Check your connection and try again." onRetry={() => refetch()} />
      ) : (
        <div className="space-y-3">
          {incidents.map((incident, idx) => {
            const sev = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.P3
            return (
              <motion.div
                key={incident.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => setSelectedId(incident.id)}
                className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  {/* Severity dot */}
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <span className={`w-3 h-3 rounded-full ${sev.dot} ${incident.sla_breached ? "animate-pulse" : ""}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-slate-800 dark:text-white">
                        {incident.incident_no}
                      </span>
                      <span className={sev.class}>{incident.severity}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_MAP[incident.status] || STATUS_MAP.OPEN}`}>
                        {incident.status.replace("_", " ")}
                      </span>
                      {incident.sla_breached && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse">
                          SLA BREACHED
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">
                      {incident.title}
                    </h3>

                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {incident.vehicle_reg && (
                        <span className="flex items-center gap-1"><Bus className="w-3 h-3" /> {incident.vehicle_reg}</span>
                      )}
                      {incident.reported_by_name && (
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {incident.reported_by_name}</span>
                      )}
                      {incident.sla_remaining_mins != null && incident.sla_remaining_mins > 0 && (
                        <span className="flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          {incident.sla_remaining_mins > 60
                            ? `${Math.floor(incident.sla_remaining_mins / 60)}h ${incident.sla_remaining_mins % 60}m remaining`
                            : `${incident.sla_remaining_mins}m remaining`
                          }
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
                </div>
              </motion.div>
            )
          })}

          {incidents.length === 0 && (
            <EmptyState
              icon={AlertTriangle}
              title="No incidents found"
              description={statusFilter !== "ALL" || severityFilter !== "ALL" ? "Try adjusting your filters." : undefined}
            />
          )}
        </div>
      )}
    </div>
  )
}
