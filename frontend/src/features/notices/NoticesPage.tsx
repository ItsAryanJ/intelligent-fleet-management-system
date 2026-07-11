import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import api from "@/lib/api"
import type { Notice } from "@/types"
import { NoticeFormModal } from "./NoticeFormModal"
import { NoticeDetailDrawer } from "./NoticeDetailDrawer"
import { useToast } from "@/components/shared/Toast"
import { useAuthStore } from "@/store/auth"
import { Megaphone, Clock, Eye, CheckCircle2, AlertCircle, ChevronRight, Plus, Send, FileText } from "lucide-react"

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "bg-red-50 dark:bg-red-900/20 text-red-600 border-red-200 dark:border-red-800/30",
  HIGH: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-200 dark:border-amber-800/30",
  NORMAL: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-200 dark:border-blue-800/30",
  LOW: "bg-slate-50 dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700",
}

type TabKey = "all" | "draft" | "published"

export function NoticesPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>("all")
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const hasPermission = useAuthStore((s) => s.hasPermission)

  // Publishers (notice.publish permission) use GET /notices which includes drafts.
  // Consumer roles use GET /notices/feed which only returns published + targeted notices.
  const canPublish = hasPermission("notice.publish")

  // ── Publisher view: paginated list with draft/published filter ──────
  const publisherQuery = useQuery({
    queryKey: ["notices", "manage", activeTab],
    queryFn: async () => {
      const params: Record<string, string> = { page_size: "50" }
      if (activeTab === "draft") params.is_published = "false"
      if (activeTab === "published") params.is_published = "true"
      const res = await api.get("/notices", { params })
      return res.data.items as Notice[]
    },
    enabled: canPublish,
  })

  // ── Consumer view: personal feed ───────────────────────────────────
  const feedQuery = useQuery({
    queryKey: ["notices", "feed"],
    queryFn: async () => {
      const res = await api.get("/notices/feed")
      return res.data as Notice[]
    },
    enabled: !canPublish,
  })

  const notices = canPublish ? (publisherQuery.data ?? []) : (feedQuery.data ?? [])
  const isLoading = canPublish ? publisherQuery.isLoading : feedQuery.isLoading

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

  const TABS: { key: TabKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "draft", label: "Drafts" },
    { key: "published", label: "Published" },
  ]

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <NoticeFormModal open={formOpen} onClose={() => setFormOpen(false)} />
      <NoticeDetailDrawer noticeId={selectedId} onClose={() => setSelectedId(null)} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Notices & Announcements</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{notices.length} notices{canPublish ? "" : " in your feed"}</p>
        </div>
        {canPublish && (
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 transition-colors shadow-md shadow-brand-500/20"
          >
            <Megaphone className="w-4 h-4" />
            Create Notice
          </button>
        )}
      </div>

      {/* Tab bar for publishers */}
      {canPublish && (
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-white dark:bg-surface-900 text-slate-800 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

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
                !notice.is_published ? "border-l-4 border-l-amber-400" : !notice.is_read ? "border-l-4 border-l-brand-500" : ""
              }`}
              onClick={() => {
                if (!canPublish && !notice.is_read) markReadMutation.mutate(notice.id)
                setSelectedId(notice.id)
              }}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${PRIORITY_COLORS[notice.priority] || PRIORITY_COLORS.NORMAL}`}>
                      {notice.priority}
                    </span>
                    {!notice.is_published && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30 flex items-center gap-1">
                        <FileText className="w-2.5 h-2.5" />
                        Draft
                      </span>
                    )}
                    {!canPublish && !notice.is_read && (
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
                    {!notice.is_published && canPublish && (
                      <button
                        onClick={(e) => { e.stopPropagation(); publishMutation.mutate(notice.id) }}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800 hover:bg-brand-200 dark:hover:bg-brand-900/50 transition-colors"
                      >
                        Publish
                      </button>
                    )}
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
              <p className="text-slate-500">
                {canPublish && activeTab === "draft" ? "No draft notices" :
                 canPublish && activeTab === "published" ? "No published notices" :
                 "No notices yet"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
