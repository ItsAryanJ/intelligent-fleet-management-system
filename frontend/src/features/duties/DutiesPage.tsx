import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import api from "@/lib/api"
import type { Duty } from "@/types"
import { DutyFormModal } from "./DutyFormModal"
import { CalendarDays, Bus, User, Route, Filter, ChevronLeft, ChevronRight, Clock, AlertCircle, CheckCircle2, Plus } from "lucide-react"
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/StateDisplays"

const SHIFT_COLORS: Record<string, string> = {
  MORNING: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30",
  AFTERNOON: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30",
  EVENING: "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800/30",
  NIGHT: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
}

const STATUS_CONFIG: Record<string, { icon: any; color: string }> = {
  DRAFT: { icon: Clock, color: "text-slate-400" },
  PUBLISHED: { icon: AlertCircle, color: "text-blue-500" },
  ACKNOWLEDGED: { icon: CheckCircle2, color: "text-emerald-500" },
  COMPLETED: { icon: CheckCircle2, color: "text-emerald-600" },
}

export function DutiesPage() {
  const today = new Date().toISOString().split("T")[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [formOpen, setFormOpen] = useState(false)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["duties", selectedDate],
    queryFn: async () => {
      const res = await api.get("/duties", { params: { duty_date: selectedDate, page_size: 100 } })
      return res.data
    },
  })

  const duties: Duty[] = data?.items || []

  const shiftGroups = {
    MORNING: duties.filter((d) => d.shift === "MORNING"),
    AFTERNOON: duties.filter((d) => d.shift === "AFTERNOON"),
    EVENING: duties.filter((d) => d.shift === "EVENING"),
    NIGHT: duties.filter((d) => d.shift === "NIGHT"),
  }

  const changeDate = (offset: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + offset)
    setSelectedDate(d.toISOString().split("T")[0])
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <DutyFormModal open={formOpen} onClose={() => setFormOpen(false)} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Duty Schedule</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {duties.length} duties scheduled for {new Date(selectedDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 transition-colors shadow-md shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            Create Duty
          </button>
        </div>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-2">
        <button onClick={() => changeDate(-1)} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700">
          <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-900 text-sm text-slate-800 dark:text-slate-200"
        />
        <button onClick={() => changeDate(1)} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700">
          <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </button>
        <button onClick={() => setSelectedDate(today)} className="px-3 py-2 rounded-lg text-xs font-medium bg-brand-500 text-white hover:bg-brand-400">
          Today
        </button>
      </div>

      {/* Shift Groups */}
      {isLoading ? (
        <LoadingState text="Loading duties..." rows={3} />
      ) : isError ? (
        <ErrorState title="Failed to load duties" description="Check your connection and try again." onRetry={() => refetch()} />
      ) : (
        <div className="space-y-6">
          {Object.entries(shiftGroups).map(([shift, shiftDuties]) => {
            if (shiftDuties.length === 0) return null
            return (
              <div key={shift}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${SHIFT_COLORS[shift] || SHIFT_COLORS.MORNING}`}>
                    {shift}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {shiftDuties.length} assignments
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {shiftDuties.map((duty, idx) => {
                    const statusConfig = STATUS_CONFIG[duty.status] || STATUS_CONFIG.DRAFT
                    const StatusIcon = statusConfig.icon
                    return (
                      <motion.div
                        key={duty.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:shadow-md transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
                          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">
                            {duty.status}
                          </span>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            <Bus className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-mono font-medium">{duty.vehicle_reg || "Unassigned"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{duty.driver_name || "No driver"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            <Route className="w-3.5 h-3.5 text-slate-400" />
                            <span>{duty.route_code ? `${duty.route_code} — ${duty.route_name}` : "No route"}</span>
                          </div>
                          {(duty.start_time || duty.end_time) && (
                            <div className="flex items-center gap-2 text-slate-500">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{duty.start_time || "?"} → {duty.end_time || "?"}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {duties.length === 0 && (
            <div className="text-center py-16">
              <CalendarDays className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400">No duties scheduled for this date</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
