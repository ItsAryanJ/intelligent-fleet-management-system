import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import api from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { useToast } from "@/components/shared/Toast"
import {
  Calendar, Clock, Check, X, Plus, AlertCircle,
} from "lucide-react"

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  CANCELLED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
}

export function LeavesPage() {
  const { toast } = useToast()
  const { user, hasPermission } = useAuthStore()
  const queryClient = useQueryClient()
  const canApprove = hasPermission("leave.approve")
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState("")
  const [form, setForm] = useState({
    start_date: "", end_date: "", reason: "", leave_type: "casual",
  })

  const { data, isLoading } = useQuery({
    queryKey: ["leaves", statusFilter],
    queryFn: async () => {
      const params: any = { page_size: 50 }
      if (statusFilter) params.status = statusFilter
      const res = await api.get("/leaves", { params })
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/leaves", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["leaves"] }); setShowForm(false); toast({ variant: "success", title: "Leave request submitted" }) },
    onError: () => toast({ variant: "error", title: "Failed to submit" }),
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/leaves/${id}/approve`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["leaves"] }); toast({ variant: "success", title: "Leave approved" }) },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/leaves/${id}/reject`, { rejection_reason: "Not approved" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["leaves"] }); toast({ variant: "success", title: "Leave rejected" }) },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/leaves/${id}/cancel`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["leaves"] }); toast({ variant: "success", title: "Leave cancelled" }) },
  })

  const leaves = data?.items || []

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Leave Management</h1>
          <p className="text-sm text-slate-500 mt-1">Request, track, and manage leave</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 transition-colors">
          <Plus className="w-4 h-4" /> Request Leave
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4">New Leave Request</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Start Date</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">End Date</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Type</label>
              <select value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm">
                <option value="casual">Casual</option><option value="sick">Sick</option>
                <option value="emergency">Emergency</option><option value="planned">Planned</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Reason</label>
              <input type="text" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Reason for leave" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.start_date || !form.end_date || !form.reason}
              className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 disabled:opacity-50">Submit</button>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {["", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? "bg-brand-500 text-white" : "text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Dates</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Reason</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-8 skeleton rounded" /></td></tr>)
            ) : leaves.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No leave requests</td></tr>
            ) : leaves.map((l: any) => (
              <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="font-medium text-slate-800 dark:text-white">{l.start_date} → {l.end_date}</span>
                  </div>
                </td>
                <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">{l.leave_type}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">{l.reason}</td>
                <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_STYLES[l.status] || ""}`}>{l.status}</span></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {canApprove && l.status === "PENDING" && (
                      <>
                        <button onClick={() => approveMutation.mutate(l.id)} className="p-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20" title="Approve"><Check className="w-4 h-4 text-emerald-600" /></button>
                        <button onClick={() => rejectMutation.mutate(l.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20" title="Reject"><X className="w-4 h-4 text-red-600" /></button>
                      </>
                    )}
                    {l.status === "PENDING" && l.user_id === user?.id && (
                      <button onClick={() => cancelMutation.mutate(l.id)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Cancel"><X className="w-4 h-4 text-slate-400" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
