import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import api from "@/lib/api"
import type { Vehicle } from "@/types"
import { VehicleFormModal } from "./VehicleFormModal"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { useToast } from "@/components/shared/Toast"
import {
  Bus, Search, Plus, Filter, ChevronRight,
  Fuel, Activity, MapPin, Gauge, MoreHorizontal, Pencil, Trash2,
} from "lucide-react"
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/StateDisplays"

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30",
  INACTIVE: "bg-slate-50 dark:bg-slate-900/20 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800/30",
  MAINTENANCE: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/30",
  BREAKDOWN: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/30",
  RETIRED: "bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800/30",
}

const STATUS_DOTS: Record<string, string> = {
  ACTIVE: "bg-emerald-500",
  INACTIVE: "bg-slate-400",
  MAINTENANCE: "bg-amber-500",
  BREAKDOWN: "bg-red-500",
  RETIRED: "bg-gray-400",
}

export function VehiclesPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["vehicles", page, search, statusFilter],
    queryFn: async () => {
      const params: any = { page, page_size: 20 }
      if (search) params.search = search
      if (statusFilter !== "ALL") params.status = statusFilter
      const res = await api.get("/vehicles", { params })
      return res.data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/vehicles/${id}`),
    onSuccess: () => {
      toast({ variant: "success", title: "Vehicle deleted", description: "Vehicle removed from fleet." })
      queryClient.invalidateQueries({ queryKey: ["vehicles"] })
      setDeleteTarget(null)
    },
    onError: (err: any) => {
      toast({ variant: "error", title: "Error", description: err.response?.data?.detail || "Failed to delete." })
    },
  })

  const vehicles: Vehicle[] = data?.items || []
  const total = data?.total || 0

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Modals */}
      <VehicleFormModal
        open={formOpen || !!editingVehicle}
        onClose={() => { setFormOpen(false); setEditingVehicle(null) }}
        vehicle={editingVehicle}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Vehicle"
        description={`Are you sure you want to remove ${deleteTarget?.registration_no}? This action cannot be undone.`}
        confirmText="Delete"
        loading={deleteMutation.isPending}
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Vehicle Fleet</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {total} vehicles registered across all depots
          </p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 transition-colors shadow-md shadow-brand-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Vehicle
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by registration number..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {["ALL", "ACTIVE", "MAINTENANCE", "BREAKDOWN", "INACTIVE"].map((status) => (
            <button
              key={status}
              onClick={() => { setStatusFilter(status); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === status
                  ? "bg-brand-500 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
            >
              {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Vehicle Grid */}
      {isLoading ? (
        <LoadingState text="Loading vehicles..." rows={4} />
      ) : isError ? (
        <ErrorState title="Failed to load vehicles" description="Check your connection and try again." onRetry={() => refetch()} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {vehicles.map((vehicle, idx) => (
            <motion.div
              key={vehicle.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:shadow-lg hover:border-brand-200 dark:hover:border-brand-800 transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Bus className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white font-mono">
                      {vehicle.registration_no}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {vehicle.make} {vehicle.model}
                    </p>
                  </div>
                </div>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLORS[vehicle.status] || STATUS_COLORS.IDLE}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[vehicle.status] || STATUS_DOTS.IDLE}`} />
                  {vehicle.status}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{vehicle.depot_name || "—"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Gauge className="w-3 h-3" />
                  <span>{vehicle.last_speed?.toFixed(0) || 0} km/h</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Fuel className="w-3 h-3" />
                  <span>
                    {vehicle.fuel_level != null
                      ? `${Math.round(vehicle.fuel_level)}%`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Activity className="w-3 h-3" />
                  <span>
                    {vehicle.health_score != null
                      ? `${Math.round(vehicle.health_score)}%`
                      : "—"}
                  </span>
                </div>
              </div>

              {/* Health bar */}
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-500">Health</span>
                  <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300">
                    {vehicle.health_score != null
                      ? `${Math.round(vehicle.health_score)}%`
                      : "—"}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${(vehicle.health_score || 0) > 80 ? "bg-emerald-500" :
                        (vehicle.health_score || 0) > 50 ? "bg-amber-500" : "bg-red-500"
                      }`}
                    style={{ width: `${vehicle.health_score || 0}%` }}
                  />
                </div>
              </div>

              {/* Actions — visible on hover */}
              <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingVehicle(vehicle) }}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(vehicle) }}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page * 20 >= total}
            className="px-3 py-1.5 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
