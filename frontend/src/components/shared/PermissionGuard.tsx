import { Navigate } from "react-router-dom"
import { useAuthStore } from "@/store/auth"
import { Shield } from "lucide-react"

interface PermissionGuardProps {
  children: React.ReactNode
  permission?: string
  permissions?: string[]
  roles?: string[]
  fallback?: React.ReactNode
  redirectTo?: string
}

/**
 * PermissionGuard — Renders children only if the user has the required permission(s) or role(s).
 * Supports single permission, multiple permissions (OR logic), and role-based access.
 */
export function PermissionGuard({
  children,
  permission,
  permissions,
  roles,
  fallback,
  redirectTo,
}: PermissionGuardProps) {
  const user = useAuthStore((s) => s.user)
  const hasPermission = useAuthStore((s) => s.hasPermission)

  // Check role-based access
  if (roles && roles.length > 0) {
    if (!user?.role || !roles.includes(user.role)) {
      if (redirectTo) return <Navigate to={redirectTo} replace />
      return <>{fallback || <AccessDenied />}</>
    }
  }

  // Check permission-based access (single)
  if (permission) {
    if (!hasPermission(permission)) {
      if (redirectTo) return <Navigate to={redirectTo} replace />
      return <>{fallback || <AccessDenied />}</>
    }
  }

  // Check permission-based access (any of multiple)
  if (permissions && permissions.length > 0) {
    const hasAny = permissions.some((p) => hasPermission(p))
    if (!hasAny) {
      if (redirectTo) return <Navigate to={redirectTo} replace />
      return <>{fallback || <AccessDenied />}</>
    }
  }

  return <>{children}</>
}

function AccessDenied() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Access Denied</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
          You do not have permission to view this page. Contact your administrator if you believe this is an error.
        </p>
      </div>
    </div>
  )
}
