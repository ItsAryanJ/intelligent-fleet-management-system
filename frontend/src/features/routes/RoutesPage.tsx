import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import api from "@/lib/api"
import type { Route as RouteType } from "@/types"
import { RouteFormModal } from "./RouteFormModal"
import { Route, MapPin, Clock, ArrowRight, Activity, Plus, Pencil } from "lucide-react"
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/StateDisplays"

export function RoutesPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState<any | null>(null)

  const { data: routes = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["routes"],
    queryFn: async () => {
      const res = await api.get("/routes")
      return res.data as RouteType[]
    },
  })

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <RouteFormModal
        open={formOpen || !!editingRoute}
        onClose={() => { setFormOpen(false); setEditingRoute(null) }}
        route={editingRoute}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Route Network</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {routes.length} routes across the NCR RRTS corridor
          </p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 transition-colors shadow-md shadow-brand-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Route
        </button>
      </div>

      {isLoading ? (
        <LoadingState text="Loading routes..." rows={3} />
      ) : isError ? (
        <ErrorState title="Failed to load routes" description="Check your connection and try again." onRetry={() => refetch()} />
      ) : routes.length === 0 ? (
        <EmptyState icon={Route} title="No routes configured" description="Create your first route to get started." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {routes.map((route, idx) => (
            <motion.div
              key={route.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-lg transition-all cursor-pointer group"
            >
              {/* Color accent bar */}
              <div className="h-1 rounded-full mb-4" style={{ backgroundColor: route.color }} />

              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md text-white" style={{ backgroundColor: route.color }}>
                      {route.code}
                    </span>
                    {route.is_active ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 font-medium">Active</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 font-medium">Inactive</span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white mt-2">
                    {route.name}
                  </h3>
                </div>
                <Route className="w-5 h-5 text-slate-400 group-hover:text-brand-500 transition-colors" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <ArrowRight className="w-3 h-3" />
                  <span>{route.distance_km} km</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />
                  <span>{route.estimated_duration_mins} min</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin className="w-3 h-3" />
                  <span>{route.stop_count} stops</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Activity className="w-3 h-3" />
                  <span>Every {route.frequency_mins} min</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Depot: {route.depot_name || "—"}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingRoute(route) }}
                  className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 transition-all"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
