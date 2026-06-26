import { useState, useEffect } from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/auth"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { motion, AnimatePresence } from "framer-motion"
import { CommandPalette } from "./CommandPalette"
import { NotificationCenter } from "./NotificationCenter"
import { useNotificationSocket } from "@/hooks/useNotificationSocket"
import {
  LayoutDashboard, Map, Bus, Route, CalendarDays,
  AlertTriangle, Megaphone, BarChart3, Users, Bot,
  ChevronLeft, ChevronRight, LogOut, Moon, Sun,
  Bell, Search, Menu, Shield, Activity, FileText, ClipboardList, CalendarCheck, HeartPulse,
} from "lucide-react"

const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: null },
  { path: "/avls", label: "Live Fleet Map", icon: Map, permission: "gps.view" },
  { path: "/vehicles", label: "Vehicles", icon: Bus, permission: "vehicle.view" },
  { path: "/routes", label: "Routes", icon: Route, permission: "route.view" },
  { path: "/duties", label: "Duty Schedule", icon: CalendarDays, permission: "duty.view" },
  { path: "/incidents", label: "Incidents", icon: AlertTriangle, permission: "incident.view" },
  { path: "/notices", label: "Notices", icon: Megaphone, permission: "notice.view" },
  { path: "/leaves", label: "Leave Mgmt", icon: CalendarCheck, permission: null },
  { path: "/analytics", label: "Analytics", icon: BarChart3, permission: "analytics.view" },
  { path: "/reports", label: "Reports", icon: FileText, permission: "report.view" },
  { path: "/audit", label: "Audit Log", icon: ClipboardList, permission: "audit.view" },
  { path: "/system-health", label: "System Health", icon: HeartPulse, permission: "audit.view" },
  { path: "/users", label: "Users", icon: Users, permission: "user.view" },
  { path: "/copilot", label: "AI Copilot", icon: Bot, permission: "copilot.use" },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { user, logout, theme, toggleTheme, hasPermission } = useAuthStore()
  const location = useLocation()

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const filteredNav = NAV_ITEMS.filter(
    (item) => !item.permission || hasPermission(item.permission)
  )
  const navigate = useNavigate()

  const { data: notificationData } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => {
      const res = await api.get("/notifications/unread-count")
      return res.data
    },
    refetchInterval: 30000,
  })
  const unreadCount = notificationData?.count || 0
  const { status: wsStatus } = useNotificationSocket()

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50 dark:bg-surface-950">
      {/* ── Mobile overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <aside
        className={`sidebar fixed lg:static z-50 h-full transition-all duration-300 ease-in-out flex flex-col ${collapsed ? "w-[72px]" : "w-64"
          } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
              <p className="text-sm font-bold text-white tracking-tight">NCRTC Fleet</p>
              <p className="text-[10px] text-slate-400 font-medium">Operations Platform</p>
            </motion.div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-item ${isActive ? "active" : ""} ${collapsed ? "justify-center px-3" : ""}`
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-white/5 space-y-2">
          <button
            onClick={toggleTheme}
            className="sidebar-item w-full"
            title={collapsed ? (theme === "dark" ? "Light Mode" : "Dark Mode") : undefined}
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {!collapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="sidebar-item w-full hidden lg:flex"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!collapsed && <span>Collapse</span>}
          </button>

          <button onClick={logout} className="sidebar-item w-full text-red-400 hover:text-red-300">
            <LogOut className="w-5 h-5" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>

          </div>

          <div className="flex items-center gap-3">
            {/* WebSocket connection status */}
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${wsStatus === "connected"
              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
              : wsStatus === "connecting"
                ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              }`}>
              <span className={`w-2 h-2 rounded-full ${wsStatus === "connected" ? "bg-emerald-500 animate-pulse-dot"
                : wsStatus === "connecting" ? "bg-amber-500 animate-pulse"
                  : "bg-slate-400"
                }`} />
              {wsStatus === "connected" ? "Live" : wsStatus === "connecting" ? "Connecting" : "Offline"}
            </div>

            {/* Notifications */}
            <button
              onClick={() => setNotifOpen(true)}
              className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {/* User */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-700">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white text-xs font-bold">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {user?.role?.replace("_", " ")}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Global Search (Ctrl+K) */}
      {searchOpen && <CommandPalette />}

      {/* Notification Center */}
      <NotificationCenter open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  )
}
