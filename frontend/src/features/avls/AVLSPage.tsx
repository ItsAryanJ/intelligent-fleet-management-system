import { useEffect, useState, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import api from "@/lib/api"
import type { GPSPosition } from "@/types"
import {
  Bus, MapPin, Gauge, Navigation, Fuel, Activity,
  Filter, RefreshCw, Maximize2, Layers, Signal,
} from "lucide-react"

export function AVLSPage() {
  const [selectedVehicle, setSelectedVehicle] = useState<GPSPosition | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("ALL")
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapInstance, setMapInstance] = useState<any>(null)
  const [markers, setMarkers] = useState<any[]>([])

  const { data: positions = [], isLoading, refetch } = useQuery({
    queryKey: ["gps", "live"],
    queryFn: async () => {
      const res = await api.get("/gps/live")
      return res.data as GPSPosition[]
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  })

  const filteredPositions = filterStatus === "ALL"
    ? positions
    : positions.filter((p) => p.status === filterStatus)

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || mapInstance) return

    const loadMap = async () => {
      const L = await import("leaflet")
      await import("leaflet/dist/leaflet.css")

      const map = L.map(mapRef.current!, {
        center: [28.7041, 77.1025], // NCR center
        zoom: 10,
        zoomControl: false,
      })

      // OpenStreetMap tiles (free)
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '© CartoDB © OSM',
        maxZoom: 19,
      }).addTo(map)

      L.control.zoom({ position: "bottomright" }).addTo(map)
      setMapInstance(map)
    }

    loadMap()

    return () => {
      if (mapInstance) {
        mapInstance.remove()
      }
    }
  }, [])

  // Update markers when positions change
  useEffect(() => {
    if (!mapInstance) return

    const L = (window as any).L
    if (!L) return

    // Clear old markers
    markers.forEach((m: any) => m.remove())

    const newMarkers = filteredPositions.map((pos) => {
      const statusColor = pos.status === "ACTIVE" ? "#10b981"
        : pos.status === "MAINTENANCE" ? "#f59e0b"
        : pos.status === "BREAKDOWN" ? "#ef4444"
        : "#64748b"

      const icon = L.divIcon({
        className: "custom-marker",
        html: `
          <div style="
            width: 32px; height: 32px; border-radius: 50%;
            background: ${statusColor}; border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center;
            transform: rotate(${pos.heading}deg);
            transition: all 0.5s ease;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L4 20L12 16L20 20L12 2Z"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })

      const marker = L.marker([pos.latitude, pos.longitude], { icon })
        .addTo(mapInstance)
        .on("click", () => setSelectedVehicle(pos))

      marker.bindPopup(`
        <div style="font-family: Inter, sans-serif; min-width: 180px;">
          <strong style="font-size: 13px;">${pos.registration_no}</strong>
          <div style="margin-top: 4px; font-size: 11px; color: #94a3b8;">
            ${pos.vehicle_type} · ${pos.depot_name || "—"}
          </div>
          <div style="margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px;">
            <span>Speed: <strong>${pos.speed?.toFixed(0)} km/h</strong></span>
            <span>Heading: <strong>${pos.heading?.toFixed(0)}°</strong></span>
          </div>
        </div>
      `)

      return marker
    })

    setMarkers(newMarkers)
  }, [mapInstance, filteredPositions])

  const statusCounts = {
    ALL: positions.length,
    ACTIVE: positions.filter((p) => p.status === "ACTIVE").length,
    MAINTENANCE: positions.filter((p) => p.status === "MAINTENANCE").length,
    BREAKDOWN: positions.filter((p) => p.status === "BREAKDOWN").length,
    IDLE: positions.filter((p) => p.status === "IDLE").length,
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
            {positions.length} vehicles tracked
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
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Last updated: {selectedVehicle.last_updated || "Just now"}
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
