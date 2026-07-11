import { useEffect, useState, useRef, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import api from "@/lib/api"
import { useGPSSocket } from "@/hooks/useGPSSocket"
import type { GPSPosition, GPSWebSocketUpdate } from "@/types"
import {
  Bus, MapPin, Gauge, Navigation, Fuel, Activity,
  Filter, RefreshCw, Maximize2, Layers, Signal, Radio,
} from "lucide-react"

// ─── Smooth marker animation duration (ms) ─────────────────────────────────
const SLIDE_DURATION_MS = 1800

/**
 * Smoothly animate a Leaflet marker from its current position to a target.
 * Uses requestAnimationFrame for 60fps interpolation, similar to Google Maps.
 */
function slideTo(
  marker: any,
  targetLat: number,
  targetLng: number,
  durationMs: number
) {
  const start = performance.now()
  const from = marker.getLatLng()
  const fromLat = from.lat
  const fromLng = from.lng
  const dLat = targetLat - fromLat
  const dLng = targetLng - fromLng

  // Skip animation if distance is negligible (< ~1m)
  if (Math.abs(dLat) < 0.00001 && Math.abs(dLng) < 0.00001) return

  function animate(now: number) {
    const elapsed = now - start
    const t = Math.min(elapsed / durationMs, 1)
    // Ease-out cubic for natural deceleration feel
    const ease = 1 - Math.pow(1 - t, 3)

    const lat = fromLat + dLat * ease
    const lng = fromLng + dLng * ease
    marker.setLatLng([lat, lng])

    if (t < 1) {
      requestAnimationFrame(animate)
    }
  }

  requestAnimationFrame(animate)
}

/**
 * Build the HTML for a vehicle marker icon with rotation and status color.
 */
function buildIconHtml(heading: number, statusColor: string): string {
  return `
    <div style="
      width: 32px; height: 32px; border-radius: 50%;
      background: ${statusColor}; border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
      transform: rotate(${Math.round(heading)}deg);
      transition: transform 0.8s ease;
    ">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L4 20L12 16L20 20L12 2Z"/>
      </svg>
    </div>
  `
}

function getStatusColor(status: string): string {
  switch (status) {
    case "ACTIVE": return "#10b981"
    case "MAINTENANCE": return "#f59e0b"
    case "BREAKDOWN": return "#ef4444"
    default: return "#64748b"
  }
}

export function AVLSPage() {
  const [selectedVehicle, setSelectedVehicle] = useState<GPSPosition | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("ALL")
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const leafletRef = useRef<any>(null)

  // Persistent marker map: vehicle_id → L.Marker
  const markerMap = useRef<Map<string, any>>(new Map())

  // Latest position data for all vehicles (kept in sync via WS + initial load)
  const positionsRef = useRef<Map<string, GPSPosition>>(new Map())
  const [positionsList, setPositionsList] = useState<GPSPosition[]>([])

  // Connect to the GPS WebSocket for real-time updates
  const { status: wsStatus } = useGPSSocket()

  // Initial load of all vehicle positions
  const { isLoading, refetch } = useQuery({
    queryKey: ["gps", "live"],
    queryFn: async () => {
      const res = await api.get("/gps/live")
      const data = res.data as GPSPosition[]

      // Populate positions map
      for (const pos of data) {
        positionsRef.current.set(pos.vehicle_id, pos)
      }
      setPositionsList(data)
      return data
    },
    refetchInterval: 30000, // Fallback poll every 30s (WS handles real-time)
  })

  // ─── Initialize Leaflet Map ────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const loadMap = async () => {
      const L = await import("leaflet")
      await import("leaflet/dist/leaflet.css")
      leafletRef.current = L

      const map = L.map(mapRef.current!, {
        center: [28.7041, 77.1025], // NCR center
        zoom: 10,
        zoomControl: false,
      })

      // Dark-mode CartoDB tiles
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '© CartoDB © OSM',
        maxZoom: 19,
      }).addTo(map)

      L.control.zoom({ position: "bottomright" }).addTo(map)
      mapInstance.current = map
    }

    loadMap()

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [])

  // ─── Create / update markers from initial positions ────────────────────
  useEffect(() => {
    if (!mapInstance.current || !leafletRef.current) return

    const L = leafletRef.current
    const filteredPositions = filterStatus === "ALL"
      ? positionsList
      : positionsList.filter((p) => p.status === filterStatus)

    // Track which vehicles are visible in the current filter
    const visibleIds = new Set(filteredPositions.map((p) => p.vehicle_id))

    // Remove markers for vehicles no longer visible
    markerMap.current.forEach((marker, id) => {
      if (!visibleIds.has(id)) {
        marker.remove()
        markerMap.current.delete(id)
      }
    })

    // Create or update markers
    for (const pos of filteredPositions) {
      if (pos.latitude == null || pos.longitude == null) continue

      const existing = markerMap.current.get(pos.vehicle_id)
      if (existing) {
        // Update existing marker position (no animation on initial load)
        existing.setLatLng([pos.latitude, pos.longitude])
        // Update icon rotation
        const iconEl = existing.getElement()
        if (iconEl) {
          const inner = iconEl.querySelector("div")
          if (inner) inner.style.transform = `rotate(${Math.round(pos.heading || 0)}deg)`
        }
      } else {
        // Create new marker
        const icon = L.divIcon({
          className: "custom-marker",
          html: buildIconHtml(pos.heading || 0, getStatusColor(pos.status)),
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })

        const marker = L.marker([pos.latitude, pos.longitude], { icon })
          .addTo(mapInstance.current)
          .on("click", () => {
            // Always read latest position from the ref map
            const latest = positionsRef.current.get(pos.vehicle_id)
            setSelectedVehicle(latest || pos)
          })

        marker.bindPopup(`
          <div style="font-family: Inter, sans-serif; min-width: 180px;">
            <strong style="font-size: 13px;">${pos.registration_no}</strong>
            <div style="margin-top: 4px; font-size: 11px; color: #94a3b8;">
              ${pos.vehicle_type} · ${pos.depot_name || "—"}
            </div>
            <div style="margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px;">
              <span>Speed: <strong class="marker-speed-${pos.vehicle_id}">${pos.speed?.toFixed(0)} km/h</strong></span>
              <span>Heading: <strong class="marker-heading-${pos.vehicle_id}">${pos.heading?.toFixed(0)}°</strong></span>
            </div>
          </div>
        `)

        markerMap.current.set(pos.vehicle_id, marker)
      }
    }
  }, [positionsList, filterStatus])

  // ─── WebSocket-driven real-time marker updates ─────────────────────────
  const handleGPSUpdate = useCallback((event: Event) => {
    const update = (event as CustomEvent<GPSWebSocketUpdate>).detail
    if (!update || !update.vehicle_id) return

    // Update positions map with new data
    const existing = positionsRef.current.get(update.vehicle_id)
    if (existing) {
      existing.latitude = update.latitude
      existing.longitude = update.longitude
      existing.speed = update.speed
      existing.heading = update.heading
      existing.last_updated = update.timestamp
    } else {
      // New vehicle appeared — store it and trigger re-render to create marker
      positionsRef.current.set(update.vehicle_id, {
        vehicle_id: update.vehicle_id,
        registration_no: update.registration_no,
        vehicle_type: "BUS",
        status: "ACTIVE",
        latitude: update.latitude,
        longitude: update.longitude,
        speed: update.speed,
        heading: update.heading,
        ignition_on: true,
        last_updated: update.timestamp,
      })
      setPositionsList(Array.from(positionsRef.current.values()))
      return
    }

    // Smoothly animate existing marker to new position
    const marker = markerMap.current.get(update.vehicle_id)
    if (marker) {
      slideTo(marker, update.latitude, update.longitude, SLIDE_DURATION_MS)

      // Rotate icon to match heading
      const iconEl = marker.getElement()
      if (iconEl) {
        const inner = iconEl.querySelector("div")
        if (inner) inner.style.transform = `rotate(${Math.round(update.heading)}deg)`
      }
    }

    // Update selected vehicle panel if this vehicle is selected
    setSelectedVehicle((prev) => {
      if (prev && prev.vehicle_id === update.vehicle_id) {
        return {
          ...prev,
          latitude: update.latitude,
          longitude: update.longitude,
          speed: update.speed,
          heading: update.heading,
          last_updated: update.timestamp,
        }
      }
      return prev
    })
  }, [])

  useEffect(() => {
    window.addEventListener("ws-gps-update", handleGPSUpdate)
    return () => window.removeEventListener("ws-gps-update", handleGPSUpdate)
  }, [handleGPSUpdate])

  // ─── Status Counts ─────────────────────────────────────────────────────
  const statusCounts = {
    ALL: positionsList.length,
    ACTIVE: positionsList.filter((p) => p.status === "ACTIVE").length,
    MAINTENANCE: positionsList.filter((p) => p.status === "MAINTENANCE").length,
    BREAKDOWN: positionsList.filter((p) => p.status === "BREAKDOWN").length,
    IDLE: positionsList.filter((p) => p.status === "IDLE").length,
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="p-4 flex flex-wrap items-center gap-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Signal className="w-4 h-4 text-emerald-500 animate-pulse-dot" />
          <h2 className="text-sm font-semibold text-slate-800 dark:text-white">
            Live Fleet Tracking
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {positionsList.length} vehicles tracked
          </span>
        </div>

        {/* WebSocket status indicator */}
        <div className="flex items-center gap-1.5 ml-2">
          <span className={`w-2 h-2 rounded-full ${
            wsStatus === "connected" ? "bg-emerald-400 animate-pulse" :
            wsStatus === "connecting" ? "bg-amber-400 animate-pulse" :
            "bg-red-400"
          }`} />
          <span className="text-[10px] font-medium text-slate-400">
            {wsStatus === "connected" ? "Live" : wsStatus === "connecting" ? "Connecting..." : "Offline"}
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {(["ALL", "ACTIVE", "MAINTENANCE", "BREAKDOWN"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterStatus === status
                  ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
              <span className="ml-1 opacity-60">
                {(statusCounts as any)[status]}
              </span>
            </button>
          ))}

          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
      </div>

      {/* Map + Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full" />

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="flex items-center gap-3 text-white">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Loading fleet positions...</span>
              </div>
            </div>
          )}
        </div>

        {/* Vehicle detail panel */}
        {selectedVehicle && (
          <motion.div
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            className="w-80 bg-white dark:bg-surface-900 border-l border-slate-200 dark:border-slate-800 p-5 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {selectedVehicle.registration_no}
              </h3>
              <button
                onClick={() => setSelectedVehicle(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ×
              </button>
            </div>

            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              selectedVehicle.status === "ACTIVE"
                ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                : selectedVehicle.status === "BREAKDOWN"
                ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                selectedVehicle.status === "ACTIVE" ? "bg-emerald-500" : selectedVehicle.status === "BREAKDOWN" ? "bg-red-500" : "bg-amber-500"
              }`} />
              {selectedVehicle.status}
            </div>

            <div className="mt-5 space-y-4">
              <InfoRow icon={Bus} label="Type" value={selectedVehicle.vehicle_type} />
              <InfoRow icon={MapPin} label="Depot" value={selectedVehicle.depot_name || "—"} />
              <InfoRow icon={Gauge} label="Speed" value={`${selectedVehicle.speed?.toFixed(0)} km/h`} />
              <InfoRow icon={Navigation} label="Heading" value={`${selectedVehicle.heading?.toFixed(0)}°`} />
              <InfoRow icon={Fuel} label="Fuel Level" value={selectedVehicle.fuel_level ? `${selectedVehicle.fuel_level}%` : "—"} />
              <InfoRow icon={Activity} label="Health Score" value={selectedVehicle.health_score ? `${selectedVehicle.health_score}%` : "—"} />
              <InfoRow
                icon={Signal}
                label="Ignition"
                value={selectedVehicle.ignition_on ? "ON" : "OFF"}
              />
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              {selectedVehicle.route_name && (
                <div className="flex items-center gap-2 mb-2">
                  <Radio className="w-3.5 h-3.5 text-brand-500" />
                  <span className="text-xs font-medium text-brand-600 dark:text-brand-400">
                    {selectedVehicle.route_name}
                  </span>
                </div>
              )}
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Last updated: {selectedVehicle.last_updated
                  ? new Date(selectedVehicle.last_updated).toLocaleTimeString()
                  : "Just now"}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Lat: {selectedVehicle.latitude?.toFixed(6)}, Lon: {selectedVehicle.longitude?.toFixed(6)}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-slate-400" />
      <div className="flex-1">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{value}</p>
      </div>
    </div>
  )
}
