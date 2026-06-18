import { useForm, FormProvider } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Modal } from "@/components/shared/Modal"
import { FormField } from "@/components/shared/FormField"
import { useToast } from "@/components/shared/Toast"
import api from "@/lib/api"
import { Loader2 } from "lucide-react"

interface RouteFormModalProps {
  open: boolean
  onClose: () => void
  route?: any | null
}

export function RouteFormModal({ open, onClose, route }: RouteFormModalProps) {
  const isEdit = !!route
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
      name: route?.name || "",
      code: route?.code || "",
      description: route?.description || "",
      depot_id: route?.depot_id || "",
      distance_km: route?.distance_km || 0,
      estimated_duration_mins: route?.estimated_duration_mins || 60,
      frequency_mins: route?.frequency_mins || 15,
      color: route?.color || "#3B82F6",
      is_circular: route?.is_circular || false,
      is_active: route?.is_active ?? true,
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEdit) {
        const { code, depot_id, ...updateData } = data
        return api.put(`/routes/${route.id}`, updateData)
      }
      return api.post("/routes", data)
    },
    onSuccess: () => {
      toast({
        variant: "success",
        title: isEdit ? "Route updated" : "Route created",
        description: `Route ${methods.getValues("code")} — ${methods.getValues("name")} has been ${isEdit ? "updated" : "created"}.`,
      })
      queryClient.invalidateQueries({ queryKey: ["routes"] })
      methods.reset()
      onClose()
    },
    onError: (err: any) => {
      toast({
        variant: "error",
        title: "Error",
        description: err.response?.data?.detail || "Failed to save route.",
      })
    },
  })

  const onSubmit = methods.handleSubmit((data) => mutation.mutate(data))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Route" : "Add New Route"}
      description={isEdit ? "Update route details" : "Create a new transit route"}
      size="lg"
    >
      <FormProvider {...methods}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField name="name" label="Route Name" placeholder="Meerut — Ghaziabad Express" required />
            <FormField name="code" label="Route Code" placeholder="R-001" required disabled={isEdit} />
          </div>

          <FormField name="description" label="Description" type="textarea" placeholder="Route description..." />

          <FormField
            name="depot_id"
            label="Depot"
            type="select"
            options={depots.map((d: any) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
            required
            disabled={isEdit}
          />

          <div className="grid grid-cols-3 gap-4">
            <FormField name="distance_km" label="Distance (km)" type="number" min={0} step={0.1} />
            <FormField name="estimated_duration_mins" label="Duration (mins)" type="number" min={1} />
            <FormField name="frequency_mins" label="Headway (mins)" type="number" min={1} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField name="color" label="Route Color" type="color" />
            <FormField name="is_circular" label="Circular Route" type="switch" />
            {isEdit && <FormField name="is_active" label="Active" type="switch" />}
          </div>

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
              {isEdit ? "Update Route" : "Create Route"}
            </button>
          </div>
        </form>
      </FormProvider>
    </Modal>
  )
}
