import { useAuthStore } from "@/store/auth"
import { AdminDashboard } from "./AdminDashboard"
import { ControlOperatorDashboard } from "./ControlOperatorDashboard"
import { DepotManagerDashboard } from "./DepotManagerDashboard"
import { DriverDashboard } from "./DriverDashboard"
import { ConductorDashboard } from "./ConductorDashboard"
import { ExecutiveDashboard } from "./ExecutiveDashboard"

/**
 * DashboardPage — Routes to the correct role-specific dashboard.
 * No shared generic dashboard remains; each role gets a fully tailored view.
 */
export function DashboardPage() {
  const role = useAuthStore((s) => s.user?.role)

  switch (role) {
    case "ADMIN":
      return <AdminDashboard />
    case "CONTROL_OPERATOR":
      return <ControlOperatorDashboard />
    case "DEPOT_MANAGER":
      return <DepotManagerDashboard />
    case "DRIVER":
      return <DriverDashboard />
    case "CONDUCTOR":
      return <ConductorDashboard />
    case "EXECUTIVE":
      return <ExecutiveDashboard />
    default:
      // Fallback to Admin for unknown roles
      return <AdminDashboard />
  }
}
