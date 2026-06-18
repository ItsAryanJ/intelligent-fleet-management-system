import { useForm, FormProvider } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Modal } from "@/components/shared/Modal"
import { FormField } from "@/components/shared/FormField"
import { useToast } from "@/components/shared/Toast"
import api from "@/lib/api"
import type { Vehicle } from "@/types"
import { Loader2 } from "lucide-react"

interface VehicleFormModalProps {
  open: boolean
  onClose: () => void
  vehicle?: Vehicle | null
}

const VEHICLE_TYPES = [
  { value: "BUS", label: "Bus" },
  { value: "MINIBUS", label: "Minibus" },
  { value: "ELECTRIC_BUS", label: "Electric Bus" },
  { value: "AC_BUS", label: "AC Bus" },
  { value: "METRO_FEEDER", label: "Metro Feeder" },
]

const VEHICLE_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "BREAKDOWN", label: "Breakdown" },
  { value: "RETIRED", label: "Retired" },
]

export function VehicleFormModal({ open, onClose, vehicle }: VehicleFormModalProps) {
  const isEdit = !!vehicle
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: depots = [] } = useQuery({
    queryKey: ["depots"],
    queryFn: async () => {
      const res = await api.get("/depots")
      return res.data
    },
    enabled: open,
  })

  const methods = useForm({
    defaultValues: {
      registration_no: vehicle?.registration_no || "",
      vehicle_type: vehicle?.vehicle_type || "BUS",
      make: vehicle?.make || "Tata",
      model: vehicle?.model || "Starbus",
      year: vehicle?.year || new Date().getFullYear(),
      capacity: vehicle?.capacity || 40,
      color: vehicle?.color || "White",
      status: vehicle?.status || "ACTIVE",
      depot_id: vehicle?.depot_id || "",
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEdit) {
        const { registration_no, ...updateData } = data
        return api.put(`/vehicles/${vehicle.id}`, updateData)
      }
      return api.post("/vehicles", data)
    },
    onSuccess: () => {
      toast({
        variant: "success",
        title: isEdit ? "Vehicle updated" : "Vehicle created",
        description: isEdit
          ? `Vehicle ${methods.getValues("registration_no")} has been updated.`
          : `Vehicle ${methods.getValues("registration_no")} has been added to the fleet.`,
      })
      queryClient.invalidateQueries({ queryKey: ["vehicles"] })
      methods.reset()
      onClose()
    },
    onError: (err: any) => {
      toast({
        variant: "error",
        title: "Error",
        description: err.response?.data?.detail || "Failed to save vehicle.",
      })
    },
  })

  const onSubmit = methods.handleSubmit((data) => mutation.mutate(data))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Vehicle" : "Add New Vehicle"}
      description={isEdit ? "Update vehicle details" : "Register a new vehicle to the fleet"}
      size="lg"
    >
      <FormProvider {...methods}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              name="registration_no"
              label="Registration No."
              placeholder="DL 01 AB 1234"
              required
              disabled={isEdit}
            />
            <FormField
              name="vehicle_type"
              label="Vehicle Type"
              type="select"
              options={VEHICLE_TYPES}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField name="make" label="Make" placeholder="Tata" />
            <FormField name="model" label="Model" placeholder="Starbus" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField name="year" label="Year" type="number" min={2000} max={2030} />
            <FormField name="capacity" label="Capacity" type="number" min={1} max={200} />
            <FormField name="color" label="Color" placeholder="White" />
          </div>

          {isEdit && (
            <FormField
              name="status"
              label="Status"
              type="select"
              options={VEHICLE_STATUSES}
            />
          )}

          <FormField
            name="depot_id"
            label="Depot"
            type="select"
            options={depots.map((d: any) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
            required
          />

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 transition-colors disabled:opacity-50 shadow-md shadow-brand-500/20"
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? "Update Vehicle" : "Add Vehicle"}
            </button>
          </div>
        </form>
      </FormProvider>
    </Modal>
  )
}
