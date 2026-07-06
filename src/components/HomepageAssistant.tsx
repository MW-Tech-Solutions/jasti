import * as React from "react"
import { Link } from "react-router-dom"
import { MessageSquare, Minus, RotateCcw, Send, Sparkles } from "lucide-react"

import { type JournalSettings } from "@/lib/journalApi"
import { cn } from "@/lib/utils"

const QUICK_PROMPTS = ["Call for papers", "Submit manuscript", "Track research"]
const LOCAL_REPLY_DELAY_MS = 220
const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "any",
  "are",
  "can",
  "for",
  "from",
  "have",
  "how",
  "into",
  "its",
  "not",
  "our",
  "page",
  "pages",
  "please",
  "tell",
  "that",
  "the",
  "their",
  "them",
  "there",
  "this",
  "what",
  "when",
  "where",
  "which",
  "with",
  "your",
])

function buildWhatsAppUrl(rawNumber: string) {
  const digits = rawNumber.replace(/\D/g, "")
  if (!digits) return ""

  const normalized = digits.startsWith("0") ? `234${digits.slice(1)}` : digits
  return `https://wa.me/${normalized}`
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M16 3.7A12.1 12.1 0 0 0 5.8 22.3L4 28.3l6.2-1.7A12.1 12.1 0 1 0 16 3.7Zm0 22a9.7 9.7 0 0 1-4.9-1.3l-.4-.2-3.7 1 1-3.5-.3-.4A9.8 9.8 0 1 1 16 25.7Zm5.4-7.3c-.3-.2-1.8-.9-2.1-1s-.5-.2-.7.2-.8 1-.9 1.2-.3.2-.6.1a8 8 0 0 1-2.4-1.5 8.9 8.9 0 0 1-1.6-2c-.2-.3 0-.5.1-.6l.5-.6c.2-.2.2-.4.3-.6s0-.4 0-.6-.7-1.7-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.2 1.2-1.2 2.9 1.3 3.4 1.5 3.6a13.1 13.1 0 0 0 5 4.4c.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4s-.2-.2-.5-.4Z"
      />
    </svg>
  )
}

type AssistantAction = {
  label: string
  to?: string
  href?: string
  variant?: "primary" | "secondary"
}

type AssistantReply = {
  title: string
  text: string
  actions: AssistantAction[]
}

type AssistantMessage = AssistantReply & {
  id: string
  role: "assistant" | "user"
}

type Topic = {
  id: string
  keywords: string[]
  title: string
  text: string
  actions: AssistantAction[]
}

let messageSequence = 0

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    if (typeof window === "undefined") {
      resolve()
      return
    }

    window.setTimeout(resolve, ms)
  })
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function matchesPhrase(text: string, phrase: string) {
  return new RegExp(`(^|\\b)${escapeRegExp(phrase)}(\\b|$)`).test(text)
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => matchesPhrase(text, keyword))
}

function tokenizeSearch(value: string) {
  const tokens = value.toLowerCase().match(/[a-z0-9]+/g) ?? []
  return tokens.filter((token) => token.length > 2 && !STOP_WORDS.has(token))
}

function scoreMatch(input: string, fields: string[]) {
  const tokens = tokenizeSearch(input)
  if (tokens.length === 0) return 0

  const haystack = fields.join(" ").toLowerCase()
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0)
}

function dedupeActions(actions: AssistantAction[]) {
  const seen = new Set<string>()

  return actions.filter((action) => {
    const key = `${action.label}-${action.to ?? action.href ?? ""}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function createMessage(role: AssistantMessage["role"], payload: AssistantReply): AssistantMessage {
  messageSequence += 1

  return {
    id: `${role}-${messageSequence}`,
    role,
    title: payload.title,
    text: payload.text,
    actions: payload.actions,
  }
}

function formatDeadline(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? new Date(`${trimmed}T00:00:00`) : new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return trimmed

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed)
}

function getScopePreview(settings: JournalSettings) {
  const scope = settings.scope.filter((item) => item.trim()).slice(0, 3)
  return scope.length ? scope.join(", ") : "applied science, technology, innovation, education, and management"
}

function getInitialMessages(settings: JournalSettings) {
  const journalLabel = settings.journal_acronym?.trim() || "JASTI"

  return [
    createMessage("assistant", {
      title: `Welcome to ${journalLabel}`,
      text: "Ask about submission, calls for papers, scope, workflow, tracking, or published research.",
      actions: [
        { label: "Call for papers", to: "/call-for-papers", variant: "primary" },
        { label: "Aims and scope", to: "/scope", variant: "secondary" },
      ],
    }),
    createMessage("assistant", {
      title: "Quick route finder",
      text: "I use JASTI's published pages, journal settings, and shortcuts to point you to the right next step.",
      actions: [
        { label: "Author login", to: "/login/author", variant: "primary" },
        { label: "Workflow", to: "/workflow", variant: "secondary" },
      ],
    }),
  ]
}

function buildCallForPapersReply(input: string, settings: JournalSettings): AssistantReply | null {
  const entries = settings.call_for_papers.filter((entry) =>
    [entry.title, entry.deadline, entry.summary].some((value) => value.trim() !== "")
  )

  if (entries.length === 0) return null

  const asksForCalls = includesAny(input, [
    "call for papers",
    "calls",
    "deadline",
    "deadlines",
    "open call",
    "current call",
    "current calls",
    "submission window",
  ])

  const rankedEntries = entries
    .map((entry) => ({
      entry,
      score: scoreMatch(input, [entry.title, entry.deadline, entry.summary]),
    }))
    .filter((item) => asksForCalls || item.score > 0)
    .sort((left, right) => right.score - left.score)

  if (rankedEntries.length === 0) return null

  const selectedEntries = rankedEntries.slice(0, 2).map((item) => item.entry)
  const text = selectedEntries
    .map((entry) => {
      const parts = [entry.title.trim() || "Current call"]
      const deadline = formatDeadline(entry.deadline)
      if (deadline) {
        parts.push(`closes ${deadline}`)
      }

      const summary = entry.summary.trim()
      return `${parts.join(" ")}.${summary ? ` ${summary}` : ""}`
    })
    .join(" ")

  return {
    title: selectedEntries.length === 1 ? "Call for papers" : "Current calls and deadlines",
    text,
    actions: [
      { label: "Call for papers", to: "/call-for-papers", variant: "primary" },
      { label: "Submit manuscript", to: "/login/author", variant: "secondary" },
    ],
  }
}

function buildSubmissionReply(input: string, settings: JournalSettings): AssistantReply | null {
  if (!includesAny(input, ["submit", "submission", "manuscript", "send paper", "article submission", "publish with us"])) {
    return null
  }

  const note = settings.call_for_papers_notes.find((item) => item.trim() !== "")
  const text = [
    settings.publish_with_us_body.trim() || "Use the author side of the platform to prepare and submit your manuscript.",
    note ? `Author note: ${note}` : "",
  ]
    .filter(Boolean)
    .join(" ")

  return {
    title: "Submission route",
    text,
    actions: [
      {
        label: "Author login",
        to: "/login/author?redirect=%2Fdashboard%3Frole%3Dauthor%26section%3Dsubmission",
        variant: "primary",
      },
      { label: "Publish with us", to: "/publish-with-us", variant: "secondary" },
    ],
  }
}

function buildTrackingReply(input: string, settings: JournalSettings): AssistantReply | null {
  if (!includesAny(input, ["track", "tracking", "status", "follow up", "dashboard", "revision", "revisions"])) {
    return null
  }

  return {
    title: "Tracking your research",
    text:
      settings.track_research_body.trim() ||
      "The author dashboard is the quickest place to check manuscript progress, revisions, and journal communication.",
    actions: [
      { label: "Track research", to: "/login/author", variant: "primary" },
      { label: "Dashboard", to: "/dashboard", variant: "secondary" },
    ],
  }
}

function buildOpenAccessReply(input: string, settings: JournalSettings): AssistantReply | null {
  if (!includesAny(input, ["open access", "access", "visibility", "discover", "public access", "indexing"])) {
    return null
  }

  const point = settings.discover_open_access_points.find((item) => item.trim() !== "")
  const text = [
    settings.discover_open_access_body.trim() ||
      "JASTI highlights open scholarship, research visibility, and practical discovery pathways for readers and authors.",
    point ?? "",
  ]
    .filter(Boolean)
    .join(" ")

  return {
    title: settings.discover_open_access_title.trim() || "Discover open access",
    text,
    actions: [
      { label: "Discover open access", to: "/discover-open-access", variant: "primary" },
      { label: "Trending research", to: "/trending-research", variant: "secondary" },
    ],
  }
}

function buildScopeReply(input: string, settings: JournalSettings): AssistantReply | null {
  const asksForScope = includesAny(input, [
    "aim",
    "aims",
    "scope",
    "objective",
    "objectives",
    "topic",
    "topics",
    "discipline",
    "field",
    "research area",
    "fit",
  ])

  const scopeItems = settings.scope.filter((item) => item.trim()).slice(0, 3)
  const aimItems = settings.aims.filter((item) => item.trim()).slice(0, 2)
  const matchedScope = scoreMatch(input, [...scopeItems, ...aimItems]) > 0

  if (!asksForScope && !matchedScope) return null

  const textParts = []
  if (scopeItems.length > 0) {
    textParts.push(`JASTI currently highlights ${scopeItems.join(", ")}.`)
  }
  if (aimItems.length > 0) {
    textParts.push(`Core aims include ${aimItems.join("; ")}.`)
  }

  return {
    title: "Aims and scope",
    text:
      textParts.join(" ") ||
      `The journal highlights areas such as ${getScopePreview(settings)}. The Aims and Scope page is the best place to confirm manuscript fit.`,
    actions: [
      { label: "Aims and scope", to: "/scope", variant: "primary" },
      { label: "Publish with us", to: "/publish-with-us", variant: "secondary" },
    ],
  }
}

function buildWorkflowReply(input: string, settings: JournalSettings): AssistantReply | null {
  if (!includesAny(input, ["workflow", "peer review", "editorial process", "revision", "decision", "review process"])) {
    return null
  }

  return {
    title: settings.workflow_snapshot_title.trim() || "Editorial workflow",
    text:
      settings.workflow_snapshot_description.trim() ||
      "JASTI is organized around submission, review, revision, editorial decision, and publication visibility.",
    actions: [
      { label: "Workflow", to: "/workflow", variant: "primary" },
      { label: "Editorial roles", to: "/governance", variant: "secondary" },
    ],
  }
}

function buildRoleReply(input: string): AssistantReply | null {
  if (!includesAny(input, ["reviewer", "editor", "admin", "administrator", "role", "roles", "editorial board"])) {
    return null
  }

  return {
    title: "Role-specific access",
    text: "JASTI separates author, reviewer, editor, and administrator entry points so each person lands in the right workspace.",
    actions: [
      { label: "Reviewer login", to: "/login/reviewer", variant: "secondary" },
      { label: "Editor login", to: "/login/editor", variant: "primary" },
      { label: "Admin login", to: "/login/admin", variant: "secondary" },
    ],
  }
}

function buildTrendingReply(input: string, settings: JournalSettings): AssistantReply | null {
  const entries = settings.trending_research.filter((entry) =>
    [entry.title, entry.area, entry.summary].some((value) => value.trim() !== "")
  )

  if (entries.length === 0) return null

  const asksForTrends = includesAny(input, [
    "trending",
    "trend",
    "emerging",
    "current topic",
    "current topics",
    "current research",
    "research trend",
    "research trends",
  ])

  const rankedEntries = entries
    .map((entry) => ({
      entry,
      score: scoreMatch(input, [entry.title, entry.area, entry.summary]),
    }))
    .filter((item) => asksForTrends || item.score > 1)
    .sort((left, right) => right.score - left.score)

  if (rankedEntries.length === 0) return null

  const selectedEntries = rankedEntries.slice(0, 2).map((item) => item.entry)
  const text = selectedEntries
    .map((entry) => {
      const area = entry.area.trim()
      const summary = entry.summary.trim()
      return `${entry.title.trim()}${area ? ` in ${area}` : ""}.${summary ? ` ${summary}` : ""}`
    })
    .join(" ")

  return {
    title: settings.trending_research_title.trim() || "Trending research",
    text,
    actions: [
      { label: "Trending research", to: "/trending-research", variant: "primary" },
      { label: "Discover open access", to: "/discover-open-access", variant: "secondary" },
    ],
  }
}

function buildArticlesReply(input: string): AssistantReply | null {
  if (!includesAny(input, ["article", "articles", "published", "publication", "doi", "download", "read paper"])) {
    return null
  }

  return {
    title: "Published content",
    text: "Published work appears through the homepage research sections, article detail pages, and the trending research area so readers can discover current outputs more easily.",
    actions: [
      { label: "Trending research", to: "/trending-research", variant: "primary" },
      { label: "Homepage overview", href: "#homepage-overview", variant: "secondary" },
    ],
  }
}

function buildFeesReply(input: string): AssistantReply | null {
  if (!includesAny(input, ["fee", "fees", "cost", "costs", "charge", "charges", "payment", "payments"])) {
    return null
  }

  return {
    title: "Fees and payment details",
    text: "I cannot confirm current fees from the homepage content alone. The safest next step is to check the latest call notice, submission guidance, or your author dashboard instructions.",
    actions: [
      { label: "Call for papers", to: "/call-for-papers", variant: "primary" },
      { label: "Author login", to: "/login/author", variant: "secondary" },
    ],
  }
}

function getTopicCatalog(settings: JournalSettings): Topic[] {
  return [
    {
      id: "about",
      keywords: ["about", "what is jasti", "journal", "who are you", "overview", "introduction"],
      title: "About the journal",
      text: `${settings.journal_name || "JASTI"} is presented as a research journal with public discovery pages, author access, editorial workflow, and publication visibility in one platform.`,
      actions: [
        { label: "About JASTI", to: "/about", variant: "primary" },
        { label: "Homepage overview", href: "#homepage-overview", variant: "secondary" },
      ],
    },
    {
      id: "start",
      keywords: ["get started", "start here", "where do i start", "begin", "new here", "guide me"],
      title: "Best place to start",
      text: "Use the homepage for discovery, open the Call for Papers page to see current submission opportunities, then create or use an author account when you are ready to submit or track a manuscript.",
      actions: [
        { label: "Call for papers", to: "/call-for-papers", variant: "primary" },
        { label: "Register author", to: "/register/author", variant: "secondary" },
      ],
    },
  ]
}

function buildAssistantReply(input: string, settings: JournalSettings): AssistantReply {
  const normalizedInput = input.trim().toLowerCase()

  if (!normalizedInput) {
    return {
      title: "Ask me about JASTI",
      text: "Try calls for papers, submission, tracking, workflow, open access, or aims and scope.",
      actions: [{ label: "Start here", href: "#homepage-overview", variant: "secondary" }],
    }
  }

  if (includesAny(normalizedInput, ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"])) {
    return {
      title: "Quick tour",
      text: "Tell me what you need and I can point you to submission, calls for papers, scope, workflow, or the right login page.",
      actions: [
        { label: "Call for papers", to: "/call-for-papers", variant: "primary" },
        { label: "Track research", to: "/login/author", variant: "secondary" },
      ],
    }
  }

  if (includesAny(normalizedInput, ["thank you", "thanks", "appreciate it"])) {
    return {
      title: "Any time",
      text: "You can ask another JASTI question or use one of the shortcuts below.",
      actions: [
        { label: "Author login", to: "/login/author", variant: "primary" },
        { label: "Workflow", to: "/workflow", variant: "secondary" },
      ],
    }
  }

  const directReply =
    buildCallForPapersReply(normalizedInput, settings) ??
    buildFeesReply(normalizedInput) ??
    buildSubmissionReply(normalizedInput, settings) ??
    buildTrackingReply(normalizedInput, settings) ??
    buildOpenAccessReply(normalizedInput, settings) ??
    buildScopeReply(normalizedInput, settings) ??
    buildWorkflowReply(normalizedInput, settings) ??
    buildRoleReply(normalizedInput) ??
    buildTrendingReply(normalizedInput, settings) ??
    buildArticlesReply(normalizedInput)

  if (directReply) {
    return directReply
  }

  const matchedTopics = getTopicCatalog(settings).filter((topic) => includesAny(normalizedInput, topic.keywords))
  if (matchedTopics.length > 0) {
    const selectedTopics = matchedTopics.slice(0, 2)
    return {
      title: selectedTopics.length === 1 ? selectedTopics[0].title : "Here is the quickest path",
      text: selectedTopics.map((topic) => topic.text).join(" "),
      actions: dedupeActions(selectedTopics.flatMap((topic) => topic.actions)).slice(0, 3),
    }
  }

  return {
    title: "I can still point you in the right direction",
    text: "Try asking about submission, calls for papers, open access, editorial workflow, scope, published articles, or how to track your research.",
    actions: [
      { label: "Call for papers", to: "/call-for-papers", variant: "primary" },
      { label: "Aims and scope", to: "/scope", variant: "secondary" },
      { label: "Track research", to: "/login/author", variant: "secondary" },
    ],
  }
}

function buildConversationContext(messages: AssistantMessage[]) {
  return messages
    .filter((message) => message.role === "user")
    .slice(-2)
    .map((message) => message.text)
    .join(" ")
}

function AssistantActionButton({ action }: { action: AssistantAction }) {
  const className = cn(
    "inline-flex min-h-9 items-center justify-center rounded-full px-3.5 py-2 text-[11px] font-semibold shadow-sm transition hover:-translate-y-px",
    action.variant === "primary"
      ? "bg-[linear-gradient(135deg,#0b6fa4_0%,#1f6b5c_100%)] text-white shadow-[0_10px_22px_rgba(11,111,164,0.18)]"
      : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
  )

  if (action.to) {
    return (
      <Link to={action.to} className={className}>
        {action.label}
      </Link>
    )
  }

  return (
    <a href={action.href || "#"} className={className}>
      {action.label}
    </a>
  )
}

export default function HomepageAssistant({ settings }: { settings: JournalSettings }) {
  const threadRef = React.useRef<HTMLDivElement | null>(null)
  const requestSequenceRef = React.useRef(0)
  const [draft, setDraft] = React.useState("")
  const [isOpen, setIsOpen] = React.useState(false)
  const [isTyping, setIsTyping] = React.useState(false)
  const [messages, setMessages] = React.useState<AssistantMessage[]>(() => getInitialMessages(settings))
  const whatsappUrl = React.useMemo(() => buildWhatsAppUrl(settings.whatsapp_number), [settings.whatsapp_number])

  React.useEffect(() => {
    const thread = threadRef.current
    if (thread && isOpen) {
      thread.scrollTop = thread.scrollHeight
    }
  }, [isOpen, isTyping, messages])

  React.useEffect(() => {
    setMessages(getInitialMessages(settings))
    setDraft("")
    setIsTyping(false)
    requestSequenceRef.current += 1
  }, [settings])

  React.useEffect(() => {
    return () => {
      requestSequenceRef.current += 1
    }
  }, [])

  const resetConversation = React.useCallback(() => {
    requestSequenceRef.current += 1
    setDraft("")
    setIsTyping(false)
    setMessages(getInitialMessages(settings))
  }, [settings])

  const submitQuestion = React.useCallback(
    async (question: string) => {
      const trimmedQuestion = question.trim()
      if (!trimmedQuestion || isTyping) return

      const userMessage = createMessage("user", { title: "", text: trimmedQuestion, actions: [] })
      const nextMessages = [...messages, userMessage]
      const requestSequence = requestSequenceRef.current + 1
      requestSequenceRef.current = requestSequence

      setDraft("")
      setMessages(nextMessages)
      setIsTyping(true)

      await delay(LOCAL_REPLY_DELAY_MS)
      if (requestSequenceRef.current !== requestSequence) return

      const reply = buildAssistantReply(buildConversationContext(nextMessages), settings)

      setMessages((currentMessages) => [...currentMessages, createMessage("assistant", reply)])

      if (requestSequenceRef.current === requestSequence) {
        setIsTyping(false)
      }
    },
    [isTyping, messages, settings]
  )

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitQuestion(draft)
  }

  return (
    <section className="pointer-events-none fixed bottom-2 right-2 z-[120] sm:bottom-4 sm:right-4">
      {isOpen ? (
        <div className="pointer-events-auto flex h-[min(31rem,calc(100vh-4.75rem))] w-[min(20.5rem,calc(100vw-0.75rem))] flex-col overflow-hidden rounded-[1.65rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,249,251,0.97)_100%)] shadow-[0_26px_70px_rgba(15,23,42,0.22)] backdrop-blur-xl sm:w-[20.5rem]">
          <header className="relative overflow-hidden border-b border-slate-200/80 bg-[linear-gradient(135deg,#14384e_0%,#184d44_100%)] px-4 py-3.5 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(48,169,215,0.24),transparent_36%)]" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85">
                  <Sparkles className="h-3 w-3" />
                  JASTI guide
                </div>
                <h2 className="mt-2.5 font-display text-[1.35rem] leading-none tracking-[-0.03em] text-white">
                  Ask JASTI
                </h2>
                <p className="mt-1.5 max-w-[14rem] text-[13px] leading-5 text-white/78">
                  Find pages, deadlines, and the right login faster.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetConversation}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/15"
                  aria-label="Reset conversation"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/15"
                  aria-label="Minimize assistant"
                >
                  <Minus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>

          <div className="flex flex-1 flex-col overflow-hidden px-3 pb-3 pt-3">
            <div className="rounded-[1.1rem] border border-slate-200/80 bg-white/88 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Quick prompts
              </p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      void submitQuestion(prompt)
                    }}
                    disabled={isTyping}
                    className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-[#0b6fa4]/30 hover:bg-[#edf5f9] hover:text-[#0b6fa4] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div
              ref={threadRef}
              className="mt-3 flex-1 space-y-2.5 overflow-y-auto pr-1"
              role="log"
              aria-live="polite"
              aria-label="Homepage assistant conversation"
            >
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={cn(
                    "max-w-[90%] rounded-[1.25rem] px-3.5 py-3 shadow-sm",
                    message.role === "user"
                      ? "ml-auto bg-[linear-gradient(135deg,#0b6fa4_0%,#1f6b5c_100%)] text-white"
                      : "border border-slate-200/80 bg-white text-slate-700"
                  )}
                >
                  {message.title ? (
                    <h3
                      className={cn(
                        "text-[13px] font-semibold",
                        message.role === "user" ? "text-white" : "text-slate-950"
                      )}
                    >
                      {message.title}
                    </h3>
                  ) : null}
                  <p className={cn("text-[13px] leading-5", message.title ? "mt-1.5" : "")}>{message.text}</p>
                  {message.actions.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.actions.map((action) => (
                        <AssistantActionButton
                          key={`${message.id}-${action.label}-${action.to ?? action.href ?? ""}`}
                          action={action}
                        />
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}

              {isTyping ? (
                <div className="max-w-[90%] rounded-[1.25rem] border border-slate-200/80 bg-white px-3.5 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-300" />
                    <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-300 [animation-delay:120ms]" />
                    <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-300 [animation-delay:240ms]" />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200/80 bg-white/92 p-3">
            <div className="flex items-end gap-2 rounded-[1.25rem] border border-slate-200/90 bg-slate-50/90 p-1.5">
              <label htmlFor="homepage-assistant-input" className="flex-1">
                <span className="sr-only">Type your question</span>
                <input
                  id="homepage-assistant-input"
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask about calls, submission, or tracking"
                  className="h-10 w-full bg-transparent px-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={!draft.trim() || isTyping}
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-full transition",
                  draft.trim() && !isTyping
                    ? "bg-[linear-gradient(135deg,#0b6fa4_0%,#1f6b5c_100%)] text-white shadow-[0_10px_22px_rgba(11,111,164,0.2)] hover:-translate-y-px"
                    : "bg-slate-200 text-slate-400"
                )}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      ) : whatsappUrl ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-[#25d366] text-white shadow-[0_16px_34px_rgba(15,23,42,0.18)] backdrop-blur-xl transition hover:-translate-y-px hover:bg-[#1ebe5d]"
          aria-label="Contact us on WhatsApp"
        >
          <WhatsAppIcon className="h-7 w-7" />
        </a>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-[linear-gradient(135deg,#14384e_0%,#184d44_100%)] text-white shadow-[0_16px_34px_rgba(15,23,42,0.18)] backdrop-blur-xl hover:-translate-y-px"
          aria-label="Open homepage assistant"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      )}
    </section>
  )
}
