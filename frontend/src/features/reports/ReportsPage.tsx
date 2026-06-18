import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { motion } from "framer-motion"
import api from "@/lib/api"
import { useToast } from "@/components/shared/Toast"
import {
  FileText, Download, Calendar, BarChart3,
  Bus, AlertTriangle, Users, Filter, FileDown,
  Briefcase, Building2, Gauge,
} from "lucide-react"

const REPORT_TYPES = [
  { value: "DAILY_FLEET", label: "Daily Fleet", icon: Bus, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
  { value: "INCIDENT", label: "Incident Report", icon: AlertTriangle, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
  { value: "DRIVER", label: "Driver Report", icon: Users, color: "text-violet-600 bg-violet-50 dark:bg-violet-900/20" },
  { value: "EXECUTIVE", label: "Executive Summary", icon: Briefcase, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" },
  { value: "DEPOT", label: "Depot Report", icon: Building2, color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20" },
  { value: "UTILIZATION", label: "Utilization", icon: Gauge, color: "text-rose-600 bg-rose-50 dark:bg-rose-900/20" },
]

const FORMAT_OPTIONS = [
  { value: "CSV", label: "CSV", icon: "📄" },
  { value: "PDF", label: "PDF", icon: "📕" },
]

export function ReportsPage() {
  const { toast } = useToast()
  const [selectedType, setSelectedType] = useState("DAILY_FLEET")
  const [selectedFormat, setSelectedFormat] = useState("PDF")
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0])

  const { data: reports, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => { const res = await api.get("/reports"); return res.data },
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/reports/generate", {
        report_type: selectedType,
        report_format: selectedFormat,
        start_date: startDate,
        end_date: endDate,
      }, { responseType: "blob" })
      // Download file
      const ext = selectedFormat === "PDF" ? "pdf" : "csv"
      const mime = selectedFormat === "PDF" ? "application/pdf" : "text/csv"
      const url = window.URL.createObjectURL(new Blob([res.data], { type: mime }))
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `${selectedType}_Report_${endDate}.${ext}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
    onSuccess: () => toast({ variant: "success", title: "Report Generated", description: "Download started." }),
    onError: () => toast({ variant: "error", title: "Failed", description: "Could not generate report." }),
  })

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Generate and download operational reports in CSV or PDF format</p>
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {REPORT_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => setSelectedType(type.value)}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${selectedType === type.value ? "border-brand-500 bg-brand-50 dark:bg-brand-900/10 shadow-md" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-900 hover:border-brand-200"}`}
          >
            <div className={`p-2.5 rounded-lg ${type.color}`}><type.icon className="w-5 h-5" /></div>
            <span className={`text-xs font-medium text-center ${selectedType === type.value ? "text-brand-700 dark:text-brand-400" : "text-slate-700 dark:text-slate-300"}`}>{type.label}</span>
          </button>
        ))}
      </div>

      {/* Date Range & Format & Generate */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" /> Report Configuration
        </h3>
        <div className="flex flex-col md:flex-row items-end gap-4">
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-500 block mb-1.5">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-white" />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-500 block mb-1.5">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-white" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">Format</label>
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              {FORMAT_OPTIONS.map((fmt) => (
                <button key={fmt.value} onClick={() => setSelectedFormat(fmt.value)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${selectedFormat === fmt.value ? "bg-brand-600 text-white" : "bg-white dark:bg-surface-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                  {fmt.icon} {fmt.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="px-6 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {generateMutation.isPending ? "Generating..." : "Generate & Download"}
          </button>
        </div>
      </motion.div>

      {/* Past Reports */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white dark:bg-surface-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500" /> Generated Reports
        </h3>
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 skeleton rounded-lg" />)}</div>
        ) : (reports?.items || []).length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No reports generated yet. Select a type and click Generate.</p>
        ) : (
          <div className="space-y-2">
            {(reports?.items || []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${r.report_format === "PDF" ? "bg-red-50 dark:bg-red-900/20" : "bg-brand-50 dark:bg-brand-900/20"}`}>
                    {r.report_format === "PDF" ? <FileDown className="w-4 h-4 text-red-600" /> : <FileText className="w-4 h-4 text-brand-600" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{r.title}</p>
                    <p className="text-[10px] text-slate-400">{r.report_type} • {r.report_format} • {new Date(r.generated_at).toLocaleString()}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${r.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-amber-100 text-amber-700"}`}>{r.status}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
