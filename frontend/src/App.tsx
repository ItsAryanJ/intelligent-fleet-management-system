import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useAuthStore } from "@/store/auth"
import { AppShell } from "@/components/shared/AppShell"
import { ToastProvider } from "@/components/shared/Toast"
import { ErrorBoundary } from "@/components/shared/ErrorBoundary"
import { PermissionGuard } from "@/components/shared/PermissionGuard"
import { LoginPage } from "@/features/auth/LoginPage"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import { VehiclesPage } from "@/features/vehicles/VehiclesPage"
import { RoutesPage } from "@/features/routes/RoutesPage"
import { DutiesPage } from "@/features/duties/DutiesPage"
import { IncidentsPage } from "@/features/incidents/IncidentsPage"
import { NoticesPage } from "@/features/notices/NoticesPage"
import { UsersPage } from "@/features/users/UsersPage"
import { AVLSPage } from "@/features/avls/AVLSPage"
import { AnalyticsPage } from "@/features/analytics/AnalyticsPage"
import { CopilotPage } from "@/features/copilot/CopilotPage"
import { ReportsPage } from "@/features/reports/ReportsPage"
import { AuditPage } from "@/features/audit/AuditPage"
import { LeavesPage } from "@/features/leaves/LeavesPage"
import { SystemHealthPage } from "@/features/system/SystemHealthPage"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30000 },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppShell>
                      <Routes>
                        {/* Dashboard — role-dispatched internally, all roles can access */}
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/dashboard" element={<DashboardPage />} />

                        {/* AVLS — requires gps.view */}
                        <Route path="/avls" element={
                          <PermissionGuard permission="gps.view">
                            <AVLSPage />
                          </PermissionGuard>
                        } />

                        {/* Vehicles — requires vehicle.view */}
                        <Route path="/vehicles" element={
                          <PermissionGuard permission="vehicle.view">
                            <VehiclesPage />
                          </PermissionGuard>
                        } />

                        {/* Routes — requires route.view */}
                        <Route path="/routes" element={
                          <PermissionGuard permission="route.view">
                            <RoutesPage />
                          </PermissionGuard>
                        } />

                        {/* Duties — requires duty.view */}
                        <Route path="/duties" element={
                          <PermissionGuard permission="duty.view">
                            <DutiesPage />
                          </PermissionGuard>
                        } />

                        {/* Incidents — requires incident.view */}
                        <Route path="/incidents" element={
                          <PermissionGuard permission="incident.view">
                            <IncidentsPage />
                          </PermissionGuard>
                        } />

                        {/* Notices — requires notice.view */}
                        <Route path="/notices" element={
                          <PermissionGuard permission="notice.view">
                            <NoticesPage />
                          </PermissionGuard>
                        } />

                        {/* Analytics — requires analytics.view */}
                        <Route path="/analytics" element={
                          <PermissionGuard permission="analytics.view">
                            <AnalyticsPage />
                          </PermissionGuard>
                        } />

                        {/* Users — requires user.view */}
                        <Route path="/users" element={
                          <PermissionGuard permission="user.view">
                            <UsersPage />
                          </PermissionGuard>
                        } />

                        {/* Copilot — requires copilot.use */}
                        <Route path="/copilot" element={
                          <PermissionGuard permission="copilot.use">
                            <CopilotPage />
                          </PermissionGuard>
                        } />

                        {/* Reports — requires report.view */}
                        <Route path="/reports" element={
                          <PermissionGuard permission="report.view">
                            <ReportsPage />
                          </PermissionGuard>
                        } />

                        {/* Audit — requires audit.view */}
                        <Route path="/audit" element={
                          <PermissionGuard permission="audit.view">
                            <AuditPage />
                          </PermissionGuard>
                        } />

                        {/* Leave Management — all authenticated */}
                        <Route path="/leaves" element={<LeavesPage />} />

                        {/* System Health — admin only */}
                        <Route path="/system-health" element={
                          <PermissionGuard roles={["ADMIN"]}>
                            <SystemHealthPage />
                          </PermissionGuard>
                        } />

                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </AppShell>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
