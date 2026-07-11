import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import api from "@/lib/api"
import { useToast } from "@/components/shared/Toast"
import { useAuthStore } from "@/store/auth"
import type { Notice } from "@/types"
import {
  X, Clock, Eye, CheckCircle2, Megaphone, Loader2, BookOpen, Users, User,
} from "lucide-react"

interface Props {
  noticeId: string | null
  onClose: () => void
}

interface NoticeReader {
  user_id: string
  name: string
  email: string
  read_at: string
  acknowledged_at: string | null
}

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "bg-red-50 dark:bg-red-900/20 text-red-600 border-red-200 dark:border-red-800/30",
  HIGH: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-200 dark:border-amber-800/30",
  NORMAL: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-200 dark:border-blue-800/30",
  LOW: "bg-slate-50 dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700",
}

export function NoticeDetailDrawer({ noticeId, onClose }: Props) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canPublish = hasPermission("notice.publish")

  const { data: notice, isLoading } = useQuery({
    queryKey: ["notice", noticeId],
    queryFn: async () => {
      const res = await api.get(`/notices/${noticeId}`)
      return res.data as Notice
    },
    enabled: !!noticeId,
  })

  // Fetch readers list — only for publishers
  const { data: readersData } = useQuery({
    queryKey: ["notice", noticeId, "readers"],
    queryFn: async () => {
      const res = await api.get(`/notices/${noticeId}/readers`)
      return res.data as { notice_id: string; total_reads: number; readers: NoticeReader[] }
    },
    enabled: !!noticeId && canPublish,
  })

  const acknowledgeMutation = useMutation({
    mutationFn: async () => api.post(`/notices/${noticeId}/acknowledge`),
    onSuccess: () => {
      toast({ variant: "success", title: "Acknowledged", description: "Notice has been acknowledged." })
      queryClient.invalidateQueries({ queryKey: ["notice", noticeId] })
      queryClient.invalidateQueries({ queryKey: ["notices"] })
    },
    onError: (err: any) => {
      toast({ variant: "error", title: "Error", description: err.response?.data?.detail || "Failed to acknowledge." })
    },
  })

  if (!noticeId) return null

  return (
    <AnimatePresence>
      <motion.div
        key="notice-drawer-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        key="notice-drawer"
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
        ) : notice ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/90 dark:bg-surface-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-brand-500" />
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${PRIORITY_COLORS[notice.priority] || PRIORITY_COLORS.NORMAL}`}>
                    {notice.priority}
                  </span>
                  {!notice.is_published && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30">
                      Draft
                    </span>
                  )}
                  {notice.acknowledged_at && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <h2 className="text-base font-semibold text-slate-800 dark:text-white mt-3">
                {notice.title}
              </h2>

              <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {notice.published_at
                    ? new Date(notice.published_at).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })
                    : "Draft"
                  }
                </span>
                {readersData && (
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" /> {readersData.total_reads} reads
                  </span>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-5">
              {notice.summary && (
                <div className="mb-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{notice.summary}</p>
                </div>
              )}

              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {notice.content}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <BookOpen className="w-3 h-3" />
                  <span>Type: {notice.content_type || "markdown"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Target: {notice.target_type}</span>
                  {notice.target_roles && notice.target_roles.length > 0 && (
                    <span>({notice.target_roles.join(", ")})</span>
                  )}
                </div>
              </div>

              {/* Read-Receipt Roster — visible to publishers only */}
              {canPublish && readersData && (
                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-slate-500" />
                    <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Read Receipt Roster ({readersData.total_reads})
                    </h3>
                  </div>

                  {readersData.readers.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No one has read this notice yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {readersData.readers.map((reader) => (
                        <div
                          key={reader.user_id}
                          className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50"
                        >
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                            <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                              {reader.name}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">{reader.email}</p>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                            <span className="text-[9px] text-slate-400">
                              {new Date(reader.read_at).toLocaleDateString("en-IN", {
                                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                            {reader.acknowledged_at ? (
                              <span className="flex items-center gap-0.5 text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Acknowledged
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-400">Read only</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Acknowledge footer — only for non-publisher consumers */}
            {!notice.acknowledged_at && (
              <div className="sticky bottom-0 p-4 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-surface-900/90 backdrop-blur-xl">
                <button
                  onClick={() => acknowledgeMutation.mutate()}
                  disabled={acknowledgeMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 transition-colors disabled:opacity-50 shadow-md shadow-brand-500/20"
                >
                  {acknowledgeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Acknowledge Notice
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            Notice not found
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
