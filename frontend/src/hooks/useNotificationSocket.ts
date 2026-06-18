import { useEffect, useRef, useState, useCallback } from "react"
import { useAuthStore } from "@/store/auth"
import { useQueryClient } from "@tanstack/react-query"

type WsStatus = "connecting" | "connected" | "disconnected" | "error"

/**
 * WebSocket hook for real-time notifications.
 * Auto-reconnects with exponential backoff.
 * Invalidates notification queries on new messages.
 */
export function useNotificationSocket() {
  const [status, setStatus] = useState<WsStatus>("disconnected")
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const token = localStorage.getItem("access_token")
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const queryClient = useQueryClient()

  const connect = useCallback(() => {
    if (!isAuthenticated || !token) return

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = import.meta.env.VITE_WS_URL || `${protocol}//${window.location.hostname}:8000`
    const url = `${host}/api/notifications/ws?token=${token}`

    setStatus("connecting")
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus("connected")
      retryRef.current = 0

      // Start heartbeat
      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping")
        }
      }, 30000)

      ws.addEventListener("close", () => clearInterval(heartbeat))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === "pong") return

        // Invalidate notification queries to trigger re-fetch
        queryClient.invalidateQueries({ queryKey: ["notifications"] })
        queryClient.invalidateQueries({ queryKey: ["unread-count"] })

        // Dispatch custom event for cross-component updates
        window.dispatchEvent(new CustomEvent("ws-notification", { detail: data }))
      } catch (e) {
        // Ignore parse errors
      }
    }

    ws.onerror = () => {
      setStatus("error")
    }

    ws.onclose = () => {
      setStatus("disconnected")
      wsRef.current = null

      // Reconnect with exponential backoff (max 30s)
      const delay = Math.min(1000 * Math.pow(2, retryRef.current), 30000)
      retryRef.current += 1
      timerRef.current = setTimeout(connect, delay)
    }
  }, [isAuthenticated, token, queryClient])

  useEffect(() => {
    connect()
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  return { status }
}
