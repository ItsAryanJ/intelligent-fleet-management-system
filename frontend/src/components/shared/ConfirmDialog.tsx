import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, Trash2, X, Check, Info } from "lucide-react"

interface ConfirmDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: "danger" | "warning" | "info"
  loading?: boolean
}

const VARIANT_CONFIG = {
  danger: {
    icon: Trash2,
    iconBg: "bg-red-50 dark:bg-red-900/20",
    iconColor: "text-red-600",
    buttonClass: "bg-red-600 hover:bg-red-500 text-white",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-amber-50 dark:bg-amber-900/20",
    iconColor: "text-amber-600",
    buttonClass: "bg-amber-600 hover:bg-amber-500 text-white",
  },
  info: {
    icon: Info,
    iconBg: "bg-brand-50 dark:bg-brand-900/20",
    iconColor: "text-brand-600",
    buttonClass: "bg-brand-600 hover:bg-brand-500 text-white",
  },
}

export function ConfirmDialog({
  open, onConfirm, onCancel, title, description,
  confirmText = "Confirm", cancelText = "Cancel",
  variant = "danger", loading = false,
}: ConfirmDialogProps) {
  const config = VARIANT_CONFIG[variant]

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onCancel}
        >
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }} transition={{ type: "spring", damping: 20 }}
            className="bg-white dark:bg-surface-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <div className={`w-12 h-12 rounded-full ${config.iconBg} flex items-center justify-center mb-4`}>
                <config.icon className={`w-6 h-6 ${config.iconColor}`} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{title}</h3>
              {description && <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{description}</p>}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={onCancel} disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
                {cancelText}
              </button>
              <button onClick={onConfirm} disabled={loading}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${config.buttonClass}`}>
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
