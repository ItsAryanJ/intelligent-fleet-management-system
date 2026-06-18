import { useForm, FormProvider } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Modal } from "@/components/shared/Modal"
import { FormField } from "@/components/shared/FormField"
import { useToast } from "@/components/shared/Toast"
import api from "@/lib/api"
import { Loader2 } from "lucide-react"

interface UserFormModalProps {
  open: boolean
  onClose: () => void
  user?: any | null
}

export function UserFormModal({ open, onClose, user }: UserFormModalProps) {
  const isEdit = !!user
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await api.get("/users/roles/list")
      return res.data
    },
    enabled: open,
  })

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
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      email: user?.email || "",
      employee_id: user?.employee_id || "",
      phone: user?.phone || "",
      password: "",
      role_id: user?.role_id || "",
      depot_id: user?.depot_id || "",
      is_active: user?.is_active ?? true,
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEdit) {
        const { email, employee_id, password, ...updateData } = data
        return api.put(`/users/${user.id}`, updateData)
      }
      return api.post("/users", data)
    },
    onSuccess: () => {
      toast({
        variant: "success",
        title: isEdit ? "User updated" : "User created",
        description: `${methods.getValues("first_name")} ${methods.getValues("last_name")} has been ${isEdit ? "updated" : "added"}.`,
      })
      queryClient.invalidateQueries({ queryKey: ["users"] })
      methods.reset()
      onClose()
    },
    onError: (err: any) => {
      toast({
        variant: "error",
        title: "Error",
        description: err.response?.data?.detail || "Failed to save user.",
      })
    },
  })

  const onSubmit = methods.handleSubmit((data) => mutation.mutate(data))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit User" : "Add New User"}
      description={isEdit ? "Update user details and role assignment" : "Create a new platform user"}
      size="lg"
    >
      <FormProvider {...methods}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField name="first_name" label="First Name" placeholder="Rajesh" required />
            <FormField name="last_name" label="Last Name" placeholder="Kumar" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              name="email"
              label="Email"
              type="email"
              placeholder="user@ncrtc.in"
              required
              disabled={isEdit}
            />
            <FormField
              name="employee_id"
              label="Employee ID"
              placeholder="EMP-001"
              required
              disabled={isEdit}
            />
          </div>

          <FormField name="phone" label="Phone" placeholder="+91 98765 43210" />

          {!isEdit && (
            <FormField
              name="password"
              label="Password"
              type="password"
              placeholder="Minimum 8 characters"
              required
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField
              name="role_id"
              label="Role"
              type="select"
              options={roles.map((r: any) => ({ value: r.id, label: r.name.replace("_", " ") }))}
              required
            />
            <FormField
              name="depot_id"
              label="Depot"
              type="select"
              options={depots.map((d: any) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
              helpText="Optional for Admin/Executive roles"
            />
          </div>

          {isEdit && (
            <FormField name="is_active" label="Active" type="switch" />
          )}

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
              {isEdit ? "Update User" : "Create User"}
            </button>
          </div>
        </form>
      </FormProvider>
    </Modal>
  )
}
