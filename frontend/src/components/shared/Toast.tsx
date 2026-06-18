import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react"
import * as ToastPrimitive from "@radix-ui/react-toast"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react"

type ToastVariant = "success" | "error" | "warning" | "info"

interface ToastItem {
  id: string
  variant: ToastVariant
  title: string
  description?: string
}

interface ToastContextValue {
  toast: (opts: Omit<ToastItem, "id">) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const VARIANT_CONFIG: Record<ToastVariant, { icon: typeof CheckCircle2; className: string }> = {
  success: {
    icon: CheckCircle2,
    className: "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20",
  },
  error: {
    icon: XCircle,
    className: "border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/20",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20",
  },
  info: {
    icon: Info,
    className: "border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-900/20",
  },
}

const ICON_COLORS: Record<ToastVariant, string> = {
  success: "text-emerald-500",
  error: "text-red-500",
  warning: "text-amber-500",
  info: "text-blue-500",
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((opts: Omit<ToastItem, "id">) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { ...opts, id }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={4000}>
        {children}
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => {
            const config = VARIANT_CONFIG[t.variant]
            const Icon = config.icon
            return (
              <ToastPrimitive.Root key={t.id} asChild forceMount>
                <motion.div
                  initial={{ opacity: 0, x: 100, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 100, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg ${config.className} mb-2 min-w-[320px] max-w-[420px]`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${ICON_COLORS[t.variant]}`} />
                  <div className="flex-1 min-w-0">
                    <ToastPrimitive.Title className="text-sm font-semibold text-slate-900 dark:text-white">
                      {t.title}
                    </ToastPrimitive.Title>
                    {t.description && (
                      <ToastPrimitive.Description className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {t.description}
                      </ToastPrimitive.Description>
                    )}
                  </div>
                  <ToastPrimitive.Close asChild>
                    <button
                      onClick={() => removeToast(t.id)}
                      className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-slate-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </ToastPrimitive.Close>
                </motion.div>
              </ToastPrimitive.Root>
            )
          })}
        </AnimatePresence>
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col items-end" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}
