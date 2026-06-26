import { useEffect, useRef, useState, useCallback } from "react"
import { useAuthStore } from "@/store/auth"

type WsStatus = "connecting" | "connected" | "disconnected" | "error"

/**
 * GPS update payload received from the backend WebSocket.
 */
export interface GPSWebSocketUpdate {
  type: "gps_update"
  vehicle_id: string
  registration_no: string
  latitude: number
  longitude: number
  speed: number
  heading: number
  timestamp: string
}

/**
 * WebSocket hook for real-time GPS vehicle position updates.
 *
 * Connects to /api/gps/stream with JWT authentication.
 * Dispatches 'ws-gps-update' CustomEvents for each incoming update,
 * allowing the AVLS map to react without re-rendering the entire tree.
 *
 * Auto-reconnects with exponential backoff (same pattern as useNotificationSocket).
 */
export function useGPSSocket() {
  const [status, setStatus] = useState<WsStatus>("disconnected")
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const token = localStorage.getItem("access_token")
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const connect = useCallback(() => {
    if (!isAuthenticated || !token) return

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = import.meta.env.VITE_WS_URL || `${protocol}//${window.location.hostname}:8000`
    const url = `${host}/api/gps/stream?token=${token}`

    setStatus("connecting")
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus("connected")
      retryRef.current = 0

      // Heartbeat ping to keep connection alive
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

        // Dispatch per-vehicle update event (O(1) for map subscribers)
        if (data.type === "gps_update") {
          window.dispatchEvent(
            new CustomEvent("ws-gps-update", { detail: data as GPSWebSocketUpdate })
          )
        }
      } catch {
        // Ignore JSON parse errors
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
  }, [isAuthenticated, token])

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
