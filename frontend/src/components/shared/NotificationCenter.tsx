import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import api from "@/lib/api"
import {
  Bell, X, CheckCheck, AlertTriangle, Calendar,
  Megaphone, MapPin, Shield, Info, Clock,
} from "lucide-react"

const TYPE_ICONS: Record<string, any> = {
  DUTY_ASSIGNED: Calendar, DUTY_PUBLISHED: Calendar,
  INCIDENT_ASSIGNED: AlertTriangle, INCIDENT_ESCALATION: AlertTriangle,
  NOTICE_PUBLISHED: Megaphone, GEOFENCE_BREACH: MapPin,
  ROUTE_DEVIATION: MapPin, LEAVE_STATUS: Clock, SYSTEM: Info,
}

const TYPE_COLORS: Record<string, string> = {
  DUTY_ASSIGNED: "text-violet-500 bg-violet-50 dark:bg-violet-900/20",
  DUTY_PUBLISHED: "text-violet-500 bg-violet-50 dark:bg-violet-900/20",
  INCIDENT_ASSIGNED: "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
  INCIDENT_ESCALATION: "text-red-500 bg-red-50 dark:bg-red-900/20",
  NOTICE_PUBLISHED: "text-pink-500 bg-pink-50 dark:bg-pink-900/20",
  GEOFENCE_BREACH: "text-red-500 bg-red-50 dark:bg-red-900/20",
  ROUTE_DEVIATION: "text-orange-500 bg-orange-50 dark:bg-orange-900/20",
  LEAVE_STATUS: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
  SYSTEM: "text-blue-500 bg-blue-50 dark:bg-blue-900/20",
}

interface NotificationCenterProps {
  open: boolean
  onClose: () => void
}

export function NotificationCenter({ open, onClose }: NotificationCenterProps) {
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", filter],
    queryFn: async () => {
      const params: any = { page_size: 30 }
      if (filter === "unread") params.is_read = false
      const res = await api.get("/notifications", { params })
      return res.data
    },
    enabled: open,
    refetchInterval: open ? 10000 : false,
  })

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })

  const markAllReadMutation = useMutation({
    mutationFn: async () => api.post("/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })

  const notifications = data?.items || []
  const unreadCount = data?.unread_count || 0

  const handleClick = (n: any) => {
    if (!n.is_read) markReadMutation.mutate(n.id)
    if (n.link) {
      navigate(n.link)
      onClose()
    }
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return "Just now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 320 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 320 }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            className="fixed top-0 right-0 z-[160] h-full w-full max-w-md bg-white dark:bg-surface-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-brand-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={markAllReadMutation.isPending}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                  </button>
                )}
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex px-5 pt-3 gap-1">
              {(["all", "unread"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? "bg-brand-500 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
                  {f === "all" ? "All" : `Unread (${unreadCount})`}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 skeleton rounded-xl mb-2" />
                ))
              ) : notifications.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">No notifications</p>
                </div>
              ) : (
                notifications.map((n: any) => {
                  const Icon = TYPE_ICONS[n.type] || Info
                  const color = TYPE_COLORS[n.type] || "text-slate-500 bg-slate-50 dark:bg-slate-800"
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-colors ${!n.is_read ? "bg-brand-50/50 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-800/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/30 border border-transparent"}`}
                    >
                      <div className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium truncate ${!n.is_read ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}>{n.title}</p>
                          {!n.is_read && <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-slate-300 dark:text-slate-500 mt-1">{formatTime(n.created_at)}</p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
