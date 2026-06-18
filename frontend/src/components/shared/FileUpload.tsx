import { useState, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { useToast } from "@/components/shared/Toast"
import { Upload, X, FileText, Image, Download, Trash2, Loader2, Eye } from "lucide-react"

interface FileUploadProps {
  category: "incidents" | "notices" | "profiles" | "reports"
  resourceId?: string
  maxFiles?: number
  compact?: boolean
  onUploadComplete?: (file: any) => void
}

export function FileUpload({ category, resourceId, maxFiles = 5, compact, onUploadComplete }: FileUploadProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const { data: files } = useQuery({
    queryKey: ["uploads", category, resourceId],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set("category", category)
      if (resourceId) params.set("resource_id", resourceId)
      const res = await api.get(`/uploads?${params}`)
      return res.data
    },
    enabled: !!resourceId,
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("category", category)
      if (resourceId) formData.append("resource_id", resourceId)
      const res = await api.post("/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      return res.data
    },
    onSuccess: (data) => {
      toast({ variant: "success", title: "File Uploaded", description: data.filename })
      queryClient.invalidateQueries({ queryKey: ["uploads", category, resourceId] })
      onUploadComplete?.(data)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || "Upload failed"
      toast({ variant: "error", title: "Upload Failed", description: msg })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      await api.delete(`/uploads/${fileId}`)
    },
    onSuccess: () => {
      toast({ variant: "success", title: "File Deleted" })
      queryClient.invalidateQueries({ queryKey: ["uploads", category, resourceId] })
    },
  })

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return
    const allowed = [".jpg", ".jpeg", ".png", ".pdf"]
    const maxSize = 10 * 1024 * 1024 // 10MB

    Array.from(fileList).slice(0, maxFiles).forEach((f) => {
      const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase()
      if (!allowed.includes(ext)) {
        toast({ variant: "error", title: "Invalid File", description: `${ext} not allowed. Use: jpg, png, pdf` })
        return
      }
      if (f.size > maxSize) {
        toast({ variant: "error", title: "File Too Large", description: "Maximum 10 MB" })
        return
      }
      uploadMutation.mutate(f)
    })
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
    else if (e.type === "dragleave") setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(false)
    handleFiles(e.dataTransfer.files)
  }

  const fileItems = files?.items || []
  const isImage = (mime: string) => mime?.startsWith("image/")

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer border-2 border-dashed rounded-xl p-4 text-center transition-all ${
          dragActive ? "border-brand-500 bg-brand-50 dark:bg-brand-900/10" : "border-slate-200 dark:border-slate-700 hover:border-brand-300"
        } ${compact ? "py-3" : "py-6"}`}
      >
        <input ref={inputRef} type="file" className="hidden" multiple accept=".jpg,.jpeg,.png,.pdf"
          onChange={(e) => handleFiles(e.target.files)} />
        {uploadMutation.isPending ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
            <span className="text-sm text-brand-600">Uploading...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Upload className={`text-slate-400 ${compact ? "w-4 h-4" : "w-6 h-6"}`} />
            <p className="text-xs text-slate-500">{compact ? "Click or drop files" : "Drag & drop files here or click to browse"}</p>
            <p className="text-[10px] text-slate-400">JPG, PNG, PDF — Max 10 MB</p>
          </div>
        )}
      </div>

      {/* File List */}
      {fileItems.length > 0 && (
        <div className="space-y-1.5">
          {fileItems.map((f: any) => (
            <div key={f.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 group">
              <div className="flex items-center gap-2.5 min-w-0">
                {isImage(f.mime_type) ? (
                  <div className="w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center flex-shrink-0">
                    <Image className="w-4 h-4 text-violet-500" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-red-500" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700 dark:text-white truncate">{f.filename}</p>
                  <p className="text-[10px] text-slate-400">{formatSize(f.size_bytes || 0)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {isImage(f.mime_type) && (
                  <button onClick={(e) => { e.stopPropagation(); setPreviewUrl(f.url) }}
                    className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700">
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                )}
                <a href={`${api.defaults.baseURL}${f.url}`} target="_blank" rel="noopener"
                  className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700" onClick={(e) => e.stopPropagation()}>
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                </a>
                <button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(f.id) }}
                  className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/20">
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-3xl max-h-[80vh]">
            <button onClick={() => setPreviewUrl(null)} className="absolute -top-3 -right-3 p-1.5 bg-white dark:bg-slate-800 rounded-full shadow-lg">
              <X className="w-4 h-4" />
            </button>
            <img src={`${api.defaults.baseURL}${previewUrl}`} alt="Preview" className="max-w-full max-h-[80vh] rounded-xl object-contain" />
          </div>
        </div>
      )}
    </div>
  )
}
