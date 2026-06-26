import { useState, useRef, useEffect } from "react"
import { useMutation } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import api from "@/lib/api"
import type { CopilotMessage } from "@/types"
import { Bot, Send, Sparkles, User, Loader2, Zap } from "lucide-react"

export function CopilotPage() {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      role: "assistant",
      content: "👋 Hello! I'm your fleet operations AI assistant. How can I help you today?\n\nTry asking me about:\n• Your duty schedule\n• Open incidents\n• Fleet status\n• Driver performance",
      suggestions: [
        "What is my duty today?",
        "Show all open incidents",
        "Fleet status summary",
        "Help",
      ],
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await api.post("/copilot/chat", { message })
      return res.data
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          suggestions: data.suggestions,
          data: data.data,
          timestamp: new Date(),
        },
      ])
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error processing your request. Please try again.",
          suggestions: ["Help", "Fleet status", "Open incidents"],
          timestamp: new Date(),
        },
      ])
    },
  })

  const handleSend = (text?: string) => {
    const message = text || input.trim()
    if (!message) return

    setMessages((prev) => [
      ...prev,
      { role: "user", content: message, timestamp: new Date() },
    ])
    setInput("")
    chatMutation.mutate(message)
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-white">Fleet AI Copilot</h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
              Online
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              )}

              <div className={`max-w-[70%] ${msg.role === "user"
                  ? "bg-brand-600 text-white rounded-2xl rounded-tr-sm px-4 py-3"
                  : "bg-white dark:bg-surface-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3"
                }`}>
                <div className={`text-sm whitespace-pre-wrap ${msg.role === "user" ? "" : "text-slate-800 dark:text-slate-200"
                  }`}>
                  {msg.content.split("\n").map((line, i) => {
                    // Bold markdown
                    const parts = line.split(/\*\*(.*?)\*\*/g)
                    return (
                      <p key={i} className={i > 0 ? "mt-1" : ""}>
                        {parts.map((part, j) =>
                          j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                        )}
                      </p>
                    )
                  })}
                </div>

                {/* Suggestion chips */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    {msg.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => handleSend(suggestion)}
                        className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800/30 hover:bg-brand-100 dark:hover:bg-brand-800/30 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                <p className={`text-[9px] mt-2 ${msg.role === "user" ? "text-white/50" : "text-slate-400"
                  }`}>
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {chatMutation.isPending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white dark:bg-surface-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-brand-500 animate-spin" />
              <span className="text-sm text-slate-500">Thinking...</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Ask about duties, incidents, fleet status..."
              className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
              disabled={chatMutation.isPending}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || chatMutation.isPending}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-brand-600 text-white disabled:opacity-30 hover:bg-brand-500 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-center text-[10px] text-slate-400 mt-2">
          Fleet AI Copilot
        </p>
      </div>
    </div>
  )
}
