import { useForm, FormProvider } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Modal } from "@/components/shared/Modal"
import { FormField } from "@/components/shared/FormField"
import { useToast } from "@/components/shared/Toast"
import api from "@/lib/api"
import { Loader2 } from "lucide-react"

interface DutyFormModalProps {
  open: boolean
  onClose: () => void
}

const SHIFTS = [
  { value: "MORNING", label: "Morning" },
  { value: "AFTERNOON", label: "Afternoon" },
  { value: "EVENING", label: "Evening" },
  { value: "NIGHT", label: "Night" },
  { value: "SPLIT", label: "Split" },
]

export function DutyFormModal({ open, onClose }: DutyFormModalProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", "select"],
    queryFn: async () => {
      const res = await api.get("/vehicles", { params: { page_size: 100, status: "ACTIVE" } })
      return res.data.items
    },
    enabled: open,
  })

  const { data: drivers = [] } = useQuery({
    queryKey: ["users", "drivers"],
    queryFn: async () => {
      const res = await api.get("/users", { params: { role: "DRIVER", page_size: 100 } })
      return res.data.items
    },
    enabled: open,
  })

  const { data: conductors = [] } = useQuery({
    queryKey: ["users", "conductors"],
    queryFn: async () => {
      const res = await api.get("/users", { params: { role: "CONDUCTOR", page_size: 100 } })
      return res.data.items
    },
    enabled: open,
  })

  const { data: routes = [] } = useQuery({
    queryKey: ["routes", "select"],
    queryFn: async () => {
      const res = await api.get("/routes")
      return res.data
    },
    enabled: open,
  })

  const methods = useForm({
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      shift: "MORNING",
      vehicle_id: "",
      driver_id: "",
      conductor_id: "",
      route_id: "",
      start_time: "06:00",
      end_time: "14:00",
      remarks: "",
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        vehicle_id: data.vehicle_id || null,
        driver_id: data.driver_id || null,
        conductor_id: data.conductor_id || null,
        route_id: data.route_id || null,
      }
      return api.post("/duties", payload)
    },
    onSuccess: () => {
      toast({
        variant: "success",
        title: "Duty created",
        description: `Duty for ${methods.getValues("date")} has been created.`,
      })
      queryClient.invalidateQueries({ queryKey: ["duties"] })
      methods.reset()
      onClose()
    },
    onError: (err: any) => {
      toast({
        variant: "error",
        title: "Error",
        description: err.response?.data?.detail || "Failed to create duty.",
      })
    },
  })

  const onSubmit = methods.handleSubmit((data) => mutation.mutate(data))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Duty Assignment"
      description="Schedule a new duty with vehicle, driver, and route"
      size="lg"
    >
      <FormProvider {...methods}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField name="date" label="Date" type="date" required />
            <FormField name="shift" label="Shift" type="select" options={SHIFTS} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField name="start_time" label="Start Time" type="time" />
            <FormField name="end_time" label="End Time" type="time" />
          </div>

          <FormField
            name="vehicle_id"
            label="Vehicle"
            type="select"
            options={vehicles.map((v: any) => ({
              value: v.id,
              label: `${v.registration_no} — ${v.vehicle_type}`,
            }))}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              name="driver_id"
              label="Driver"
              type="select"
              options={drivers.map((d: any) => ({
                value: d.id,
                label: `${d.first_name} ${d.last_name} (${d.employee_id})`,
              }))}
            />
            <FormField
              name="conductor_id"
              label="Conductor"
              type="select"
              options={conductors.map((c: any) => ({
                value: c.id,
                label: `${c.first_name} ${c.last_name} (${c.employee_id})`,
              }))}
            />
          </div>

          <FormField
            name="route_id"
            label="Route"
            type="select"
            options={routes.map((r: any) => ({
              value: r.id,
              label: `${r.code} — ${r.name}`,
            }))}
          />

          <FormField name="remarks" label="Remarks" type="textarea" placeholder="Any additional notes..." />

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
              Create Duty
            </button>
          </div>
        </form>
      </FormProvider>
    </Modal>
  )
}
