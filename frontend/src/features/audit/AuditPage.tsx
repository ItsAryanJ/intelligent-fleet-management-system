import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import api from "@/lib/api"
import {
  Shield, Clock, User, FileText, AlertTriangle,
  Bus, Calendar, ChevronDown, Search,
} from "lucide-react"

const ACTION_ICONS: Record<string, any> = {
  CREATE: FileText, UPDATE: FileText, DELETE: AlertTriangle,
  LOGIN: User, LOGOUT: User, ACKNOWLEDGE: Calendar,
  PUBLISH: Calendar, ASSIGN: User,
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
  UPDATE: "text-blue-500 bg-blue-50 dark:bg-blue-900/20",
  DELETE: "text-red-500 bg-red-50 dark:bg-red-900/20",
  LOGIN: "text-violet-500 bg-violet-50 dark:bg-violet-900/20",
  LOGOUT: "text-slate-500 bg-slate-50 dark:bg-slate-900/20",
}

export function AuditPage() {
  const [resourceType, setResourceType] = useState("")
  const [action, setAction] = useState("")
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ["audit", resourceType, action, page],
    queryFn: async () => {
      const params: any = { page, page_size: 30 }
      if (resourceType) params.resource_type = resourceType
      if (action) params.action = action
      const res = await api.get("/audit", { params })
      return res.data
    },
  })

  const { data: timelineData } = useQuery({
    queryKey: ["audit", "timeline"],
    queryFn: async () => { const res = await api.get("/audit/timeline", { params: { hours: 24 } }); return res.data },
  })

  const logs = data?.items || []
  const total = data?.total || 0
  const timelineEvents = timelineData?.events || []

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit Log</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">System-wide activity tracking and compliance</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-white dark:bg-surface-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-brand-500" />
            <span className="text-xs font-semibold text-slate-500">Total Records</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{total.toLocaleString()}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="p-4 rounded-xl bg-white dark:bg-surface-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-slate-500">Last 24h</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{timelineEvents.length}</p>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={resourceType} onChange={(e) => { setResourceType(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-900 text-sm text-slate-700 dark:text-slate-300">
          <option value="">All Resources</option>
          {["vehicle", "user", "incident", "duty", "notice", "route", "depot", "report", "copilot"].map((r) => (
            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
          ))}
        </select>
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-900 text-sm text-slate-700 dark:text-slate-300">
          <option value="">All Actions</option>
          {["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "ACKNOWLEDGE", "PUBLISH", "ASSIGN"].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* Audit Log Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Resource</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Details</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">IP Address</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-8 skeleton rounded" /></td></tr>
                ))
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No audit logs found</td></tr>
              ) : logs.map((log: any) => {
                const Icon = ACTION_ICONS[log.action] || FileText
                const color = ACTION_COLORS[log.action] || "text-slate-500 bg-slate-50 dark:bg-slate-800"
                return (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded ${color}`}><Icon className="w-3.5 h-3.5" /></div>
                        <span className="font-medium text-slate-800 dark:text-white">{log.action}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{log.resource_type}</span>
                      {log.resource_id && <span className="text-[10px] text-slate-400 ml-1">{log.resource_id.slice(0, 8)}…</span>}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-xs text-slate-500 truncate">{typeof log.details === "string" ? log.details : JSON.stringify(log.details)}</p>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs text-slate-400 font-mono">{log.ip_address || "—"}</span></td>
                    <td className="px-4 py-3"><span className="text-xs text-slate-400">{formatTime(log.created_at)}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {total > 30 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-400">Page {page} of {Math.ceil(total / 30)}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="px-3 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 disabled:opacity-40">← Prev</button>
              <button onClick={() => setPage(page + 1)} disabled={page * 30 >= total}
                className="px-3 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
