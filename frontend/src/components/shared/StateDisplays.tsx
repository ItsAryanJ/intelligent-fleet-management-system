import type { LucideIcon } from "lucide-react"
import { Inbox, Search, AlertCircle, FileX, Loader2 } from "lucide-react"
// ── Empty State ─────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-400 max-w-xs">{description}</p>}
      {action && (
        <button onClick={action.onClick}
          className="mt-4 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 transition-colors">
          {action.label}
        </button>
      )}
    </div>
  )
}

// ── Loading State ───────────────────────────────────────────────────────
interface LoadingStateProps {
  text?: string
  rows?: number
}

export function LoadingState({ text = "Loading...", rows = 3 }: LoadingStateProps) {
  return (
    <div className="space-y-3 p-4">
      {text && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{text}</span>
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-14 rounded-xl" style={{ animationDelay: `${i * 100}ms` }} />
      ))}
    </div>
  )
}

// ── Error State ─────────────────────────────────────────────────────────
interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({ title = "Something went wrong", description, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7 text-red-500" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-400 max-w-xs">{description}</p>}
      {onRetry && (
        <button onClick={onRetry}
          className="mt-4 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 transition-colors">
          Try Again
        </button>
      )}
    </div>
  )
}

// ── No Results State ────────────────────────────────────────────────────
interface NoResultsProps {
  query?: string
}

export function NoResults({ query }: NoResultsProps) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={query ? `No matches for "${query}". Try a different search term.` : "Try adjusting your filters."}
    />
  )
}
