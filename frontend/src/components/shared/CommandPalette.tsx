import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import api from "@/lib/api"
import {
  Search, X, Bus, Users, Route, AlertTriangle,
  Megaphone, Calendar, MapPin, FileText, ArrowRight,
} from "lucide-react"

const TYPE_ICONS: Record<string, any> = {
  vehicle: Bus, user: Users, route: Route,
  incident: AlertTriangle, notice: Megaphone, duty: Calendar,
}

const TYPE_COLORS: Record<string, string> = {
  vehicle: "text-blue-500 bg-blue-50 dark:bg-blue-900/20",
  user: "text-violet-500 bg-violet-50 dark:bg-violet-900/20",
  route: "text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20",
  incident: "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
  notice: "text-pink-500 bg-pink-50 dark:bg-pink-900/20",
  duty: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery("")
    }
  }, [open])

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ["search", query],
    queryFn: async () => {
      if (query.length < 2) return { results: [] }
      const res = await api.get("/search", { params: { q: query, limit: 12 } })
      return res.data
    },
    enabled: query.length >= 2,
    staleTime: 5000,
  })

  const results = searchResults?.results || []

  const handleSelect = useCallback((link: string) => {
    // Convert API links like /vehicles/{id} to page links
    const pageLink = link.split("/").slice(0, 2).join("/")
    navigate(pageLink)
    setOpen(false)
  }, [navigate])

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ type: "spring", damping: 25, stiffness: 400 }}
          className="w-full max-w-lg bg-white dark:bg-surface-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vehicles, users, routes, incidents..."
              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            )}
            <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 rounded text-slate-400 border border-slate-200 dark:border-slate-700">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[360px] overflow-y-auto">
            {query.length < 2 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-slate-400">Type at least 2 characters to search</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {["vehicles", "incidents", "routes", "notices"].map((hint) => (
                    <button key={hint} onClick={() => setQuery(hint)}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 transition-colors">
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            ) : isFetching ? (
              <div className="p-6 text-center">
                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400 mt-2">Searching...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-slate-400">No results for "{query}"</p>
              </div>
            ) : (
              <div className="py-2">
                {results.map((result: any, idx: number) => {
                  const Icon = TYPE_ICONS[result.type] || FileText
                  const color = TYPE_COLORS[result.type] || "text-slate-500 bg-slate-50 dark:bg-slate-800"
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelect(result.link)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                    >
                      <div className={`p-2 rounded-lg flex-shrink-0 ${color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{result.title}</p>
                        <p className="text-[11px] text-slate-400 truncate">{result.subtitle}</p>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400 uppercase flex-shrink-0">{result.type}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <span>↑↓ Navigate • ↵ Select • ESC Close</span>
            <span>{results.length} results</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
