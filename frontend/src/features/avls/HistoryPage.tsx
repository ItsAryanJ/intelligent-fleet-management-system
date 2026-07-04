import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import api from "@/lib/api"
import "leaflet/dist/leaflet.css"
import { History, Search, Play, Pause, SkipForward, SkipBack, Gauge, Clock, MapPin, Loader2, ChevronUp, ChevronDown } from "lucide-react"

interface Ping {
  latitude: number
  longitude: number
  speed: number
  heading: number
  ignition_on: boolean
  timestamp: string
}

interface Analytics {
  distance_km: number
  avg_speed: number
  max_speed: number
  idle_time_mins: number
  moving_time_mins: number
  total_time_mins: number
  total_pings: number
}

/**
 * Split pings into trip segments.
 * A new segment starts when there's a time gap > 30 minutes.
 */
function segmentTrips(pings: Ping[]): Ping[][] {
  if (pings.length === 0) return []
  const segments: Ping[][] = [[pings[0]]]
  const GAP_THRESHOLD_MS = 30 * 60 * 1000

  for (let i = 1; i < pings.length; i++) {
    const prev = pings[i - 1]
    const curr = pings[i]
    const timeDelta = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()

    if (timeDelta > GAP_THRESHOLD_MS) {
      segments.push([curr])
    } else {
      segments[segments.length - 1].push(curr)
    }
  }

  // Filter out segments that are purely stationary (all speed=0)
  return segments.filter(seg => seg.some(p => p.speed > 2))
}

export function HistoryPage() {
  const [selectedVehicle, setSelectedVehicle] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackIdx, setPlaybackIdx] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [infoPanelOpen, setInfoPanelOpen] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Leaflet refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const trailLayerRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const startMarkerRef = useRef<any>(null)
  const endMarkerRef = useRef<any>(null)

  // Fetch vehicles for the dropdown
  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-list"],
    queryFn: async () => {
      const res = await api.get("/vehicles", { params: { page_size: 100 } })
      return res.data?.items || res.data || []
    },
  })

  // Fetch GPS history when vehicle+date selected
  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ["gps-history", selectedVehicle, selectedDate],
    queryFn: async () => {
      const res = await api.get(`/gps/history/${selectedVehicle}`, {
        params: { start_date: selectedDate },
      })
      return res.data as { pings: Ping[]; total_pings: number }
    },
    enabled: !!selectedVehicle && !!selectedDate,
  })

  // Fetch trip analytics
  const { data: analytics, isLoading: loadingAnalytics } = useQuery({
    queryKey: ["trip-analytics", selectedVehicle, selectedDate],
    queryFn: async () => {
      const res = await api.get(`/gps/trip-analytics/${selectedVehicle}`, {
        params: { trip_date: selectedDate },
      })
      return res.data as Analytics
    },
    enabled: !!selectedVehicle && !!selectedDate,
  })

  const pings = useMemo(() =>
    [...(historyData?.pings || [])].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    ), [historyData]
  )

  const tripSegments = useMemo(() => segmentTrips(pings), [pings])
  const playablePings = useMemo(() => tripSegments.flat(), [tripSegments])

  const hasData = !!selectedVehicle && playablePings.length > 0
  const isLoading = loadingHistory || loadingAnalytics

  // Playback controls
  const startPlayback = useCallback(() => {
    if (playablePings.length === 0) return
    setIsPlaying(true)
  }, [playablePings.length])

  const stopPlayback = useCallback(() => {
    setIsPlaying(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  useEffect(() => {
    if (isPlaying && playablePings.length > 0) {
      intervalRef.current = setInterval(() => {
        setPlaybackIdx((prev) => {
          if (prev >= playablePings.length - 1) {
            setIsPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, 200 / playbackSpeed)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPlaying, playbackSpeed, playablePings.length])

  const currentPing = playablePings[playbackIdx] || null

  // ── Initialize Leaflet Map (runs once on mount — div is always in DOM) ──
  useEffect(() => {
    if (!mapContainerRef.current || mapInstance.current) return

    let cancelled = false

    const loadMap = async () => {
      const L = await import("leaflet")
      if (cancelled) return
      leafletRef.current = L

      const map = L.map(mapContainerRef.current!, {
        center: [28.7041, 77.1025],
        zoom: 10,
        zoomControl: false,
      })

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/">CartoDB</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map)

      L.control.zoom({ position: "bottomright" }).addTo(map)
      mapInstance.current = map
      setMapReady(true)

      // Force tile redraw after a short delay to handle any layout shifts
      setTimeout(() => {
        if (map && !cancelled) {
          map.invalidateSize()
        }
      }, 200)
    }

    loadMap()

    return () => {
      cancelled = true
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
        setMapReady(false)
      }
    }
  }, [])

  // ── Invalidate map size whenever the map container becomes visible ──
  useEffect(() => {
    if (!mapInstance.current || !hasData) return
    // The map div may have had display:none; recalculate dimensions
    setTimeout(() => {
      mapInstance.current?.invalidateSize()
    }, 100)
  }, [hasData, mapReady])

  // ── Draw trip segments on map ─────────────────────────────────────
  useEffect(() => {
    if (!mapInstance.current || !leafletRef.current || !mapReady) return
    const L = leafletRef.current
    const map = mapInstance.current

    // Clear previous trail layers
    if (trailLayerRef.current) {
      trailLayerRef.current.clearLayers()
    } else {
      trailLayerRef.current = L.layerGroup().addTo(map)
    }

    // Remove old markers
    if (startMarkerRef.current) { startMarkerRef.current.remove(); startMarkerRef.current = null }
    if (endMarkerRef.current) { endMarkerRef.current.remove(); endMarkerRef.current = null }

    if (tripSegments.length === 0 || playablePings.length === 0) return

    // Draw each trip segment as a separate polyline (prevents cross-trip jumps)
    const allBounds: [number, number][] = []
    const colors = ["#6366f1", "#8b5cf6", "#a78bfa"]

    tripSegments.forEach((segment, segIdx) => {
      if (segment.length < 2) return
      const coords: [number, number][] = segment.map(p => [p.latitude, p.longitude])
      allBounds.push(...coords)

      // Dim trail (full route preview)
      L.polyline(coords, {
        color: "rgba(148,163,184,0.35)",
        weight: 2,
        smoothFactor: 1.5,
      }).addTo(trailLayerRef.current)

      // Colored trail
      L.polyline(coords, {
        color: colors[segIdx % colors.length],
        weight: 3.5,
        opacity: 0.8,
        smoothFactor: 1.5,
      }).addTo(trailLayerRef.current)
    })

    // Start marker (green)
    const firstPing = playablePings[0]
    startMarkerRef.current = L.circleMarker(
      [firstPing.latitude, firstPing.longitude],
      { radius: 7, fillColor: "#22c55e", color: "white", weight: 2, fillOpacity: 1 }
    ).addTo(map).bindTooltip("Start", { permanent: false })

    // End marker (red)
    const lastPing = playablePings[playablePings.length - 1]
    endMarkerRef.current = L.circleMarker(
      [lastPing.latitude, lastPing.longitude],
      { radius: 7, fillColor: "#ef4444", color: "white", weight: 2, fillOpacity: 1 }
    ).addTo(map).bindTooltip("End", { permanent: false })

    // Fit bounds
    if (allBounds.length > 1) {
      map.fitBounds(L.latLngBounds(allBounds), { padding: [40, 40] })
    }
  }, [tripSegments, playablePings, mapReady])

  // ── Update current-position marker during playback ─────────────────
  useEffect(() => {
    if (!mapInstance.current || !leafletRef.current || !currentPing) return
    const L = leafletRef.current
    const map = mapInstance.current

    if (!markerRef.current) {
      markerRef.current = L.circleMarker(
        [currentPing.latitude, currentPing.longitude],
        { radius: 8, fillColor: "#6366f1", color: "white", weight: 3, fillOpacity: 1 }
      ).addTo(map)
    } else {
      markerRef.current.setLatLng([currentPing.latitude, currentPing.longitude])
    }
  }, [currentPing])

  // Clean up playback marker on vehicle/date change
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
    setPlaybackIdx(0)
    stopPlayback()
  }, [selectedVehicle, selectedDate, stopPlayback])

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-brand-500" />
            AVLS History & Replay
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            View historical GPS trails and replay vehicle journeys
          </p>
        </div>
      </div>

      {/* Controls bar */}
      <div className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Vehicle</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={selectedVehicle}
                onChange={(e) => { setSelectedVehicle(e.target.value); setPlaybackIdx(0); stopPlayback() }}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select vehicle...</option>
                {(vehicles || []).map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.registration_no} — {v.make} {v.model}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setPlaybackIdx(0); stopPlayback() }}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Playback Speed</label>
            <div className="flex items-center gap-2">
              {[1, 2, 5, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${playbackSpeed === s
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content area — map div is ALWAYS in the DOM for Leaflet */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      )}

      {!isLoading && !selectedVehicle && (
        <div className="text-center py-20">
          <MapPin className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Select a vehicle and date to view history</p>
        </div>
      )}

      {!isLoading && selectedVehicle && !hasData && (
        <div className="text-center py-20">
          <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">No GPS data for this vehicle on {selectedDate}</p>
        </div>
      )}

      {/* This grid is always rendered — collapses when no data but keeps map div in DOM */}
      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-5"
        style={hasData && !isLoading
          ? {}
          : { height: 0, overflow: "hidden", opacity: 0, pointerEvents: "none", position: "absolute", left: -9999 }}
      >
        {/* Map with Leaflet */}
        <div className="lg:col-span-2 bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            GPS Trail — {playablePings.length} points
            {tripSegments.length > 0 && ` (${tripSegments.length} trip${tripSegments.length !== 1 ? "s" : ""})`}
          </h3>

          {/* Leaflet map container — ALWAYS in DOM */}
          <div className="relative rounded-lg overflow-hidden" style={{ height: 420 }}>
            <div ref={mapContainerRef} className="absolute inset-0" />

            {/* Collapsible current-position info overlay — top-right */}
            {currentPing && (
              <div className="absolute top-3 right-3" style={{ zIndex: 1000 }}>
                <button
                  onClick={() => setInfoPanelOpen(p => !p)}
                  className="flex items-center gap-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-t-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900 transition-colors"
                >
                  {infoPanelOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Position Info
                </button>
                {infoPanelOpen && (
                  <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-b-lg rounded-bl-lg border border-t-0 border-slate-200 dark:border-slate-700 p-3 text-xs min-w-[180px]">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <span className="text-slate-400">Speed</span>
                      <span className="font-mono font-semibold text-slate-700 dark:text-white">
                        {currentPing.speed.toFixed(1)} km/h
                      </span>
                      <span className="text-slate-400">Heading</span>
                      <span className="font-mono text-slate-700 dark:text-white">{currentPing.heading.toFixed(0)}°</span>
                      <span className="text-slate-400">Time</span>
                      <span className="font-mono text-slate-700 dark:text-white">
                        {new Date(currentPing.timestamp).toLocaleTimeString("en-IN")}
                      </span>
                      <span className="text-slate-400">Position</span>
                      <span className="font-mono text-slate-700 dark:text-white text-[10px]">
                        {currentPing.latitude.toFixed(5)}, {currentPing.longitude.toFixed(5)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Playback controls */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-mono w-16">
                {playablePings[playbackIdx] ? new Date(playablePings[playbackIdx].timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(0, playablePings.length - 1)}
                value={playbackIdx}
                onChange={(e) => { setPlaybackIdx(Number(e.target.value)); stopPlayback() }}
                className="flex-1 accent-brand-500"
              />
              <span className="text-xs text-slate-400 font-mono w-16 text-right">
                {playablePings.length > 0 ? new Date(playablePings[playablePings.length - 1].timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
              </span>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => { setPlaybackIdx(0); stopPlayback() }}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={isPlaying ? stopPlayback : startPlayback}
                className="p-3 rounded-xl bg-brand-600 text-white hover:bg-brand-500 transition-colors shadow-md shadow-brand-500/20"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button
                onClick={() => { setPlaybackIdx(Math.max(0, playablePings.length - 1)); stopPlayback() }}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-400 ml-2">
                Point {playbackIdx + 1} / {playablePings.length || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Analytics sidebar */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Trip Analytics</h3>
            <div className="space-y-4">
              <AnalyticItem icon={MapPin} label="Distance" value={`${analytics?.distance_km?.toFixed(1) || 0} km`} color="text-blue-500" />
              <AnalyticItem icon={Gauge} label="Avg Speed" value={`${analytics?.avg_speed?.toFixed(1) || 0} km/h`} color="text-emerald-500" />
              <AnalyticItem icon={Gauge} label="Max Speed" value={`${analytics?.max_speed?.toFixed(1) || 0} km/h`} color="text-red-500" />
              <AnalyticItem icon={Clock} label="Moving Time" value={`${analytics?.moving_time_mins?.toFixed(0) || 0} min`} color="text-violet-500" />
              <AnalyticItem icon={Clock} label="Idle Time" value={`${analytics?.idle_time_mins?.toFixed(0) || 0} min`} color="text-amber-500" />
              <AnalyticItem icon={Clock} label="Total Time" value={`${analytics?.total_time_mins?.toFixed(0) || 0} min`} color="text-slate-500" />
            </div>
          </div>

          {/* Speed chart */}
          <div className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Speed Profile</h3>
            <div className="flex items-end gap-px h-32">
              {playablePings.length > 0 && (() => {
                const maxSpeed = Math.max(...playablePings.map(p => p.speed), 1)
                const step = Math.max(1, Math.floor(playablePings.length / 80))
                const sampled = playablePings.filter((_, i) => i % step === 0)
                return sampled.map((p, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t transition-all ${i <= Math.floor(playbackIdx / step)
                      ? p.speed > 60 ? "bg-red-400" : p.speed > 30 ? "bg-brand-500" : "bg-emerald-400"
                      : "bg-slate-200 dark:bg-slate-700"
                      }`}
                    style={{ height: `${Math.max(2, (p.speed / maxSpeed) * 100)}%` }}
                    title={`${p.speed.toFixed(1)} km/h`}
                  />
                ))
              })()}
            </div>
            <div className="flex justify-between text-[9px] text-slate-400 mt-1">
              <span>Start</span>
              <span>End</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AnalyticItem({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-slate-50 dark:bg-slate-800 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <p className="text-[10px] text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-800 dark:text-white">{value}</p>
      </div>
    </div>
  )
}
