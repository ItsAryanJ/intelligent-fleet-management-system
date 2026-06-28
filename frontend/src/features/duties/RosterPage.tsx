import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import api from "@/lib/api"
import { useToast } from "@/components/shared/Toast"
import { useAuthStore } from "@/store/auth"
import {
  CalendarDays, ChevronLeft, ChevronRight, Send, Loader2,
  User, Bus, Route as RouteIcon, AlertTriangle, CheckCircle2, Clock
} from "lucide-react"

const SHIFTS = ["MORNING", "AFTERNOON", "EVENING", "NIGHT"]
const SHIFT_COLORS: Record<string, string> = {
  MORNING: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  AFTERNOON: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  EVENING: "bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800",
  NIGHT: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
}
const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 dark:bg-slate-800 text-slate-500",
  PUBLISHED: "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
  ACKNOWLEDGED: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
  IN_PROGRESS: "bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400",
  COMPLETED: "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
  CANCELLED: "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400",
}

export function RosterPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthStore()
  const canPublish = hasPermission("duty.publish")

  // Week navigation
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    return monday
  })

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      return d
    })
  }, [weekStart])

  const startStr = weekDays[0].toISOString().split("T")[0]
  const endStr = weekDays[6].toISOString().split("T")[0]

  const { data: dutiesData, isLoading } = useQuery({
    queryKey: ["roster-duties", startStr, endStr],
    queryFn: async () => {
      const res = await api.get("/duties", { params: { start_date: startStr, end_date: endStr, page_size: 200 } })
      return res.data?.items || []
    },
  })

  const duties = dutiesData || []

  // Check conflicts
  const { data: conflictsData } = useQuery({
    queryKey: ["roster-conflicts", startStr],
    queryFn: async () => {
      // Check conflicts for each day
      const allConflicts: any[] = []
      for (const day of weekDays) {
        try {
          const res = await api.get("/duties/conflicts", { params: { target_date: day.toISOString().split("T")[0] } })
          if (res.data?.conflicts?.length) {
            allConflicts.push(...res.data.conflicts.map((c: any) => ({ ...c, date: day.toISOString().split("T")[0] })))
          }
        } catch { /* ignore */ }
      }
      return allConflicts
    },
  })

  const publishMutation = useMutation({
    mutationFn: async (rosterDate: string) =>
      api.post("/duties/publish", null, { params: { roster_date: rosterDate } }),
    onSuccess: (_, rosterDate) => {
      toast({ variant: "success", title: "Roster Published", description: `Duties for ${rosterDate} published and notifications sent.` })
      queryClient.invalidateQueries({ queryKey: ["roster-duties"] })
    },
    onError: (err: any) => {
      toast({ variant: "error", title: "Publish Failed", description: err.response?.data?.detail || "Failed to publish." })
    },
  })

  const prevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }

  const nextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }

  // Group duties by date → shift
  const grid = useMemo(() => {
    const map: Record<string, Record<string, any[]>> = {}
    for (const day of weekDays) {
      const key = day.toISOString().split("T")[0]
      map[key] = {}
      for (const shift of SHIFTS) {
        map[key][shift] = []
      }
    }
    for (const duty of duties) {
      const dateKey = duty.date
      const shift = duty.shift
      if (map[dateKey]?.[shift]) {
        map[dateKey][shift].push(duty)
      }
    }
    return map
  }, [duties, weekDays])

  // Count draft duties per day
  const draftCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const day of weekDays) {
      const key = day.toISOString().split("T")[0]
      counts[key] = duties.filter((d: any) => d.date === key && d.status === "DRAFT").length
    }
    return counts
  }, [duties, weekDays])

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-brand-500" />
            Duty Roster
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Weekly roster view with publishing and conflict detection
          </p>
        </div>
      </div>

      {/* Conflict banner */}
      {(conflictsData || []).length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              {conflictsData!.length} Scheduling Conflict{conflictsData!.length > 1 ? "s" : ""} Detected
            </p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
              {conflictsData!.map((c: any) => `${c.type.replace(/_/g, " ")} on ${c.date}`).join("; ")}
            </p>
          </div>
        </div>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
        <button onClick={prevWeek} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ChevronLeft className="w-4 h-4 text-slate-500" />
        </button>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {weekDays[0].toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
          {" — "}
          {weekDays[6].toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
        </h3>
        <button onClick={nextWeek} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Column headers (days) */}
            <div className="grid grid-cols-8 gap-2 mb-2">
              <div className="text-xs font-semibold text-slate-400 p-2">Shift</div>
              {weekDays.map((day) => {
                const key = day.toISOString().split("T")[0]
                const isToday = key === new Date().toISOString().split("T")[0]
                const drafts = draftCounts[key] || 0
                return (
                  <div key={key} className={`text-center p-2 rounded-lg ${isToday ? "bg-brand-50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-800" : ""}`}>
                    <p className={`text-xs font-semibold ${isToday ? "text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-slate-400"}`}>
                      {day.toLocaleDateString("en-IN", { weekday: "short" })}
                    </p>
                    <p className={`text-sm font-bold ${isToday ? "text-brand-700 dark:text-brand-300" : "text-slate-800 dark:text-white"}`}>
                      {day.getDate()}
                    </p>
                    {canPublish && drafts > 0 && (
                      <button
                        onClick={() => publishMutation.mutate(key)}
                        disabled={publishMutation.isPending}
                        className="mt-1 px-2 py-0.5 rounded text-[9px] font-bold bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800 hover:bg-brand-200 dark:hover:bg-brand-900/50 transition-colors flex items-center gap-1 mx-auto"
                      >
                        <Send className="w-2.5 h-2.5" /> Publish {drafts}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Rows (shifts) */}
            {SHIFTS.map((shift) => (
              <div key={shift} className="grid grid-cols-8 gap-2 mb-2">
                <div className={`flex items-center justify-center p-2 rounded-lg text-xs font-semibold border ${SHIFT_COLORS[shift]}`}>
                  {shift}
                </div>
                {weekDays.map((day) => {
                  const key = day.toISOString().split("T")[0]
                  const cellDuties = grid[key]?.[shift] || []
                  return (
                    <div
                      key={`${key}-${shift}`}
                      className="bg-white dark:bg-surface-900 rounded-lg border border-slate-100 dark:border-slate-800 p-2 min-h-[80px] space-y-1.5"
                    >
                      {cellDuties.length === 0 ? (
                        <p className="text-[10px] text-slate-300 dark:text-slate-700 text-center mt-4">—</p>
                      ) : (
                        cellDuties.map((d: any) => (
                          <motion.div
                            key={d.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-1.5 rounded border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                          >
                            <div className="flex items-center gap-1 mb-1">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${STATUS_COLORS[d.status] || STATUS_COLORS.DRAFT}`}>
                                {d.status}
                              </span>
                              {d.acknowledged_at && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />}
                            </div>
                            {d.driver_name && (
                              <p className="text-[10px] text-slate-600 dark:text-slate-400 flex items-center gap-1 truncate">
                                <User className="w-2.5 h-2.5 flex-shrink-0" /> {d.driver_name}
                              </p>
                            )}
                            {d.vehicle_reg && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-500 flex items-center gap-1 truncate">
                                <Bus className="w-2.5 h-2.5 flex-shrink-0" /> {d.vehicle_reg}
                              </p>
                            )}
                            {d.route_code && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-500 flex items-center gap-1 truncate">
                                <RouteIcon className="w-2.5 h-2.5 flex-shrink-0" /> {d.route_code}
                              </p>
                            )}
                          </motion.div>
                        ))
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
