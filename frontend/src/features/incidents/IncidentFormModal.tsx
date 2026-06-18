import { useForm, FormProvider } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Modal } from "@/components/shared/Modal"
import { FormField } from "@/components/shared/FormField"
import { useToast } from "@/components/shared/Toast"
import api from "@/lib/api"
import { Loader2 } from "lucide-react"

interface IncidentFormModalProps {
  open: boolean
  onClose: () => void
}

const INCIDENT_TYPES = [
  { value: "BREAKDOWN", label: "Breakdown" },
  { value: "ACCIDENT", label: "Accident" },
  { value: "DELAY", label: "Delay" },
  { value: "COMPLAINT", label: "Complaint" },
  { value: "SECURITY", label: "Security" },
  { value: "ROUTE_DEVIATION", label: "Route Deviation" },
  { value: "OTHER", label: "Other" },
]

const SEVERITIES = [
  { value: "P1", label: "P1 — Critical (1h SLA)" },
  { value: "P2", label: "P2 — Major (4h SLA)" },
  { value: "P3", label: "P3 — Minor (24h SLA)" },
]

export function IncidentFormModal({ open, onClose }: IncidentFormModalProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: vehiclesData } = useQuery({
    queryKey: ["vehicles", "select"],
    queryFn: async () => {
      const res = await api.get("/vehicles", { params: { page_size: 100 } })
      return res.data.items
    },
    enabled: open,
  })

  const methods = useForm({
    defaultValues: {
      incident_type: "BREAKDOWN",
      severity: "P3",
      title: "",
      description: "",
      vehicle_id: "",
      location_description: "",
      latitude: "",
      longitude: "",
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        vehicle_id: data.vehicle_id || null,
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
      }
      return api.post("/incidents", payload)
    },
    onSuccess: (res) => {
      toast({
        variant: "success",
        title: "Incident reported",
        description: `Incident ${res.data.incident_no} has been created.`,
      })
      queryClient.invalidateQueries({ queryKey: ["incidents"] })
      methods.reset()
      onClose()
    },
    onError: (err: any) => {
      toast({
        variant: "error",
        title: "Error",
        description: err.response?.data?.detail || "Failed to report incident.",
      })
    },
  })

  const onSubmit = methods.handleSubmit((data) => mutation.mutate(data))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report New Incident"
      description="Create a new incident report with priority and SLA tracking"
      size="lg"
    >
      <FormProvider {...methods}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              name="incident_type"
              label="Incident Type"
              type="select"
              options={INCIDENT_TYPES}
              required
            />
            <FormField
              name="severity"
              label="Severity"
              type="select"
              options={SEVERITIES}
              required
            />
          </div>

          <FormField
            name="title"
            label="Title"
            placeholder="Brief description of the incident"
            required
          />

          <FormField
            name="description"
            label="Description"
            type="textarea"
            placeholder="Detailed description of what happened..."
          />

          <FormField
            name="vehicle_id"
            label="Vehicle"
            type="select"
            options={(vehiclesData || []).map((v: any) => ({
              value: v.id,
              label: `${v.registration_no} — ${v.vehicle_type}`,
            }))}
            helpText="Optional — select the affected vehicle"
          />

          <FormField
            name="location_description"
            label="Location"
            placeholder="e.g., Near Meerut Bus Terminal"
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField name="latitude" label="Latitude" type="number" step={0.000001} placeholder="28.7041" />
            <FormField name="longitude" label="Longitude" type="number" step={0.000001} placeholder="77.1025" />
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
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition-colors disabled:opacity-50 shadow-md shadow-red-500/20"
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Report Incident
            </button>
          </div>
        </form>
      </FormProvider>
    </Modal>
  )
}
