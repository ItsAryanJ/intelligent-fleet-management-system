import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import api from "@/lib/api"
import type { Notice } from "@/types"
import { NoticeFormModal } from "./NoticeFormModal"
import { useToast } from "@/components/shared/Toast"
import { Megaphone, Clock, Eye, CheckCircle2, AlertCircle, ChevronRight, Plus, Send } from "lucide-react"

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "bg-red-50 dark:bg-red-900/20 text-red-600 border-red-200 dark:border-red-800/30",
  HIGH: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-200 dark:border-amber-800/30",
  NORMAL: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-200 dark:border-blue-800/30",
  LOW: "bg-slate-50 dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700",
}

export function NoticesPage() {
  const [formOpen, setFormOpen] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ["notices", "feed"],
    queryFn: async () => {
      const res = await api.get("/notices/feed")
      return res.data as Notice[]
    },
  })

  const publishMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/notices/${id}/publish`),
    onSuccess: () => {
      toast({ variant: "success", title: "Notice published", description: "Notice is now visible to recipients." })
      queryClient.invalidateQueries({ queryKey: ["notices"] })
    },
  })

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/notices/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notices"] }),
  })

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <NoticeFormModal open={formOpen} onClose={() => setFormOpen(false)} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Notices & Announcements</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{notices.length} notices in your feed</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 transition-colors shadow-md shadow-brand-500/20"
        >
          <Megaphone className="w-4 h-4" />
          Create Notice
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-28 skeleton rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map((notice, idx) => (
            <motion.div
              key={notice.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className={`bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-md transition-all cursor-pointer group ${
                !notice.is_read ? "border-l-4 border-l-brand-500" : ""
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${PRIORITY_COLORS[notice.priority] || PRIORITY_COLORS.NORMAL}`}>
                      {notice.priority}
                    </span>
                    {!notice.is_read && (
                      <span className="w-2 h-2 rounded-full bg-brand-500" />
                    )}
                    {notice.acknowledged_at && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                    {notice.title}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {notice.summary || notice.content}
                  </p>

                  <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {notice.published_at ? new Date(notice.published_at).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                      }) : "Draft"}
                    </span>
                    {notice.read_count != null && (
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {notice.read_count} reads
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
              </div>
            </motion.div>
          ))}

          {notices.length === 0 && (
            <div className="text-center py-16">
              <Megaphone className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">No notices yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
