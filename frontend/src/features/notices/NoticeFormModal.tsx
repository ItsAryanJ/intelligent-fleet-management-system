import { useForm, FormProvider } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Modal } from "@/components/shared/Modal"
import { FormField } from "@/components/shared/FormField"
import { useToast } from "@/components/shared/Toast"
import api from "@/lib/api"
import { Loader2 } from "lucide-react"

interface NoticeFormModalProps {
  open: boolean
  onClose: () => void
}

const PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
]

const TARGET_TYPES = [
  { value: "ALL", label: "All Users" },
  { value: "ROLE", label: "By Role" },
  { value: "DEPOT", label: "By Depot" },
]

const ROLE_OPTIONS = [
  { value: "DRIVER", label: "Drivers" },
  { value: "CONDUCTOR", label: "Conductors" },
  { value: "CONTROL_OPERATOR", label: "Control Operators" },
  { value: "DEPOT_MANAGER", label: "Depot Managers" },
  { value: "EXECUTIVE", label: "Executives" },
]

export function NoticeFormModal({ open, onClose }: NoticeFormModalProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const methods = useForm({
    defaultValues: {
      title: "",
      content: "",
      summary: "",
      priority: "NORMAL",
      target_type: "ALL",
      language: "en",
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      return api.post("/notices", data)
    },
    onSuccess: () => {
      toast({
        variant: "success",
        title: "Notice created",
        description: "The notice has been created as a draft. Publish it to make it visible.",
      })
      queryClient.invalidateQueries({ queryKey: ["notices"] })
      methods.reset()
      onClose()
    },
    onError: (err: any) => {
      toast({
        variant: "error",
        title: "Error",
        description: err.response?.data?.detail || "Failed to create notice.",
      })
    },
  })

  const onSubmit = methods.handleSubmit((data) => mutation.mutate(data))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Notice"
      description="Compose a new notice or announcement"
      size="lg"
    >
      <FormProvider {...methods}>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField
            name="title"
            label="Title"
            placeholder="Notice title"
            required
          />

          <FormField
            name="summary"
            label="Summary"
            placeholder="Brief summary (optional)"
          />

          <FormField
            name="content"
            label="Content"
            type="textarea"
            placeholder="Full notice content (markdown supported)"
            required
          />

          <div className="grid grid-cols-3 gap-4">
            <FormField
              name="priority"
              label="Priority"
              type="select"
              options={PRIORITIES}
            />
            <FormField
              name="target_type"
              label="Target"
              type="select"
              options={TARGET_TYPES}
            />
            <FormField
              name="language"
              label="Language"
              type="select"
              options={[
                { value: "en", label: "English" },
                { value: "hi", label: "Hindi" },
              ]}
            />
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
              Create Notice
            </button>
          </div>
        </form>
      </FormProvider>
    </Modal>
  )
}
