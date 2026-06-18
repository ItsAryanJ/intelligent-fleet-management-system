import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { User } from "@/types"
import api from "@/lib/api"

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  theme: "light" | "dark"

  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshProfile: () => Promise<void>
  setTheme: (theme: "light" | "dark") => void
  toggleTheme: () => void
  hasPermission: (permission: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      theme: "dark",

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          const res = await api.post("/auth/login", { email, password })
          const { access_token, refresh_token, user } = res.data
          localStorage.setItem("access_token", access_token)
          localStorage.setItem("refresh_token", refresh_token)
          set({ user, isAuthenticated: true, isLoading: false })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        localStorage.removeItem("access_token")
        localStorage.removeItem("refresh_token")
        set({ user: null, isAuthenticated: false })
      },

      refreshProfile: async () => {
        try {
          const res = await api.get("/auth/me")
          set({ user: res.data, isAuthenticated: true })
        } catch {
          set({ user: null, isAuthenticated: false })
        }
      },

      setTheme: (theme) => {
        set({ theme })
        document.documentElement.classList.toggle("dark", theme === "dark")
      },

      toggleTheme: () => {
        const current = get().theme
        const next = current === "dark" ? "light" : "dark"
        get().setTheme(next)
      },

      hasPermission: (permission: string) => {
        const user = get().user
        return user?.permissions?.includes(permission) ?? false
      },
    }),
    {
      name: "ncrtc-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        theme: state.theme,
      }),
    }
  )
)

// Initialize theme on load
const savedTheme = JSON.parse(localStorage.getItem("ncrtc-auth") || "{}")?.state?.theme
if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
  document.documentElement.classList.add("dark")
}
