import { useState, useRef, useEffect, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import api from "@/lib/api"
import { History, Search, Play, Pause, SkipForward, SkipBack, Gauge, Clock, MapPin, Loader2 } from "lucide-react"

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

export function HistoryPage() {
  const [selectedVehicle, setSelectedVehicle] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackIdx, setPlaybackIdx] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch vehicles for the dropdown
  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-list"],
    queryFn: async () => {
      const res = await api.get("/vehicles", { params: { page_size: 200 } })
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

  const pings = historyData?.pings || []

  // Playback controls
  const startPlayback = useCallback(() => {
    if (pings.length === 0) return
    setIsPlaying(true)
  }, [pings.length])

  const stopPlayback = useCallback(() => {
    setIsPlaying(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  useEffect(() => {
    if (isPlaying && pings.length > 0) {
      intervalRef.current = setInterval(() => {
        setPlaybackIdx((prev) => {
          if (prev >= pings.length - 1) {
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
  }, [isPlaying, playbackSpeed, pings.length])

  const currentPing = pings[playbackIdx] || null

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
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    playbackSpeed === s
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

      {/* Content area */}
      {loadingHistory || loadingAnalytics ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : selectedVehicle && pings.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Map Placeholder / Trail visualization */}
          <div className="lg:col-span-2 bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              GPS Trail — {pings.length} points
            </h3>

            {/* Trail canvas with position markers */}
            <div className="relative bg-slate-50 dark:bg-slate-800 rounded-lg overflow-hidden" style={{ height: 400 }}>
              {/* Simple SVG trail */}
              <svg
                viewBox={`0 0 1000 600`}
                className="w-full h-full"
                preserveAspectRatio="xMidYMid meet"
              >
                {(() => {
                  if (pings.length < 2) return null
                  const lats = pings.map(p => p.latitude)
                  const lngs = pings.map(p => p.longitude)
                  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
                  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
                  const padLat = (maxLat - minLat) * 0.1 || 0.001
                  const padLng = (maxLng - minLng) * 0.1 || 0.001

                  const scaleX = (lng: number) => ((lng - minLng + padLng) / (maxLng - minLng + 2 * padLng)) * 960 + 20
                  const scaleY = (lat: number) => 580 - ((lat - minLat + padLat) / (maxLat - minLat + 2 * padLat)) * 560

                  const pathPoints = pings.map(p => `${scaleX(p.longitude)},${scaleY(p.latitude)}`).join(" ")
                  const playedPoints = pings.slice(0, playbackIdx + 1).map(p => `${scaleX(p.longitude)},${scaleY(p.latitude)}`).join(" ")

                  const cx = currentPing ? scaleX(currentPing.longitude) : 0
                  const cy = currentPing ? scaleY(currentPing.latitude) : 0

                  return (
                    <>
                      {/* Full trail (dim) */}
                      <polyline
                        points={pathPoints}
                        fill="none"
                        stroke="rgba(148,163,184,0.3)"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      {/* Played trail (colored) */}
                      <polyline
                        points={playedPoints}
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      {/* Start marker */}
                      <circle
                        cx={scaleX(pings[0].longitude)}
                        cy={scaleY(pings[0].latitude)}
                        r="6"
                        fill="#22c55e"
                        stroke="white"
                        strokeWidth="2"
                      />
                      {/* End marker */}
                      <circle
                        cx={scaleX(pings[pings.length - 1].longitude)}
                        cy={scaleY(pings[pings.length - 1].latitude)}
                        r="6"
                        fill="#ef4444"
                        stroke="white"
                        strokeWidth="2"
                      />
                      {/* Current position */}
                      {currentPing && (
                        <>
                          <circle cx={cx} cy={cy} r="12" fill="rgba(99,102,241,0.2)" />
                          <circle cx={cx} cy={cy} r="6" fill="#6366f1" stroke="white" strokeWidth="2" />
                        </>
                      )}
                    </>
                  )
                })()}
              </svg>

              {/* Current position info overlay */}
              {currentPing && (
                <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs">
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

            {/* Playback controls */}
            <div className="mt-4 space-y-3">
              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-mono w-16">
                  {pings[playbackIdx] ? new Date(pings[playbackIdx].timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                </span>
                <input
                  type="range"
                  min={0}
                  max={pings.length - 1}
                  value={playbackIdx}
                  onChange={(e) => { setPlaybackIdx(Number(e.target.value)); stopPlayback() }}
                  className="flex-1 accent-brand-500"
                />
                <span className="text-xs text-slate-400 font-mono w-16 text-right">
                  {pings.length > 0 ? new Date(pings[pings.length - 1].timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                </span>
              </div>

              {/* Transport controls */}
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
                  onClick={() => { setPlaybackIdx(pings.length - 1); stopPlayback() }}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-400 ml-2">
                  Point {playbackIdx + 1} / {pings.length}
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

            {/* Speed chart (simple bar representation) */}
            <div className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Speed Profile</h3>
              <div className="flex items-end gap-px h-32">
                {pings.length > 0 && (() => {
                  const maxSpeed = Math.max(...pings.map(p => p.speed), 1)
                  const step = Math.max(1, Math.floor(pings.length / 80))
                  const sampled = pings.filter((_, i) => i % step === 0)
                  return sampled.map((p, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-t transition-all ${
                        i <= Math.floor(playbackIdx / step)
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
      ) : selectedVehicle && pings.length === 0 ? (
        <div className="text-center py-20">
          <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">No GPS data for this vehicle on {selectedDate}</p>
        </div>
      ) : (
        <div className="text-center py-20">
          <MapPin className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Select a vehicle and date to view history</p>
        </div>
      )}
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
