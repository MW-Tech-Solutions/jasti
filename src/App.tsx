import * as React from "react"
import {
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  ChevronDown,
  CheckCircle2,
  Download,
  Eye,
  ExternalLink,
  FileSearch,
  FileText,
  Globe2,
  Menu,
  MessageCircle,
  Search,
  X,
} from "lucide-react"
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom"

import AdminApp from "@/AdminApp"
import PortalApp from "@/PortalApp"
import CampaignLandingPage from "@/CampaignLandingPage"
import logoImage from "@/assets/logo.jpeg"
import CookieConsentBanner from "@/components/CookieConsentBanner"
import HomepageAssistant from "@/components/HomepageAssistant"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Toaster } from "@/components/ui/sonner"
import {
  aboutSections,
  advancedFeatures,
  aims,
  governanceRoles,
  publicationTimeline,
  scopeAreas,
  workflowStages,
} from "@/data/jastiContent"
import { useJournalSettings } from "@/hooks/useJournalSettings"
import {
  buildPublicArticleDownloadUrl,
  getFeaturedArticles,
  getPublicArticle,
  getPublicResearchers,
  resolveApiAssetUrl,
  type FeaturedArticle,
  type JournalSettings,
  type PublicArticleDetail,
  type PublicResearcher,
} from "@/lib/journalApi"
import { cn } from "@/lib/utils"

const heroStats = [
  {
    label: "Home for research",
    value: "Applied science, technology, innovation, education, and management",
  },
  {
    label: "Editorial model",
    value: "Transparent peer review and documented editorial decisions",
  },
  {
    label: "Publication flow",
    value: "Submission, review, revision, approval, and visibility tracking",
  },
]

function buildWhatsAppUrl(rawNumber: string) {
  const digits = rawNumber.replace(/\D/g, "")
  if (!digits) return ""

  const normalized = digits.startsWith("0") ? `234${digits.slice(1)}` : digits
  return `https://wa.me/${normalized}`
}

const headerLinks = [
  { to: "/publications", label: "Publications" },
  { to: "/researchers", label: "Researchers" },
  {
    to: "/about",
    label: "About JASTI",
    children: aboutSections.map((section) => ({ to: `/about/${section.id}`, label: section.title })),
  },
  { to: "/scope", label: "Aims and Scope" },
  { to: "/discover-open-access", label: "Discover Open Access" },
  { to: "/publish-with-us", label: "Publish with Us" },
  { to: "/call-for-papers", label: "Call for Papers" },
  { to: "/trending-research", label: "Trending Research" },
]

const loginLinks = [
  { to: "/login/author", label: "Author Login" },
  { to: "/login/editor", label: "Editor Login" },
  { to: "/login/reviewer", label: "Reviewer Login" },
  { to: "/login/admin", label: "Admin Login" },
]

const footerGroups = [
  {
    title: "Explore",
    links: [
      { to: "/", label: "Home" },
      { to: "/publications", label: "Publications" },
      { to: "/researchers", label: "Researchers" },
      { to: "/about", label: "About JASTI" },
      { to: "/scope", label: "Aims and Scope" },
      { to: "/workflow", label: "Workflow" },
    ],
  },
  {
    title: "Publishing",
    links: [
      { to: "/discover-open-access", label: "Discover Open Access" },
      { to: "/publish-with-us", label: "Publish with Us" },
      { to: "/call-for-papers", label: "Call for Papers" },
      { to: "/technology", label: "Advanced Features" },
    ],
  },
  {
    title: "Access",
    links: [
      { to: "/login/author", label: "Track Your Research" },
      { to: "/dashboard", label: "Dashboard" },
      { to: "/trending-research", label: "Trending Research" },
      { to: "/governance", label: "Editorial Roles" },
    ],
  },
]

const popularSearches = [
  "Open access",
  "Published articles",
  "Call for papers",
  "Engineering systems",
  "Climate solutions",
  "Track your research",
]

const withAttachmentDisposition = (url: string) => {
  const nextUrl = new URL(url)
  nextUrl.searchParams.set("disposition", "attachment")
  return nextUrl.toString()
}

const isPreviewableAsset = (value?: string | null) => {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return false
  return [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"].some((extension) => normalized.includes(extension))
}

type SearchEntry = {
  title: string
  description: string
  to: string
  category: string
  searchText?: string
}

const resolveVisual = (value?: string) => (value ? resolveApiAssetUrl(value) : "")

function createSearchSnippet(value: string, fallback: string, maxLength = 180) {
  const normalized = value.replace(/\s+/g, " ").trim() || fallback
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength).trimEnd()}...`
}

const publicationLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
type PublicationSortFilter = "recent" | "views"
type ResearcherSortFilter = "name" | "relevance" | "publications" | "h-index"

function normalizeArticleTypeKey(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "article"
}

function formatArticleTypeLabel(value?: string | null) {
  const normalized = String(value ?? "").trim()
  if (!normalized) return "Article"

  return normalized
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) =>
      segment.length <= 3
        ? segment.toUpperCase()
        : `${segment.charAt(0).toUpperCase()}${segment.slice(1).toLowerCase()}`,
    )
    .join(" ")
}

function resolvePublicationYear(article: Pick<FeaturedArticle, "publication_date">) {
  return String(article.publication_date ?? "").match(/\b\d{4}\b/)?.[0] ?? ""
}

function parseArticleKeywords(value?: string | null) {
  return Array.from(
    new Set(
      String(value ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  )
}

function resolvePublicationLetter(title?: string | null) {
  const leadingCharacter = String(title ?? "").trim().match(/[A-Za-z0-9]/)?.[0]?.toUpperCase() ?? ""
  return /^\d$/.test(leadingCharacter) ? "0-9" : leadingCharacter
}

function resolveResearcherLetter(name?: string | null) {
  const leadingCharacter = String(name ?? "").trim().match(/[A-Za-z0-9]/)?.[0]?.toUpperCase() ?? ""
  return /^\d$/.test(leadingCharacter) ? "0-9" : leadingCharacter
}

function formatPublicationDate(value?: string | null) {
  const normalized = String(value ?? "").trim()
  if (!normalized) return "Publication date pending"

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split("-").map((segment) => Number(segment))
    const parsed = new Date(year, month - 1, day)
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(parsed)
  }

  return normalized
}

function getResearcherInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (parts.length === 0) return "JR"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
}

function parseMultiValueParam(searchParams: URLSearchParams, key: string) {
  return Array.from(
    new Set(
      searchParams
        .getAll(key)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )
}

function buildResearcherSearchText(researcher: PublicResearcher) {
  return [
    researcher.name,
    researcher.profile_label,
    researcher.institution,
    researcher.country ?? "",
    researcher.primary_field,
    researcher.expertise_tags.join(" "),
    researcher.publications
      .map((publication) => [publication.title, publication.article_type, publication.journal_name, publication.keywords.join(" ")].join(" "))
      .join(" "),
  ]
    .join(" ")
    .toLowerCase()
}

function computeResearcherRelevance(researcher: PublicResearcher, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return researcher.citations * 3 + researcher.h_index * 10 + researcher.publication_count * 6
  }

  let score = 0
  const name = researcher.name.toLowerCase()
  const institution = researcher.institution.toLowerCase()
  const primaryField = researcher.primary_field.toLowerCase()
  const expertiseText = researcher.expertise_tags.join(" ").toLowerCase()
  const publicationText = researcher.publications
    .map((publication) => `${publication.title} ${publication.article_type} ${publication.journal_name}`.toLowerCase())
    .join(" ")

  if (name === normalizedQuery) score += 120
  if (name.startsWith(normalizedQuery)) score += 80
  if (name.includes(normalizedQuery)) score += 40
  if (institution.includes(normalizedQuery)) score += 28
  if (primaryField.includes(normalizedQuery)) score += 24
  if (expertiseText.includes(normalizedQuery)) score += 18
  if (publicationText.includes(normalizedQuery)) score += 12

  return score + researcher.citations * 2 + researcher.h_index * 8 + researcher.publication_count * 4
}

const buildStaticSearchEntries = (settings: JournalSettings): SearchEntry[] => [
  { title: "Home", description: settings.homepage_intro, to: "/", category: "Overview" },
  {
    title: "Publications",
    description: "Browse JASTI's published research archive by topic, type, year, and usage signals.",
    to: "/publications",
    category: "Archive",
  },
  {
    title: "Researchers",
    description: "Browse published researchers, their expertise areas, affiliations, and publication signals.",
    to: "/researchers",
    category: "Community",
  },
  {
    title: settings.discover_open_access_title,
    description: settings.discover_open_access_body,
    to: "/discover-open-access",
    category: "Publishing",
  },
  {
    title: settings.publish_with_us_title,
    description: settings.publish_with_us_body,
    to: "/publish-with-us",
    category: "Publishing",
  },
  {
    title: settings.track_research_title,
    description: settings.track_research_body,
    to: "/login/author",
    category: "Access",
  },
  {
    title: "Call for Papers",
    description: "Submission deadlines, active calls, and issue opportunities.",
    to: "/call-for-papers",
    category: "Calls",
  },
  {
    title: "Trending Research",
    description: "Highlighted applied themes and current research momentum.",
    to: "/trending-research",
    category: "Discovery",
  },
  ...aboutSections.map((section) => ({
    title: section.title,
    description: section.body.join(" "),
    to: `/about/${section.id}`,
    category: "About",
  })),
  ...settings.call_for_papers.map((entry) => ({
    title: entry.title,
    description: `${entry.summary} Deadline: ${entry.deadline}`,
    to: "/call-for-papers",
    category: "Calls",
  })),
  ...settings.trending_research.map((entry) => ({
    title: entry.title,
    description: `${entry.area}. ${entry.summary}`,
    to: "/trending-research",
    category: "Trending",
  })),
  ...settings.scope.map((item) => ({
    title: item,
    description: "Thematic area within JASTI.",
    to: "/scope",
    category: "Scope",
  })),
]

const buildPublishedArticleSearchEntries = (articles: FeaturedArticle[]): SearchEntry[] =>
  articles.map((article) => {
    const journalName = article.journal_name?.trim() || "JASTI"
    const abstractSnippet = createSearchSnippet(article.abstract ?? "", "Published JASTI article.")
    const authorText = article.authors.join(", ")

    return {
      title: article.title,
      description: authorText ? `${journalName}. ${authorText}. ${abstractSnippet}` : `${journalName}. ${abstractSnippet}`,
      to: `/articles/${article.article_id}`,
      category: "Published Article",
      searchText: [
        journalName,
        article.abstract,
        article.article_type,
        article.doi,
        article.publication_date,
        article.keywords ?? "",
        article.authors.join(" "),
      ].join(" "),
    }
  })

const deduplicateSearchEntries = (entries: SearchEntry[]) => {
  const seen = new Set<string>()

  return entries.filter((entry) => {
    const key = `${entry.category}::${entry.title}::${entry.to}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

let publishedSearchEntriesCache: SearchEntry[] | null = null
let publishedSearchEntriesPromise: Promise<SearchEntry[]> | null = null

async function loadPublishedSearchEntries() {
  if (publishedSearchEntriesCache) return publishedSearchEntriesCache

  if (!publishedSearchEntriesPromise) {
    publishedSearchEntriesPromise = getFeaturedArticles({ limit: 200 })
      .then((response) => buildPublishedArticleSearchEntries(response.articles ?? []))
      .catch(() => [])
      .then((entries) => {
        publishedSearchEntriesCache = entries
        return entries
      })
  }

  return publishedSearchEntriesPromise
}

function useSearchEntries(settings: JournalSettings) {
  const staticEntries = React.useMemo(() => buildStaticSearchEntries(settings), [settings])
  const [publishedEntries, setPublishedEntries] = React.useState<SearchEntry[]>(publishedSearchEntriesCache ?? [])

  React.useEffect(() => {
    let cancelled = false

    void loadPublishedSearchEntries().then((entries) => {
      if (!cancelled) {
        setPublishedEntries(entries)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  return React.useMemo(
    () => deduplicateSearchEntries([...publishedEntries, ...staticEntries]),
    [publishedEntries, staticEntries],
  )
}

const filterEntries = (entries: SearchEntry[], query: string) => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []

  return entries.filter((entry) => [entry.title, entry.description, entry.category, entry.searchText ?? ""].join(" ").toLowerCase().includes(normalized))
}

const HERO_MAX_LINES = 3
const HERO_TYPEWRITER_DELETE_DELAY_MS = 90
const HERO_TYPEWRITER_HOLD_DELAY_MS = 1800
const HERO_TYPEWRITER_START_DELAY_MS = 280
const HERO_TYPEWRITER_WORD_DELAY_MS = 180

function getPhraseWords(phrase: string) {
  return phrase.split(/\s+/).filter(Boolean)
}

function resolveCssLengthToPx(value: string, rootFontSize: number) {
  const normalized = value.trim()
  if (!normalized) return 0

  if (normalized.endsWith("rem")) {
    return Number.parseFloat(normalized) * rootFontSize
  }

  if (normalized.endsWith("px")) {
    return Number.parseFloat(normalized)
  }

  if (normalized.endsWith("vw")) {
    return (window.innerWidth * Number.parseFloat(normalized)) / 100
  }

  if (normalized.endsWith("vh")) {
    return (window.innerHeight * Number.parseFloat(normalized)) / 100
  }

  return Number.parseFloat(normalized)
}

function HeroHeadline({ phrases }: { phrases: string[] }) {
  const shellRef = React.useRef<HTMLDivElement | null>(null)
  const measureRef = React.useRef<HTMLHeadingElement | null>(null)
  const overlayRef = React.useRef<HTMLHeadingElement | null>(null)
  const visibleTextRef = React.useRef<HTMLSpanElement | null>(null)
  const normalizedPhrases = React.useMemo(
    () => Array.from(new Set(phrases.map((phrase) => phrase.trim()).filter(Boolean))),
    [phrases]
  )
  const fallbackPhrase = normalizedPhrases[0] || "Building a rigorous African journal platform for applied research."
  const longestPhrase = React.useMemo(
    () =>
      normalizedPhrases.reduce(
        (longest, phrase) => (phrase.length > longest.length ? phrase : longest),
        fallbackPhrase
      ),
    [fallbackPhrase, normalizedPhrases]
  )
  const [activePhraseIndex, setActivePhraseIndex] = React.useState(0)
  const [visibleWordCount, setVisibleWordCount] = React.useState(0)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [caretMetrics, setCaretMetrics] = React.useState({ left: 0, top: 0, height: 0, ready: false })
  const activePhrase = normalizedPhrases[activePhraseIndex] || fallbackPhrase
  const activeWords = React.useMemo(() => getPhraseWords(activePhrase), [activePhrase])
  const visibleText = React.useMemo(
    () => activeWords.slice(0, visibleWordCount).join(" "),
    [activeWords, visibleWordCount]
  )
  const remainingText = activePhrase.slice(visibleText.length)

  React.useEffect(() => {
    if (normalizedPhrases.length <= 1) {
      setVisibleWordCount(getPhraseWords(fallbackPhrase).length)
      setActivePhraseIndex(0)
      setIsDeleting(false)
      return
    }

    const timeout = window.setTimeout(
      () => {
        if (!isDeleting) {
          if (visibleWordCount >= activeWords.length) {
            setIsDeleting(true)
            return
          }

          setVisibleWordCount((currentCount) => Math.min(activeWords.length, currentCount + 1))
          return
        }

        if (visibleWordCount <= 1) {
          const nextIndex = (activePhraseIndex + 1) % normalizedPhrases.length
          const nextPhrase = normalizedPhrases[nextIndex] || fallbackPhrase
          setActivePhraseIndex(nextIndex)
          setIsDeleting(false)
          setVisibleWordCount(Math.min(1, getPhraseWords(nextPhrase).length))
          return
        }

        setVisibleWordCount((currentCount) => Math.max(1, currentCount - 1))
      },
      !isDeleting && visibleWordCount >= activeWords.length
        ? HERO_TYPEWRITER_HOLD_DELAY_MS
        : isDeleting
          ? HERO_TYPEWRITER_DELETE_DELAY_MS
          : visibleWordCount === 0
            ? HERO_TYPEWRITER_START_DELAY_MS
            : HERO_TYPEWRITER_WORD_DELAY_MS,
    )

    return () => {
      window.clearTimeout(timeout)
    }
  }, [activePhraseIndex, activeWords, fallbackPhrase, isDeleting, normalizedPhrases, visibleWordCount])

  React.useLayoutEffect(() => {
    const measureElement = measureRef.current
    const shell = shellRef.current
    if (!measureElement || !shell || typeof window === "undefined" || typeof document === "undefined") return

    let frame = 0
    let observer: ResizeObserver | null = null
    let cancelled = false

    const fitHeading = () => {
      const element = measureRef.current
      const wrapper = shellRef.current
      if (!element || !wrapper) return

      wrapper.style.removeProperty("--hero-display-size")

      const rootFontSize =
        Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const styles = getComputedStyle(element)
      const minSize = resolveCssLengthToPx(styles.getPropertyValue("--hero-display-min"), rootFontSize)
      const maxSize = resolveCssLengthToPx(styles.getPropertyValue("--hero-display-max"), rootFontSize)
      const fluidSize = resolveCssLengthToPx(styles.getPropertyValue("--hero-display-fluid"), rootFontSize)
      const fitMinSize =
        resolveCssLengthToPx(styles.getPropertyValue("--hero-display-fit-min"), rootFontSize) ||
        minSize
      const baseSize = Math.min(maxSize, Math.max(minSize, fluidSize))
      const phrasesToMeasure = normalizedPhrases.length > 0 ? normalizedPhrases : [fallbackPhrase]

      let low = Math.min(fitMinSize, baseSize)
      let high = baseSize
      let best = low
      let bestLayoutPhrase = phrasesToMeasure[0]

      const evaluateSize = (fontSize: number) => {
        wrapper.style.setProperty("--hero-display-size", `${fontSize}px`)

        const currentStyles = getComputedStyle(element)
        const lineHeight = Number.parseFloat(currentStyles.lineHeight) || fontSize * 1.02
        const allowedHeight = lineHeight * HERO_MAX_LINES + 1

        let tallestPhrase = phrasesToMeasure[0]
        let tallestHeight = 0
        let fitsAllPhrases = true

        for (const phrase of phrasesToMeasure) {
          element.textContent = phrase
          const height = element.scrollHeight

          if (height > tallestHeight) {
            tallestHeight = height
            tallestPhrase = phrase
          }

          if (height > allowedHeight) {
            fitsAllPhrases = false
          }
        }

        return { fitsAllPhrases, tallestPhrase }
      }

      for (let index = 0; index < 14; index += 1) {
        const mid = (low + high) / 2
        const { fitsAllPhrases, tallestPhrase } = evaluateSize(mid)

        if (fitsAllPhrases) {
          best = mid
          bestLayoutPhrase = tallestPhrase
          low = mid
        } else {
          high = mid
        }
      }

      wrapper.style.setProperty("--hero-display-size", `${best}px`)
      element.textContent = bestLayoutPhrase
    }

    const scheduleFit = () => {
      cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(fitHeading)
    }

    if ("fonts" in document) {
      void document.fonts.ready
        .then(() => {
          if (!cancelled) scheduleFit()
        })
        .catch(() => {
          if (!cancelled) scheduleFit()
        })
    } else {
      scheduleFit()
    }

    window.addEventListener("resize", scheduleFit)

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(scheduleFit)
      if (measureElement.parentElement) observer.observe(measureElement.parentElement)
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", scheduleFit)
      observer?.disconnect()
    }
  }, [fallbackPhrase, longestPhrase, normalizedPhrases])

  React.useLayoutEffect(() => {
    const overlayElement = overlayRef.current
    const textElement = visibleTextRef.current
    if (!overlayElement || !textElement || typeof window === "undefined") return

    const updateCaret = () => {
      const overlayRect = overlayElement.getBoundingClientRect()
      const textRect = textElement.getBoundingClientRect()
      const computed = getComputedStyle(overlayElement)
      const fallbackHeight = Number.parseFloat(computed.lineHeight) || textRect.height || 0

      if (!visibleText.trim()) {
        setCaretMetrics({ left: 0, top: 0, height: fallbackHeight, ready: true })
        return
      }

      const range = document.createRange()
      range.selectNodeContents(textElement)
      range.collapse(false)
      const rects = range.getClientRects()
      const lastRect = rects.length > 0 ? rects[rects.length - 1] : textRect

      setCaretMetrics({
        left: Math.max(0, lastRect.right - overlayRect.left),
        top: Math.max(0, lastRect.top - overlayRect.top),
        height: lastRect.height || fallbackHeight,
        ready: true,
      })
    }

    const frame = window.requestAnimationFrame(updateCaret)
    window.addEventListener("resize", updateCaret)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("resize", updateCaret)
    }
  }, [visibleText])

  return (
    <div
      ref={shellRef}
      className="relative mt-5 max-w-4xl [--hero-display-fit-min:0.75rem] [--hero-display-fluid:2.2vw] [--hero-display-max:2.2rem] lg:[--hero-display-fluid:2.0vw] lg:[--hero-display-max:1.9rem] xl:[--hero-display-max:2.0rem] sm:mt-6"
    >
      <div className="pointer-events-none absolute -left-6 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(48,169,215,0.14),transparent_72%)] blur-2xl animate-[float-soft_8s_ease-in-out_infinite]" />
      <h1
        ref={measureRef}
        aria-hidden="true"
        className="display-hero invisible max-w-4xl text-slate-950"
      >
        {longestPhrase}
      </h1>
      <h1
        ref={overlayRef}
        className="absolute inset-0 display-hero max-w-4xl text-slate-950"
        aria-label={activePhrase}
      >
        <span className="inline bg-[linear-gradient(180deg,rgba(255,255,255,0.28),rgba(255,255,255,0.04))] px-1 py-1">
          <span ref={visibleTextRef}>{visibleText || "\u00A0"}</span>
          <span className="text-transparent">{remainingText || "\u00A0"}</span>
        </span>
      </h1>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full bg-[linear-gradient(180deg,#0b6fa4_0%,#1f6b5c_100%)] animate-pulse"
        style={{
          width: "0.09em",
          height: `${caretMetrics.height || 0}px`,
          left: `${caretMetrics.left + 4}px`,
          top: `${caretMetrics.top + 4}px`,
          opacity: caretMetrics.ready ? 1 : 0,
        }}
      />
      <div className="mt-5 h-1.5 w-28 rounded-full bg-[linear-gradient(90deg,rgba(48,169,215,0.95),rgba(31,107,92,0.92),rgba(20,56,78,0.12))]" />
    </div>
  )
}

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="max-w-3xl space-y-4">
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="section-title text-balance text-[clamp(2.25rem,4vw,4rem)]">{title}</h2>
      <p className="max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">{description}</p>
    </div>
  )
}

function SearchBox({
  settings,
  compact = false,
  inlineResults = false,
  initialQuery = "",
}: {
  settings: JournalSettings
  compact?: boolean
  inlineResults?: boolean
  initialQuery?: string
}) {
  const navigate = useNavigate()
  const entries = useSearchEntries(settings)
  const [query, setQuery] = React.useState(initialQuery)
  const matches = React.useMemo(() => filterEntries(entries, query).slice(0, 6), [entries, query])

  React.useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return
    navigate(`/search?q=${encodeURIComponent(normalizedQuery)}`)
  }

  const results = matches.length > 0 ? (
    <div
      className={cn(
        "surface-panel-strong overflow-hidden border border-white/80",
        inlineResults ? "mt-3" : "absolute left-0 right-0 top-full z-40 mt-3"
      )}
    >
      {matches.map((entry) => (
        <Link
          key={`${entry.category}-${entry.title}`}
          to={entry.to}
          className="block border-b border-slate-200/70 px-5 py-4 last:border-b-0 hover:bg-slate-50/80"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0b6fa4]">{entry.category}</p>
          <p className="mt-2 text-base font-semibold text-slate-950">{entry.title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{entry.description}</p>
        </Link>
      ))}
    </div>
  ) : null

  return (
    <div className="relative">
      <form onSubmit={submit} className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search journals, calls, policies, and research topics"
          className={cn(
            "w-full rounded-2xl border border-white/80 bg-white/92 pl-11 pr-28 text-sm text-slate-700 shadow-[0_16px_32px_rgba(15,23,42,0.08)] backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jostum-500/70 focus-visible:ring-offset-2",
            compact ? "h-12" : "h-14"
          )}
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1.5 inline-flex h-[calc(100%-0.75rem)] items-center justify-center rounded-xl bg-[linear-gradient(135deg,#0b6fa4_0%,#1f6b5c_100%)] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(11,111,164,0.18)] hover:-translate-y-px"
        >
          Search
        </button>
      </form>
      {results}
    </div>
  )
}

function FeatureCard({
  title,
  body,
  to,
  image,
}: {
  title: string
  body: string
  to: string
  image?: string
}) {
  const resolved = resolveVisual(image)

  return (
    <Link to={to} className="group block h-full">
      <Card className="flex h-full flex-col overflow-hidden rounded-[1.8rem] border-[#d6e1e8] bg-[#fcfdfd] shadow-[0_16px_34px_rgba(15,23,42,0.08)] backdrop-blur-none transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_42px_rgba(15,23,42,0.12)]">
        <div className="relative h-[14rem] overflow-hidden bg-[#dde6eb] sm:h-[14.5rem]">
          {resolved ? (
            <img
              src={resolved}
              alt={title}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
            />
          ) : null}
          <div className="absolute left-4 top-4 sm:left-5 sm:top-5">
            <Badge className="rounded-full border-[#b8e3df] bg-white px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0b6fa4] shadow-[0_8px_16px_rgba(11,111,164,0.12)]">
              JASTI FEATURE
            </Badge>
          </div>
        </div>
        <CardContent className="flex flex-1 flex-col px-6 pb-6 pt-4 sm:px-7 sm:pb-7 sm:pt-5">
          <h3 className="display-card text-[clamp(2rem,2.35vw,2.65rem)] leading-[0.98] tracking-[-0.055em] text-[#131c28]">
            {title}
          </h3>
          <p className="mt-4 text-[0.98rem] leading-[1.8] text-[#586679] sm:text-[1rem]">
            {body}
          </p>
          <span className="mt-auto inline-flex items-center gap-2 pt-6 text-[1rem] font-semibold text-[#0b6fa4]">
            Open page
            <ArrowRight className="h-4 w-4 stroke-[2.2] transition group-hover:translate-x-1" />
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}

function FeaturedArticlesSection({
  articles,
  title,
  description,
  sectionId,
}: {
  articles: FeaturedArticle[]
  title: string
  description: string
  sectionId?: string
}) {
  return (
    <section id={sectionId} className="page-shell py-8 sm:py-10 lg:py-14">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <SectionIntro eyebrow="Featured Articles" title={title} description={description} />
        <Link
          to="/publications"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#0b6fa4]"
        >
          Browse full archive
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {articles.length ? (
          articles.map((article) => (
            <Link key={article.article_id} to={`/articles/${article.article_id}`} className="block h-full">
              <Card className="surface-panel-strong flex h-full flex-col overflow-hidden">
                <div className="h-1.5 bg-[linear-gradient(90deg,#0b6fa4_0%,#1f6b5c_100%)]" />
                <CardHeader className="space-y-4">
                  <Badge className="w-fit bg-[#edf5f9] text-[#0b6fa4]">{article.article_type || "Article"}</Badge>
                  <CardTitle className="display-card text-slate-950">{article.title}</CardTitle>
                  <CardDescription>{article.doi || "DOI pending"}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <p className="line-clamp-4 flex-1 text-sm leading-7 text-slate-600">
                    {article.abstract || "Published JASTI article."}
                  </p>
                  <div className="mt-6 grid grid-cols-3 gap-1.5 sm:mt-auto sm:gap-2">
                    <Badge
                      variant="outline"
                      className="min-w-0 justify-center whitespace-nowrap border-slate-200/90 bg-white/85 px-2 py-1.5 text-slate-500"
                    >
                      <span className="text-[10px] font-semibold tracking-normal text-slate-900 sm:text-[11px]">
                        {article.downloads}
                      </span>
                      <span className="ml-1 text-[9px] tracking-[0.08em] sm:ml-1.5 sm:text-[10px]">Downloads</span>
                    </Badge>
                    <Badge
                      variant="outline"
                      className="min-w-0 justify-center whitespace-nowrap border-slate-200/90 bg-white/85 px-2 py-1.5 text-slate-500"
                    >
                      <span className="text-[10px] font-semibold tracking-normal text-slate-900 sm:text-[11px]">
                        {article.citations}
                      </span>
                      <span className="ml-1 text-[9px] tracking-[0.08em] sm:ml-1.5 sm:text-[10px]">Citations</span>
                    </Badge>
                    <Badge
                      variant="outline"
                      className="min-w-0 justify-center whitespace-nowrap border-slate-200/90 bg-white/85 px-2 py-1.5 text-[10px] font-semibold tracking-normal text-slate-900 sm:text-[11px]"
                    >
                      {article.publication_date}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <Card className="surface-panel lg:col-span-3">
            <CardContent className="p-8 text-sm leading-7 text-slate-600">
              No published articles are available yet. Featured Articles/Manuscripts will appear here
              once the Editor-in-Chief approves and publishes manuscripts.
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  )
}

function PublicationsPage() {
  const { settings } = useJournalSettings()
  const [searchParams, setSearchParams] = useSearchParams()
  const [articles, setArticles] = React.useState<FeaturedArticle[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState("")
  const activeQuery = searchParams.get("q")?.trim() ?? ""
  const activeType = searchParams.get("type")?.trim() || "all"
  const activeYear = searchParams.get("year")?.trim() || "all"
  const activeSort: PublicationSortFilter = searchParams.get("sort") === "views" ? "views" : "recent"
  const requestedLetter = (searchParams.get("letter") ?? "all").trim().toUpperCase()
  const activeLetter = requestedLetter === "0-9" || publicationLetters.includes(requestedLetter) ? requestedLetter : "all"
  const [searchInput, setSearchInput] = React.useState(activeQuery)

  React.useEffect(() => {
    let cancelled = false

    setLoading(true)
    setLoadError("")

    void getFeaturedArticles({ limit: 200 })
      .then((response) => {
        if (cancelled) return
        setArticles(response.articles ?? [])
      })
      .catch(() => {
        if (cancelled) return
        setArticles([])
        setLoadError("Published article data could not be loaded right now.")
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
  }, [])

  React.useEffect(() => {
    setSearchInput(activeQuery)
  }, [activeQuery])

  const updateFilters = React.useCallback((updates: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(searchParams)

    Object.entries(updates).forEach(([key, value]) => {
      const normalizedValue = String(value ?? "").trim()
      const shouldClear =
        normalizedValue === "" ||
        normalizedValue === "all" ||
        (key === "sort" && normalizedValue === "recent")

      if (shouldClear) {
        nextParams.delete(key)
        return
      }

      nextParams.set(key, key === "letter" ? normalizedValue.toUpperCase() : normalizedValue)
    })

    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const clearFilters = React.useCallback(() => {
    setSearchInput("")
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  const articleTypeOptions = React.useMemo(() => {
    const options = new Map<string, string>()

    articles.forEach((article) => {
      const key = normalizeArticleTypeKey(article.article_type)
      if (!options.has(key)) {
        options.set(key, formatArticleTypeLabel(article.article_type))
      }
    })

    return Array.from(options, ([value, label]) => ({ value, label })).sort((left, right) =>
      left.label.localeCompare(right.label),
    )
  }, [articles])

  const yearOptions = React.useMemo(
    () =>
      Array.from(
        new Set(
          articles
            .map((article) => resolvePublicationYear(article))
            .filter(Boolean),
        ),
      ).sort((left, right) => Number(right) - Number(left)),
    [articles],
  )

  const archiveStats = React.useMemo(
    () => ({
      articles: articles.length,
      views: articles.reduce((sum, article) => sum + Number(article.views ?? 0), 0),
      downloads: articles.reduce((sum, article) => sum + Number(article.downloads ?? 0), 0),
      citations: articles.reduce((sum, article) => sum + Number(article.citations ?? 0), 0),
    }),
    [articles],
  )

  const buildPublicationSearchText = React.useCallback(
    (article: FeaturedArticle) =>
      [
        article.title,
        article.abstract,
        article.journal_name,
        article.article_type,
        article.doi,
        article.publication_date,
        article.keywords ?? "",
        article.authors.join(" "),
      ]
        .join(" ")
        .toLowerCase(),
    [],
  )

  const filteredArticles = React.useMemo(() => {
    const normalizedQuery = activeQuery.toLowerCase()

    return [...articles]
      .filter((article) => {
        if (activeType !== "all" && normalizeArticleTypeKey(article.article_type) !== activeType) {
          return false
        }

        if (activeYear !== "all" && resolvePublicationYear(article) !== activeYear) {
          return false
        }

        if (activeLetter !== "all" && resolvePublicationLetter(article.title) !== activeLetter) {
          return false
        }

        if (!normalizedQuery) {
          return true
        }

        return buildPublicationSearchText(article).includes(normalizedQuery)
      })
      .sort((left, right) => {
        if (activeSort === "views") {
          const viewDelta = Number(right.views ?? 0) - Number(left.views ?? 0)
          if (viewDelta !== 0) return viewDelta

          const downloadDelta = Number(right.downloads ?? 0) - Number(left.downloads ?? 0)
          if (downloadDelta !== 0) return downloadDelta
        }

        const dateDelta = String(right.publication_date ?? "").localeCompare(String(left.publication_date ?? ""))
        if (dateDelta !== 0) return dateDelta

        return right.article_id - left.article_id
      })
  }, [activeLetter, activeQuery, activeSort, activeType, activeYear, articles, buildPublicationSearchText])

  const activeTypeLabel =
    articleTypeOptions.find((option) => option.value === activeType)?.label || formatArticleTypeLabel(activeType)

  const activeFilterChips = [
    activeQuery ? `Search: ${activeQuery}` : "",
    activeType !== "all" ? activeTypeLabel : "",
    activeYear !== "all" ? activeYear : "",
    activeLetter !== "all" ? `Title: ${activeLetter}` : "",
    activeSort === "views" ? "Most viewed" : "",
  ].filter(Boolean)

  const archiveSummary =
    activeFilterChips.length > 0
      ? `Filtered by ${activeFilterChips.join(" • ")}.`
      : "Showing the full public archive of published JASTI articles."

  return (
    <SiteShell>
      <section className="page-shell py-8 sm:py-10 lg:py-14">
        <div className="surface-panel-strong relative overflow-hidden p-6 sm:p-8 lg:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(48,169,215,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(31,107,92,0.16),transparent_30%)]" />
          <div className="absolute right-[-5rem] top-[-4rem] h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(11,111,164,0.14),transparent_70%)] blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              <Link to="/" className="transition hover:text-[#0b6fa4]">
                Home
              </Link>
              <span>/</span>
              <span className="text-slate-700">Publications</span>
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-[1.06fr_0.94fr]">
              <div className="max-w-4xl">
                <span className="eyebrow">Research archive</span>
                <h1 className="section-title mt-4 text-[clamp(2.5rem,5vw,5rem)] leading-[0.95] tracking-[-0.05em] text-slate-950">
                  Publications
                </h1>
                <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-600 sm:hidden break-words whitespace-normal">
                  Browse JASTI's published research — quick search and A–Z title browsing.
                </p>
                <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 hidden sm:block sm:text-lg break-words whitespace-normal">
                  Browse JASTI&apos;s published research archive with the same discovery flow readers expect:
                  quick search, author lookup, A-Z title browsing, article-type filters, publication-year
                  filters, and most-viewed sorting.
                </p>

                <div className="mt-8 flex gap-3 justify-between sm:grid sm:grid-cols-3 lg:max-w-3xl">
                  {[
                    { label: "Published articles", value: archiveStats.articles.toLocaleString() },
                    { label: "Archive views", value: archiveStats.views.toLocaleString() },
                    { label: "Downloads", value: archiveStats.downloads.toLocaleString() },
                  ].map((item) => (
                    <div key={item.label} className="surface-muted flex flex-col justify-between p-3 sm:p-5 flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 break-words">
                        {item.label}
                      </p>
                      <p className="mt-2 text-sm sm:text-xl font-semibold text-slate-950 break-words">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Card className="border-white/80 bg-white/88 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
                <CardHeader>
                  <Badge className="w-fit bg-[#edf5f9] text-[#0b6fa4] hidden sm:inline-flex">Archive tools</Badge>
                    <CardTitle className="display-card text-slate-950 hidden sm:block">Search the publications archive</CardTitle>
                    <CardDescription className="text-sm leading-7 hidden sm:block">
                      Search titles, authors, abstracts, DOI values, journals, and keywords, then refine the
                      results with the archive filters below.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      updateFilters({ q: searchInput })
                    }}
                    className="space-y-3"
                  >
                    <div className="relative">
                      <input
                        type="text"
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="Search publications, authors, DOI, keywords or journal"
                        className="h-12 w-full rounded-full border border-white/80 bg-white/92 pl-4 pr-14 text-sm text-slate-700 shadow-[0_12px_24px_rgba(15,23,42,0.06)] backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jostum-500/70 focus-visible:ring-offset-2"
                      />

                      <button
                        type="button"
                        onClick={() => { setSearchInput(""); clearFilters(); }}
                        aria-label="Clear search"
                        className="absolute right-10 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent bg-white/90 text-slate-600 shadow-sm hover:bg-white"
                      >
                        <X className="h-4 w-4" />
                      </button>

                      <button
                        type="submit"
                        aria-label="Submit search"
                        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-jostum-700 text-white shadow-sm hover:bg-jostum-800"
                      >
                        <Search className="h-4 w-4" />
                      </button>
                    </div>
                  </form>

                  <div className="surface-muted space-y-2 p-4 text-sm leading-7 text-slate-600 hidden sm:block">
                    <p className="font-semibold text-slate-900">Archive coverage</p>
                    <p>
                      {settings.featured_articles_description || "Published JASTI articles appear here as a searchable public archive."}
                    </p>
                    <p>
                      {archiveStats.citations.toLocaleString()} citations are currently tracked across the public
                      article archive.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell pb-6">
        <Card className="surface-panel overflow-hidden">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Browse by title</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Jump directly to publications by the first letter in the title, just like a browsable archive index.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeLetter !== "all" ? (
                  <Badge className="bg-[#edf5f9] text-[#0b6fa4]">{`Current: ${activeLetter}`}</Badge>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilters({ letter: "all" })}
                >
                  Browse all
                </Button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 justify-center">
              {["all", ...publicationLetters, "0-9"].map((letter) => {
                const isActive = activeLetter === letter

                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => updateFilters({ letter })}
                    className={cn(
                      "inline-flex min-w-[2.55rem] items-center justify-center rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition",
                      isActive
                        ? "border-[#14384e] bg-[#14384e] text-white shadow-[0_12px_24px_rgba(20,56,78,0.16)]"
                        : "border-slate-200 bg-white text-slate-600 hover:border-[#0b6fa4]/25 hover:text-[#0b6fa4]",
                    )}
                  >
                    {letter === "all" ? "All" : letter}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="page-shell pb-12 lg:pb-16">
        <div className="grid gap-6 xl:grid-cols-[18.5rem_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card className="surface-panel">
              <CardHeader>
                <CardTitle className="display-card text-slate-950">Filter archive</CardTitle>
                <CardDescription>
                  Refine the publication list by article type, year, and ranking mode.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="publications-type-filter"
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                  >
                    Article type
                  </label>
                  <select
                    id="publications-type-filter"
                    value={activeType}
                    onChange={(event) => updateFilters({ type: event.target.value })}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jostum-500/70 focus-visible:ring-offset-2"
                  >
                    <option value="all">All types</option>
                    {articleTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="publications-year-filter"
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                  >
                    Publication year
                  </label>
                  <select
                    id="publications-year-filter"
                    value={activeYear}
                    onChange={(event) => updateFilters({ year: event.target.value })}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jostum-500/70 focus-visible:ring-offset-2"
                  >
                    <option value="all">All years</option>
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="publications-sort-filter"
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                  >
                    Sort by
                  </label>
                  <select
                    id="publications-sort-filter"
                    value={activeSort}
                    onChange={(event) => updateFilters({ sort: event.target.value })}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jostum-500/70 focus-visible:ring-offset-2"
                  >
                    <option value="recent">Most recent</option>
                    <option value="views">Most viewed</option>
                  </select>
                </div>

                <Button type="button" variant="outline" className="w-full" onClick={clearFilters}>
                  Reset archive filters
                </Button>
              </CardContent>
            </Card>
          </aside>

          <div className="space-y-6">
            <Card className="surface-panel overflow-hidden">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {loading ? "Loading archive" : `${filteredArticles.length} publication${filteredArticles.length === 1 ? "" : "s"}`}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{archiveSummary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeFilterChips.length ? (
                    activeFilterChips.map((chip) => (
                      <Badge key={chip} className="bg-[#edf5f9] text-[#0b6fa4]">
                        {chip}
                      </Badge>
                    ))
                  ) : (
                    <Badge className="bg-[#edf5f9] text-[#0b6fa4]">Full archive</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {loading ? (
              <Card className="surface-panel">
                <CardContent className="p-8 text-sm leading-7 text-slate-600">
                  Loading published articles...
                </CardContent>
              </Card>
            ) : loadError ? (
              <Card className="surface-panel">
                <CardContent className="space-y-4 p-8">
                  <p className="text-sm leading-7 text-slate-600">{loadError}</p>
                  <Button type="button" onClick={() => window.location.reload()}>
                    Try again
                  </Button>
                </CardContent>
              </Card>
            ) : filteredArticles.length ? (
              <div className="grid gap-5 md:grid-cols-2">
                {filteredArticles.map((article) => {
                  const keywords = parseArticleKeywords(article.keywords)
                  const authorList = article.authors.filter(Boolean)

                  return (
                    <Link key={article.article_id} to={`/articles/${article.article_id}`} className="group block h-full">
                      <Card className="surface-panel-strong flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_44px_rgba(15,23,42,0.12)]">
                        <div className="h-1.5 bg-[linear-gradient(90deg,#0b6fa4_0%,#1f6b5c_100%)]" />
                        <CardHeader className="space-y-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-emerald-50 text-emerald-700">Open access</Badge>
                            <Badge className="bg-[#edf5f9] text-[#0b6fa4]">
                              {formatArticleTypeLabel(article.article_type)}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            <span>{formatPublicationDate(article.publication_date)}</span>
                            {article.doi ? <span>{article.doi}</span> : null}
                          </div>
                          <CardTitle className="display-card text-slate-950 transition group-hover:text-[#0b6fa4]">
                            {article.title}
                          </CardTitle>
                          {authorList.length ? (
                            <p className="text-sm font-medium leading-6 text-slate-600">
                              {authorList.join(", ")}
                            </p>
                          ) : null}
                        </CardHeader>
                        <CardContent className="flex flex-1 flex-col">
                          <p className="line-clamp-5 text-sm leading-7 text-slate-600">
                            {createSearchSnippet(article.abstract || "", "Published JASTI article.", 260)}
                          </p>

                          <div className="mt-5 flex flex-wrap gap-2">
                            {keywords.length ? (
                              <>
                                {keywords.slice(0, 4).map((keyword) => (
                                  <Badge key={keyword} variant="outline" className="border-slate-200 bg-white/85 text-slate-600">
                                    {keyword}
                                  </Badge>
                                ))}
                                {keywords.length > 4 ? (
                                  <Badge variant="outline" className="border-slate-200 bg-white/85 text-slate-600">
                                    +{keywords.length - 4} more
                                  </Badge>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                                No keywords supplied
                              </span>
                            )}
                          </div>

                          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/80 pt-4">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className="border-slate-200 bg-white/85 text-slate-700 text-[11px]">
                                <Eye className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                                {article.views} views
                              </Badge>
                              <Badge variant="outline" className="border-slate-200 bg-white/85 text-slate-700 text-[11px]">
                                <Download className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                                {article.downloads} downloads
                              </Badge>
                              <Badge variant="outline" className="border-slate-200 bg-white/85 text-slate-700 text-[11px]">
                                {article.citations} citations
                              </Badge>
                            </div>
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#0b6fa4]">
                              Read publication
                              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <Card className="surface-panel">
                <CardContent className="space-y-4 p-8">
                  <p className="text-sm leading-7 text-slate-600">
                    No publications matched the current archive filters. Try a broader search term or reset the
                    filters to browse the full archive again.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button type="button" onClick={clearFilters}>
                      Reset filters
                    </Button>
                    <Link to="/search" className={cn(buttonVariants({ variant: "outline" }))}>
                      Search site-wide
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>
    </SiteShell>
  )
}

function ResearchersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [researchers, setResearchers] = React.useState<PublicResearcher[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState("")
  const activeQuery = searchParams.get("q")?.trim() ?? ""
  const activeSort: ResearcherSortFilter =
    searchParams.get("sort") === "relevance"
      ? "relevance"
      : searchParams.get("sort") === "publications"
        ? "publications"
        : searchParams.get("sort") === "h-index"
          ? "h-index"
          : "name"
  const requestedLetter = (searchParams.get("letter") ?? "all").trim().toUpperCase()
  const activeLetter = requestedLetter === "0-9" || publicationLetters.includes(requestedLetter) ? requestedLetter : "all"
  const activeInstitutions = React.useMemo(() => parseMultiValueParam(searchParams, "institution"), [searchParams])
  const activeFields = React.useMemo(() => parseMultiValueParam(searchParams, "field"), [searchParams])
  const activeTags = React.useMemo(() => parseMultiValueParam(searchParams, "tag"), [searchParams])
  const activeProfile = searchParams.get("profile")?.trim() ?? ""
  const activePublicationMinimum = Math.max(0, Number.parseInt(searchParams.get("pubmin") ?? "0", 10) || 0)
  const activeHIndexMinimum = Math.max(0, Number.parseInt(searchParams.get("hmin") ?? "0", 10) || 0)
  const [searchInput, setSearchInput] = React.useState(activeQuery)

  React.useEffect(() => {
    let cancelled = false

    setLoading(true)
    setLoadError("")

    void getPublicResearchers()
      .then((response) => {
        if (cancelled) return
        setResearchers(response.researchers ?? [])
      })
      .catch(() => {
        if (cancelled) return
        setResearchers([])
        setLoadError("The researcher directory could not be loaded right now.")
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
  }, [])

  React.useEffect(() => {
    setSearchInput(activeQuery)
  }, [activeQuery])

  const updateFilters = React.useCallback((updates: Record<string, string | string[] | null>) => {
    const nextParams = new URLSearchParams(searchParams)

    Object.keys(updates).forEach((key) => nextParams.delete(key))

    Object.entries(updates).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value
          .map((entry) => entry.trim())
          .filter(Boolean)
          .forEach((entry) => nextParams.append(key, entry))
        return
      }

      const normalizedValue = String(value ?? "").trim()
      const shouldClear =
        normalizedValue === "" ||
        normalizedValue === "all" ||
        (key === "sort" && normalizedValue === "name") ||
        ((key === "pubmin" || key === "hmin") && normalizedValue === "0")

      if (shouldClear) {
        return
      }

      nextParams.set(key, key === "letter" ? normalizedValue.toUpperCase() : normalizedValue)
    })

    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const clearFilters = React.useCallback(() => {
    setSearchInput("")
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  const toggleMultiFilter = React.useCallback((key: string, activeValues: string[], value: string) => {
    const nextValues = activeValues.includes(value)
      ? activeValues.filter((entry) => entry !== value)
      : [...activeValues, value].sort((left, right) => left.localeCompare(right))

    updateFilters({ [key]: nextValues })
  }, [updateFilters])

  const maxPublicationCount = React.useMemo(
    () => Math.max(1, ...researchers.map((researcher) => researcher.publication_count)),
    [researchers],
  )
  const maxHIndex = React.useMemo(
    () => Math.max(1, ...researchers.map((researcher) => researcher.h_index)),
    [researchers],
  )
  const publicationMinimum = Math.min(activePublicationMinimum, maxPublicationCount)
  const hIndexMinimum = Math.min(activeHIndexMinimum, maxHIndex)

  const institutionOptions = React.useMemo(() => {
    const counts = new Map<string, number>()

    researchers.forEach((researcher) => {
      const institution = researcher.institution.trim()
      if (!institution) return
      counts.set(institution, (counts.get(institution) ?? 0) + 1)
    })

    return Array.from(counts, ([value, count]) => ({ value, count })).sort((left, right) =>
      right.count - left.count || left.value.localeCompare(right.value),
    )
  }, [researchers])

  const fieldOptions = React.useMemo(() => {
    const counts = new Map<string, number>()

    researchers.forEach((researcher) => {
      const values = new Set([researcher.primary_field, ...researcher.expertise_tags].map((entry) => entry.trim()).filter(Boolean))
      values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
    })

    return Array.from(counts, ([value, count]) => ({ value, count })).sort((left, right) =>
      right.count - left.count || left.value.localeCompare(right.value),
    )
  }, [researchers])

  const tagOptions = React.useMemo(() => {
    const counts = new Map<string, number>()

    researchers.forEach((researcher) => {
      researcher.expertise_tags.forEach((tag) => {
        const normalizedTag = tag.trim()
        if (!normalizedTag) return
        counts.set(normalizedTag, (counts.get(normalizedTag) ?? 0) + 1)
      })
    })

    return Array.from(counts, ([value, count]) => ({ value, count })).sort((left, right) =>
      right.count - left.count || left.value.localeCompare(right.value),
    )
  }, [researchers])

  const filteredResearchers = React.useMemo(() => {
    const normalizedQuery = activeQuery.trim().toLowerCase()

    return researchers
      .filter((researcher) => {
        if (activeLetter !== "all" && resolveResearcherLetter(researcher.name) !== activeLetter) {
          return false
        }

        if (activeInstitutions.length > 0 && !activeInstitutions.includes(researcher.institution)) {
          return false
        }

        if (
          activeFields.length > 0 &&
          !activeFields.some((field) =>
            field === researcher.primary_field || researcher.expertise_tags.includes(field),
          )
        ) {
          return false
        }

        if (
          activeTags.length > 0 &&
          !activeTags.some((tag) => researcher.expertise_tags.includes(tag))
        ) {
          return false
        }

        if (researcher.publication_count < publicationMinimum || researcher.h_index < hIndexMinimum) {
          return false
        }

        if (normalizedQuery && !buildResearcherSearchText(researcher).includes(normalizedQuery)) {
          return false
        }

        return true
      })
      .sort((left, right) => {
        if (activeSort === "publications") {
          return right.publication_count - left.publication_count
            || right.citations - left.citations
            || left.name.localeCompare(right.name)
        }

        if (activeSort === "h-index") {
          return right.h_index - left.h_index
            || right.citations - left.citations
            || left.name.localeCompare(right.name)
        }

        if (activeSort === "relevance") {
          return computeResearcherRelevance(right, activeQuery) - computeResearcherRelevance(left, activeQuery)
            || left.name.localeCompare(right.name)
        }

        return left.name.localeCompare(right.name)
      })
  }, [
    activeFields,
    activeInstitutions,
    activeLetter,
    activeQuery,
    activeSort,
    activeTags,
    hIndexMinimum,
    publicationMinimum,
    researchers,
  ])

  const selectedResearcher = React.useMemo(
    () => researchers.find((researcher) => researcher.slug === activeProfile) ?? null,
    [activeProfile, researchers],
  )

  React.useEffect(() => {
    if (!selectedResearcher || typeof document === "undefined") return

    const originalOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        updateFilters({ profile: null })
      }
    }

    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [selectedResearcher, updateFilters])

  const directoryStats = React.useMemo(() => {
    const institutionCount = new Set(researchers.map((researcher) => researcher.institution).filter(Boolean)).size
    const fieldCount = new Set(researchers.flatMap((researcher) => [researcher.primary_field, ...researcher.expertise_tags]).filter(Boolean)).size
    const publicationCount = researchers.reduce((sum, researcher) => sum + researcher.publication_count, 0)

    return {
      researchers: researchers.length,
      institutions: institutionCount,
      fields: fieldCount,
      publications: publicationCount,
    }
  }, [researchers])

  const activeFilterChips = [
    activeQuery ? `Search: ${activeQuery}` : "",
    activeInstitutions.length ? `${activeInstitutions.length} institution${activeInstitutions.length === 1 ? "" : "s"}` : "",
    activeFields.length ? `${activeFields.length} field${activeFields.length === 1 ? "" : "s"}` : "",
    activeTags.length ? `${activeTags.length} tag${activeTags.length === 1 ? "" : "s"}` : "",
    activeLetter !== "all" ? `Name: ${activeLetter}` : "",
    publicationMinimum > 0 ? `Min publications: ${publicationMinimum}` : "",
    /* hIndexMinimum > 0 ? `Min H-index: ${hIndexMinimum}` : "", */
    activeSort !== "name" ? `Sort: ${activeSort}` : "",
  ].filter(Boolean)

  const directorySummary = activeFilterChips.length
    ? `Filtered by ${activeFilterChips.join(" • ")}.`
    : "Showing the full public directory of published JASTI researchers."

  return (
    <SiteShell>
      <section className="page-shell py-8 sm:py-10 lg:py-14">
        <div className="surface-panel-strong relative overflow-hidden p-6 sm:p-8 lg:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(48,169,215,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(31,107,92,0.16),transparent_30%)]" />
          <div className="absolute right-[-5rem] top-[-4rem] h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(11,111,164,0.14),transparent_70%)] blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              <Link to="/" className="transition hover:text-[#0b6fa4]">
                Home
              </Link>
              <span>/</span>
              <span className="text-slate-700">Researchers</span>
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-[1.06fr_0.94fr]">
              <div className="max-w-4xl">
                <span className="eyebrow">Research community</span>
                <h1 className="section-title mt-4 text-[clamp(2.5rem,5vw,5rem)] leading-[0.95] tracking-[-0.05em] text-slate-950">
                  Researchers
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
                  Explore published researchers, compare expertise clusters, and move from people to
                  their publication record with the same discovery rhythm used across the JASTI archive.
                </p>
                <div className="mt-8 grid gap-2 grid-cols-3 lg:max-w-3xl">
                  {[
                    { label: "Researchers", value: directoryStats.researchers.toLocaleString() },
                    { label: "Institutions", value: directoryStats.institutions.toLocaleString() },
                    { label: "Tracked publications", value: directoryStats.publications.toLocaleString() },
                  ].map((item) => (
                    <div key={item.label} className="surface-muted flex flex-col items-center justify-between p-2 sm:p-5 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 leading-tight">
                        {item.label}
                      </p>
                      <p className="mt-2 text-base font-semibold text-slate-950 sm:text-xl leading-none">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Card className="border-white/80 bg-white/88 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
                <CardHeader>
                  <Badge className="w-fit bg-[#edf5f9] text-[#0b6fa4]">Directory tools</Badge>
                  <CardTitle className="display-card text-slate-950">Search the researchers directory</CardTitle>
                  {/* <CardDescription className="text-sm leading-7">
                    Search by researcher name, institution, publication keywords, journal title, or
                    expertise tag to find the right profile quickly.
                  </CardDescription> */}
                </CardHeader>
                <CardContent className="space-y-4">
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      updateFilters({ q: searchInput, profile: null })
                    }}
                    className="space-y-3"
                  >
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="Search by name, expertise, keyword, or affiliation"
                        className="h-12 w-full rounded-2xl border border-white/80 bg-white/92 pl-11 pr-28 text-sm text-slate-700 shadow-[0_16px_32px_rgba(15,23,42,0.08)] backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jostum-500/70 focus-visible:ring-offset-2"
                      />
                      <button
                        type="submit"
                        className="absolute right-1.5 top-1.5 inline-flex h-[calc(100%-0.75rem)] items-center justify-center rounded-xl bg-[linear-gradient(135deg,#0b6fa4_0%,#1f6b5c_100%)] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(11,111,164,0.18)]"
                      >
                        Search
                      </button>
                    </div>
                  </form>

                  <div className="surface-muted space-y-2 p-4 text-sm leading-7 text-slate-600">
                    <p className="font-semibold text-slate-900">Directory coverage</p>
                    <p>
                      This page contain publicly published JASTI authors and aggregates their
                      publication metrics, institutions, and expertise signals into one browsable directory.
                    </p>
                    {/* <p>
                      {directoryStats.fields.toLocaleString()} expertise areas are currently represented
                      across the published researcher community.
                    </p> */}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell pb-6">
        <Card className="surface-panel overflow-hidden">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Browse by name</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Jump directly to researchers by the first letter in their display name, just like a
                  browsable scholarly directory.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {activeLetter !== "all" ? (
                  <Badge className="bg-[#edf5f9] text-[#0b6fa4]">{`Current: ${activeLetter}`}</Badge>
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={() => updateFilters({ letter: "all" })}>
                  Browse all
                </Button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 justify-center">
              {["all", ...publicationLetters, "0-9"].map((letter) => {
                const isActive = activeLetter === letter

                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => updateFilters({ letter })}
                    className={cn(
                      "inline-flex min-w-[2.55rem] items-center justify-center rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition",
                      isActive
                        ? "border-[#14384e] bg-[#14384e] text-white shadow-[0_12px_24px_rgba(20,56,78,0.16)]"
                        : "border-slate-200 bg-white text-slate-600 hover:border-[#0b6fa4]/25 hover:text-[#0b6fa4]",
                    )}
                  >
                    {letter === "all" ? "All" : letter}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="page-shell pb-12 lg:pb-16">
        <div className="grid gap-6 xl:grid-cols-[18.5rem_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card className="surface-panel">
              <CardHeader>
                <CardTitle className="display-card text-slate-950">Filter researchers</CardTitle>
                <CardDescription>
                  Narrow the directory by institution, field, expertise tags, and minimum metric thresholds.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="researchers-institution-filter" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Institution
                  </label>
                  <select
                    id="researchers-institution-filter"
                    value={activeInstitutions[0] ?? "all"}
                    onChange={(event) => updateFilters({ institution: event.target.value === "all" ? [] : [event.target.value] })}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jostum-500/70 focus-visible:ring-offset-2"
                  >
                    <option value="all">All institutions</option>
                    {institutionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.value} {option.count ? `(${option.count})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="researchers-field-filter" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Research field
                  </label>
                  <select
                    id="researchers-field-filter"
                    value={activeFields[0] ?? "all"}
                    onChange={(event) => updateFilters({ field: event.target.value === "all" ? [] : [event.target.value] })}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jostum-500/70 focus-visible:ring-offset-2"
                  >
                    <option value="all">All fields</option>
                    {fieldOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.value} {option.count ? `(${option.count})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Publication count</p>
                    <span className="text-sm font-semibold text-slate-700">{publicationMinimum}+</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxPublicationCount}
                    value={publicationMinimum}
                    onChange={(event) => updateFilters({ pubmin: event.target.value })}
                    className="h-2 w-full cursor-pointer accent-[#0b6fa4]"
                  />
                </div>

                {/* H-index filter commented out
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">H-index</p>
                    <span className="text-sm font-semibold text-slate-700">{hIndexMinimum}+</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxHIndex}
                    value={hIndexMinimum}
                    onChange={(event) => updateFilters({ hmin: event.target.value })}
                    className="h-2 w-full cursor-pointer accent-[#0b6fa4]"
                  />
                </div>
                */}

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Expertise tags</p>
                    {activeTags.length ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#0b6fa4]"
                        onClick={() => updateFilters({ tag: [] })}
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tagOptions.slice(0, 14).map((option) => {
                      const selected = activeTags.includes(option.value)

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => toggleMultiFilter("tag", activeTags, option.value)}
                          className={cn(
                            "rounded-full border px-3 py-2 text-xs font-semibold transition",
                            selected
                              ? "border-[#14384e] bg-[#14384e] text-white shadow-[0_10px_20px_rgba(20,56,78,0.16)]"
                              : "border-slate-200 bg-white text-slate-600 hover:border-[#0b6fa4]/25 hover:text-[#0b6fa4]",
                          )}
                        >
                          {option.value}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <Button type="button" variant="outline" className="w-full" onClick={clearFilters}>
                  Reset researcher filters
                </Button>
              </CardContent>
            </Card>
          </aside>

          <div className="space-y-6">
            <Card className="surface-panel overflow-hidden">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {loading ? "Loading directory" : `${filteredResearchers.length} researcher${filteredResearchers.length === 1 ? "" : "s"} found`}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{directorySummary}</p>
                </div>
                <div className="flex flex-col gap-3 sm:items-end">
                  <div className="flex items-center gap-3">
                    <label htmlFor="researchers-sort" className="text-sm font-semibold text-slate-700">
                      Sort by
                    </label>
                    <select
                      id="researchers-sort"
                      value={activeSort}
                      onChange={(event) => updateFilters({ sort: event.target.value })}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jostum-500/70 focus-visible:ring-offset-2"
                    >
                      <option value="name">Name (A-Z)</option>
                      <option value="relevance">Relevance</option>
                      <option value="publications">Publications (High-Low)</option>
                      {/* <option value="h-index">H-index</option> */}
                    </select>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {activeFilterChips.length ? (
                      activeFilterChips.map((chip) => (
                        <Badge key={chip} className="bg-[#edf5f9] text-[#0b6fa4]">
                          {chip}
                        </Badge>
                      ))
                    ) : (
                      <Badge className="bg-[#edf5f9] text-[#0b6fa4]">Full directory</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {loading ? (
              <Card className="surface-panel">
                <CardContent className="p-8 text-sm leading-7 text-slate-600">
                  Loading published researchers...
                </CardContent>
              </Card>
            ) : loadError ? (
              <Card className="surface-panel">
                <CardContent className="space-y-4 p-8">
                  <p className="text-sm leading-7 text-slate-600">{loadError}</p>
                  <Button type="button" onClick={() => window.location.reload()}>
                    Try again
                  </Button>
                </CardContent>
              </Card>
            ) : filteredResearchers.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredResearchers.map((researcher) => {
                  const latestPublication = researcher.publications[0] ?? null

                  return (
                    <Card
                      key={researcher.researcher_key}
                      className="surface-panel-strong flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_38px_rgba(15,23,42,0.1)]"
                    >
                      <div className="h-14 bg-[linear-gradient(135deg,#14384e_0%,#0b6fa4_55%,#1f6b5c_100%)]" />
                      <CardContent className="flex h-full flex-col p-4 pt-0">
                        <div className="-mt-6 flex items-end justify-between gap-2">
                          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-[linear-gradient(135deg,#0b6fa4_0%,#1f6b5c_100%)] text-sm font-semibold text-white shadow-[0_10px_18px_rgba(15,23,42,0.14)]">
                            {researcher.avatar_path ? (
                              <img
                                src={resolveVisual(researcher.avatar_path)}
                                alt={researcher.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              getResearcherInitials(researcher.name)
                            )}
                          </div>
                          <Badge className="bg-white/95 px-2.5 py-1 text-[10px] tracking-[0.14em] text-[#0b6fa4] shadow-sm">
                            {formatPublicationDate(researcher.latest_publication_date)}
                          </Badge>
                        </div>

                        <div className="mt-3">
                          <p className="font-display text-[1.7rem] leading-[1.05] tracking-[-0.03em] text-slate-950">
                            {researcher.name}
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-[#0b6fa4]">{researcher.profile_label}</p>
                          <p className="mt-1.5 text-sm leading-5 text-slate-600">{researcher.institution}</p>
                          <p className="mt-0.5 text-sm leading-5 text-slate-500">
                            {researcher.primary_field}
                            {researcher.country ? ` | ${researcher.country}` : ""}
                          </p>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-1.5">
                          {[
                            { label: "Publications", value: researcher.publication_count },
                            { label: "Citations", value: researcher.citations },
                            { label: "Views", value: researcher.views },
                          ].map((item) => (
                            <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-center">
                              <p className="text-base font-semibold leading-none text-slate-950">{item.value}</p>
                              <p className="mt-1 text-[7px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                {item.label}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {researcher.expertise_tags.slice(0, 3).map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="border-slate-200 bg-white/85 px-2 py-0.5 text-[10px] text-slate-600"
                            >
                              {tag}
                            </Badge>
                          ))}
                          {researcher.expertise_tags.length > 3 ? (
                            <Badge
                              variant="outline"
                              className="border-slate-200 bg-white/85 px-2 py-0.5 text-[10px] text-slate-600"
                            >
                              +{researcher.expertise_tags.length - 3} more
                            </Badge>
                          ) : null}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-3 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-2">
                            <Download className="h-3.5 w-3.5 text-slate-500" />
                            {researcher.downloads} downloads
                          </span>
                          {latestPublication ? (
                            <span className="inline-flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5 text-slate-500" />
                              {latestPublication.article_type || "Research article"}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-auto flex flex-wrap gap-2 pt-4">
                          <Button
                            type="button"
                            className="h-9 flex-1 px-3 text-sm"
                            onClick={() => updateFilters({ profile: researcher.slug })}
                          >
                            View profile
                          </Button>
                          <Link
                            to={`/publications?q=${encodeURIComponent(researcher.name)}`}
                            className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3 text-sm")}
                          >
                            Browse work
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card className="surface-panel">
                <CardContent className="space-y-4 p-8">
                  <p className="text-sm leading-7 text-slate-600">
                    No researchers matched the current directory filters. Try a broader search term or
                    reset the filters to browse the full directory again.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button type="button" onClick={clearFilters}>
                      Reset filters
                    </Button>
                    <Link to="/publications" className={cn(buttonVariants({ variant: "outline" }))}>
                      Browse publications
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      {selectedResearcher ? (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/55 p-4 sm:items-center"
          onClick={() => updateFilters({ profile: null })}
        >
          <div
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-y-auto rounded-[2rem] border border-white/70 bg-white shadow-[0_28px_64px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[linear-gradient(135deg,#14384e_0%,#0b6fa4_55%,#1f6b5c_100%)] px-6 py-6 text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)] sm:px-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-xl font-semibold text-white">
                    {selectedResearcher.avatar_path ? (
                      <img
                        src={resolveVisual(selectedResearcher.avatar_path)}
                        alt={selectedResearcher.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getResearcherInitials(selectedResearcher.name)
                    )}
                  </div>
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                      {selectedResearcher.profile_label}
                    </p>
                    <h2 className="display-modal mt-2 text-white">{selectedResearcher.name}</h2>
                    <p className="mt-2 text-sm leading-7 text-white/80">
                      {selectedResearcher.institution}
                      {selectedResearcher.country ? ` | ${selectedResearcher.country}` : ""}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white/90">{selectedResearcher.primary_field}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateFilters({ profile: null })}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6 sm:px-8">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  { label: "Publications", value: selectedResearcher.publication_count.toLocaleString() },
                  /* { label: "H-index", value: selectedResearcher.h_index.toLocaleString() }, */
                  { label: "Citations", value: selectedResearcher.citations.toLocaleString() },
                  { label: "Views", value: selectedResearcher.views.toLocaleString() },
                  { label: "Downloads", value: selectedResearcher.downloads.toLocaleString() },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Expertise</p>
                <div className="flex flex-wrap gap-2">
                  {selectedResearcher.expertise_tags.length ? (
                    selectedResearcher.expertise_tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="border-slate-200 bg-white text-slate-700">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">No expertise tags were extracted yet.</span>
                  )}
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
                <Card className="surface-panel">
                  <CardHeader>
                    <CardTitle className="display-card text-slate-950">Recent publications</CardTitle>
                    <CardDescription>
                      Browse the latest published work associated with this researcher.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedResearcher.publications.slice(0, 6).map((publication) => (
                      <Link
                        key={`${selectedResearcher.researcher_key}-${publication.article_id}`}
                        to={`/articles/${publication.article_id}`}
                        className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#0b6fa4]/20 hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)]"
                        onClick={() => updateFilters({ profile: null })}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-[#edf5f9] text-[#0b6fa4]">{publication.article_type || "Article"}</Badge>
                          <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                            {formatPublicationDate(publication.publication_date)}
                          </Badge>
                        </div>
                        <p className="mt-3 text-base font-semibold text-slate-950">{publication.title}</p>
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                          {createSearchSnippet(publication.abstract || "", "Published JASTI article.", 180)}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <Eye className="h-4 w-4" />
                            {publication.views}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Download className="h-4 w-4" />
                            {publication.downloads}
                          </span>
                          <span>{publication.citations} citations</span>
                          <span>{publication.journal_name}</span>
                        </div>
                      </Link>
                    ))}
                  </CardContent>
                </Card>

                <Card className="surface-panel">
                  <CardHeader>
                    <CardTitle className="display-card text-slate-950">Profile links</CardTitle>
                    <CardDescription>
                      Quick routes from this researcher profile into public JASTI content.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Link
                      to={`/publications?q=${encodeURIComponent(selectedResearcher.name)}`}
                      className={cn(buttonVariants(), "w-full justify-between")}
                      onClick={() => updateFilters({ profile: null })}
                    >
                      Browse this researcher&apos;s publications
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    {selectedResearcher.orcid_id ? (
                      <a
                        href={`https://orcid.org/${selectedResearcher.orcid_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between")}
                      >
                        Open ORCID profile
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                      This profile is built from published JASTI metadata and updates as new articles are
                      added to the public archive.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </SiteShell>
  )
}

function ArticleDetailPage() {
  const { articleId } = useParams()
  const [article, setArticle] = React.useState<PublicArticleDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState("")
  const [previewModal, setPreviewModal] = React.useState<null | { title: string; url: string; helper: string; downloadUrl?: string }>(null)

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
  }, [articleId])

  React.useEffect(() => {
    setPreviewModal(null)
  }, [articleId])

  React.useEffect(() => {
    if (!articleId) return

    setLoading(true)
    setLoadError("")
    void getPublicArticle(Number(articleId))
      .then((response) => setArticle(response.article))
      .catch(() => {
        setArticle(null)
        setLoadError("The selected article could not be loaded.")
      })
      .finally(() => setLoading(false))
  }, [articleId])

  if (!articleId || Number.isNaN(Number(articleId))) {
    return <Navigate to="/" replace />
  }

  if (loading) {
    return (
      <SiteShell>
        <section className="page-shell py-16">
          <Card className="surface-panel">
            <CardContent className="p-6 text-sm text-slate-600">Loading article...</CardContent>
          </Card>
        </section>
      </SiteShell>
    )
  }

  if (!article) {
    return (
      <SiteShell>
        <section className="page-shell py-16">
          <Card className="surface-panel">
            <CardContent className="p-6 text-sm text-slate-600">
              {loadError || "Article not found."}
            </CardContent>
          </Card>
        </section>
      </SiteShell>
    )
  }

  const issueLine = [
    article.volume ? `Volume ${article.volume}` : "",
    article.issue_number ? `Issue ${article.issue_number}` : "",
    article.publication_year ? `${article.publication_year}` : "",
  ]
    .filter(Boolean)
    .join(", ")
  const hasPdfAsset = Boolean(article.pdf_path)
  const hasDedicatedArticleFile = Boolean(
    article.article_url && !/^\/articles\/\d+$/i.test(article.article_url) && article.article_url !== article.pdf_path,
  )
  const previewUrl = article.pdf_path && isPreviewableAsset(article.pdf_path)
    ? resolveApiAssetUrl(article.pdf_path)
    : hasDedicatedArticleFile && isPreviewableAsset(article.article_url)
      ? resolveApiAssetUrl(article.article_url)
      : ""
  const previewHelper = article.pdf_path ? "PDF preview" : "Document preview"
  const primaryFileLabel = article.pdf_path ? "PDF" : hasDedicatedArticleFile ? "File" : "Document"
  const pdfLink = hasPdfAsset ? buildPublicArticleDownloadUrl(article.article_id, "pdf") : ""
  const articleDownloadLink = hasDedicatedArticleFile ? buildPublicArticleDownloadUrl(article.article_id, "article") : ""
  const downloadLink = pdfLink
    ? withAttachmentDisposition(pdfLink)
    : articleDownloadLink
      ? withAttachmentDisposition(articleDownloadLink)
      : ""
  const articleLink = article.pdf_path && hasDedicatedArticleFile ? buildPublicArticleDownloadUrl(article.article_id, "article") : ""
  const registerDownloadClick = () => {
    setArticle((current) =>
      current
        ? {
            ...current,
            downloads: current.downloads + 1,
          }
        : current,
    )
  }
  const modalSupportsInlinePreview = previewModal ? isPreviewableAsset(previewModal.url) : false

  return (
    <SiteShell>
      {previewModal ? (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-950">{previewModal.title}</p>
                  <p className="text-xs text-slate-500">{previewModal.helper}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                aria-label="Close article preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-[76vh] bg-slate-50">
              {modalSupportsInlinePreview ? (
                <iframe title={`${previewModal.title} preview`} src={previewModal.url} className="h-full w-full" />
              ) : (
                <div className="flex h-full items-center justify-center px-6">
                  <div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <FileText className="h-6 w-6" />
                    </div>
                    <p className="mt-4 text-lg font-semibold text-slate-950">Preview not available in the browser</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      This document type needs to be downloaded or opened in a desktop editor to view properly.
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-3">
                      <a
                        href={previewModal.downloadUrl || previewModal.url}
                        className={cn(buttonVariants({ size: "lg" }))}
                        onClick={registerDownloadClick}
                      >
                        <Download className="h-4 w-4" />
                        Download file
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              {modalSupportsInlinePreview ? (
                <Button variant="outline" onClick={() => window.open(previewModal.url, "_blank", "noreferrer")}>
                  Open in new tab
                </Button>
              ) : (
                <a
                  href={previewModal.downloadUrl || previewModal.url}
                  className={cn(buttonVariants({ variant: "outline" }))}
                  onClick={registerDownloadClick}
                >
                  Download file
                </a>
              )}
              <Button onClick={() => setPreviewModal(null)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="page-shell py-8 sm:py-10 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="surface-panel-strong overflow-hidden p-8 sm:p-10">
            <Badge className="bg-white/90 text-[#0b6fa4]">{article.journal_name || "JASTI Article"}</Badge>
            <h1 className="mt-6 max-w-5xl font-display text-[clamp(1.75rem,3.2vw,3.2rem)] leading-[1.06] tracking-[-0.03em] text-slate-950">
              {article.title}
            </h1>
            <div className="mt-6 flex flex-wrap gap-2">
              {article.authors.map((author) => (
                <Badge key={author} variant="outline">
                  {author}
                </Badge>
              ))}
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Published", value: article.publication_date || "Pending date" },
                { label: "Issue", value: issueLine || "Awaiting issue assignment" },
                { label: "DOI", value: article.doi || "Pending DOI" },
                { label: "Pages", value: article.page_numbers || "To be assigned" },
              ].map((item) => (
                <div key={item.label} className="surface-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
          <Card className="surface-panel self-start">
            <CardHeader>
              <CardTitle className="display-card text-slate-950">Article access</CardTitle>
              <CardDescription>
                Preview the article in the journal viewer or download the file.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3 text-sm leading-7 text-slate-600">
                <p>
                  <span className="font-semibold text-slate-900">Volume and issue:</span>{" "}
                  {issueLine || "Awaiting issue assignment"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">ISSN:</span> {article.issn || "Pending ISSN"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Usage:</span> {article.views} views,{" "}
                  {article.downloads} downloads, {article.citations} citations
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {previewUrl ? (
                  <Button
                    size="lg"
                    onClick={() => setPreviewModal({ title: article.title, url: previewUrl, helper: previewHelper, downloadUrl: downloadLink || articleDownloadLink || previewUrl })}
                  >
                    <FileText className="h-4 w-4" />
                    {`View ${primaryFileLabel}`}
                  </Button>
                ) : null}
                {/* If there's a downloadable file but no inline preview URL, still offer a View button
                    that opens the same preview modal (it will show the "Preview not available" message
                    and allow downloading from the modal). This matches the CV-viewing modal used by
                    editors. */}
                {!previewUrl && (downloadLink || articleDownloadLink) ? (
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setPreviewModal({ title: article.title, url: downloadLink || articleDownloadLink || previewUrl || "", helper: `${primaryFileLabel} preview`, downloadUrl: downloadLink || articleDownloadLink || previewUrl || "" })}
                  >
                    <Eye className="h-4 w-4" />
                    {`View ${primaryFileLabel}`}
                  </Button>
                ) : null}
                {downloadLink ? (
                  <a
                    href={downloadLink}
                    onClick={registerDownloadClick}
                    className={cn(buttonVariants({ size: "lg" }))}
                  >
                    <Download className="h-4 w-4" />
                    {`Download ${primaryFileLabel}`}
                  </a>
                ) : null}
                {articleLink ? (
                  <a
                    href={articleLink}
                    target="_blank"
                    rel="noreferrer"
                    onClick={registerDownloadClick}
                    className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open article file
                  </a>
                ) : null}
              </div>
              <div className="surface-muted p-5 text-sm leading-7 text-slate-600">
                <p className="font-semibold text-slate-900">Cite this article</p>
                <p className="mt-2">
                  {article.authors.join(", ")}. {article.title}. {article.journal_name}.{" "}
                  {issueLine ? `${issueLine}. ` : ""}
                  {article.publication_date ? `${article.publication_date}. ` : ""}
                  {article.doi ? `https://doi.org/${article.doi}` : ""}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="page-shell pb-12 lg:pb-16">
        <div className="grid gap-8 lg:grid-cols-[0.72fr_0.28fr]">
          <article className="space-y-6">
            <Card className="surface-panel">
              <CardHeader>
                <CardTitle className="display-card text-slate-950">Abstract</CardTitle>
              </CardHeader>
              <CardContent className="text-[15px] leading-8 text-slate-700 text-justify">
                {article.abstract || "Abstract not available."}
              </CardContent>
            </Card>
            <Card className="surface-panel">
              <CardHeader>
                <CardTitle className="display-card text-slate-950">Introduction</CardTitle>
              </CardHeader>
              <CardContent className="text-[15px] leading-8 text-slate-700">
                {article.introduction}
              </CardContent>
            </Card>
          </article>
          <aside className="space-y-6">
            <Card className="surface-panel">
              <CardHeader>
                <CardTitle className="display-card text-slate-950">Article details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-slate-600">
                <p>
                  <span className="font-semibold text-slate-900">Article type:</span>{" "}
                  {article.article_type || "Research article"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Manuscript ID:</span> {article.manuscript_id}
                </p>
                {/* <p>
                  <span className="font-semibold text-slate-900">Altmetric score:</span>{" "}
                  {article.altmetric_score}
                </p> */}
              </CardContent>
            </Card>
            <Card className="surface-panel">
              <CardHeader>
                <CardTitle className="display-card text-slate-950">Keywords</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {article.keywords.length ? (
                  article.keywords.map((keyword) => (
                    <Badge key={keyword} className="bg-[#edf5f9] text-[#0b6fa4]">
                      {keyword}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No keywords provided.</p>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>
    </SiteShell>
  )
}

function Footer({ settings }: { settings: JournalSettings }) {
  const effectiveLogo = settings.logo_path ? resolveVisual(settings.logo_path) : logoImage

  return (
    <footer className="relative mt-16 overflow-hidden border-t border-white/20 bg-[#0f2230] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(48,169,215,0.18),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(31,107,92,0.22),transparent_30%)]" />
      <div className="page-shell relative py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <div>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white shadow-lg">
                <img src={effectiveLogo} alt={settings.journal_name} className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="display-acronym text-[1.75rem] sm:text-3xl">{settings.journal_acronym}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/65">{settings.journal_name}</p>
              </div>
            </div>
            <p className="mt-6 max-w-md text-sm leading-7 text-white/72">{settings.footer_summary}</p>
          </div>
          {footerGroups.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/65">{group.title}</p>
              <div className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="block text-sm text-white/85 transition hover:translate-x-0.5 hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="page-shell flex flex-col gap-3 py-5 text-sm text-white/60 items-center justify-center">
          <p className="text-center">
            <span className="block lg:hidden">Copyright © {new Date().getFullYear()} {settings.journal_acronym}.</span>
            <span className="hidden lg:block">Copyright © {new Date().getFullYear()} {settings.journal_name}.</span>
          </p>
        </div>
      </div>
    </footer>
  )
}

function LoginDropdown({
  isOpen,
  onToggle,
  onClose,
}: {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, onClose])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "gap-1.5 pr-4",
          isOpen && "border-slate-300 bg-white"
        )}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        Login
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen ? (
        <div
          className="absolute right-0 top-full z-50 mt-3 w-64 rounded-[1.4rem] border border-white/80 bg-white/95 p-3 shadow-[0_24px_50px_rgba(15,23,42,0.12)] backdrop-blur"
          role="menu"
        >
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Select login
          </p>
          <div className="space-y-1">
            {loginLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={onClose}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-[#0b6fa4]"
                role="menuitem"
              >
                <span>{link.label}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SiteShell({ children }: { children: React.ReactNode }) {
  const { settings } = useJournalSettings()
  const location = useLocation()
  const [topbarVisible, setTopbarVisible] = React.useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [loginMenuOpen, setLoginMenuOpen] = React.useState(false)
  const activeMobileGroup = React.useMemo(
    () =>
      headerLinks.find(
        (item) =>
          item.children &&
          (location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
      )?.to ?? null,
    [location.pathname]
  )
  const [expandedMobileGroup, setExpandedMobileGroup] = React.useState<string | null>(activeMobileGroup)
  const effectiveAcronym = settings.journal_acronym || "JASTI"
  const effectiveName =
    settings.journal_name || "Journal of Applied Science, Technology, and Innovation"

  

  const isUserLoggedIn = React.useCallback(() => {
    try {
      const keys = [
        "access_token",
        "token",
        "auth",
        "auth_token",
        "jasti_user",
        "auth_user",
        "user",
      ]

      for (const k of keys) {
        if (window.localStorage.getItem(k)) return true
      }

      const cookie = document.cookie || ""
      if (cookie) {
        for (const k of keys) {
          if (cookie.split(";").some((c) => c.trim().startsWith(k + "="))) return true
        }
      }

      return false
    } catch (e) {
      return false
    }
  }, [])

  React.useEffect(() => {
    setMobileMenuOpen(false)
    setLoginMenuOpen(false)
    setExpandedMobileGroup(activeMobileGroup)
  }, [location.pathname, activeMobileGroup])

  React.useEffect(() => {
    setTopbarVisible(true)

    const handleScroll = () => {
      if (window.scrollY > 24) {
        setTopbarVisible(false)
      } else {
        setTopbarVisible(true)
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [location.pathname])

  return (
    <div className="relative min-h-screen overflow-x-clip text-slate-900">
      <div className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top,rgba(11,111,164,0.12),transparent_46%),radial-gradient(circle_at_top_left,rgba(31,107,92,0.16),transparent_28%)]" />
      <header className="sticky top-0 z-50 border-b border-white/60 bg-[rgba(248,250,252,0.76)] backdrop-blur-xl">
        <div
          className={cn(
            "overflow-hidden border-white/20 bg-[linear-gradient(90deg,#14384e_0%,#184d44_100%)] text-white transition-all duration-300",
            topbarVisible ? "max-h-20 border-b opacity-100" : "max-h-0 border-b-0 opacity-0"
          )}
        >
          <div className="page-shell flex items-center justify-between gap-3 py-1.5 text-[11px] sm:text-xs">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 font-semibold uppercase tracking-[0.22em] text-white/95">
                {effectiveAcronym}
              </span>
              <span className="hidden truncate text-white/70 md:inline">
                {settings.home_topbar_text || "Applied research, editorial quality, and author visibility."}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/login/author"
                className="inline-flex shrink-0 items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-white/15"
              >
                Track your research
              </Link>
            </div>
          </div>
        </div>
        <div className="page-shell flex items-center gap-3 py-2 sm:gap-4 sm:py-2.5">
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] border border-white/80 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.1)] sm:h-12 sm:w-12 sm:rounded-[1.1rem]">
              {settings.logo_path ? (
                <img
                  src={resolveVisual(settings.logo_path)}
                  alt={`${effectiveAcronym} logo`}
                  className="h-full w-full object-fill"
                />
              ) : (
                <img src={logoImage} alt={`${effectiveAcronym} logo`} className="h-full w-full object-fill" />
              )}
            </div>
            <div className="min-w-0 h-10 sm:h-12 inline-flex flex-col items-center justify-center">
              {(() => {
                const parts = String(effectiveName || "").split(",")
                if (parts.length > 1) {
                  const first = parts[0].trim() + ","
                  const rest = parts.slice(1).join(",").trim()
                  return (
                    <div className="leading-none">
                      <span className="block text-[15px] sm:text-[18px] font-bold text-[#14384e]">{first}</span>
                      <span className="block text-[14px] sm:text-[16px] font-bold text-[#14384e] -mt-0.5 leading-[0.95]">{rest}</span>
                    </div>
                  )
                }

                return (
                  <p className="text-[15px] sm:text-[18px] font-bold text-[#14384e] leading-tight">{effectiveName}</p>
                )
              })()}
            </div>
          </Link>
 

          <div className="hidden flex-1 lg:block">
            <div className="mx-auto max-w-xl">
              <SearchBox settings={settings} compact />
            </div>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <LoginDropdown
              isOpen={loginMenuOpen}
              onToggle={() => setLoginMenuOpen((current) => !current)}
              onClose={() => setLoginMenuOpen(false)}
            />
            {isUserLoggedIn() ? (
              <Link to="/dashboard" className={cn(buttonVariants({ size: "lg" }))}>
                Dashboard
              </Link>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              setLoginMenuOpen(false)
              setMobileMenuOpen((current) => !current)
            }}
            className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-white/70 bg-white/88 text-slate-700 shadow-sm lg:hidden"
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <div className="hidden border-t border-slate-200/70 lg:block">
          <div className="page-shell flex items-center gap-3 py-2">
            {headerLinks.map((item) => (
              <div key={item.to} className="group relative">
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition",
                      isActive
                        ? "bg-[#14384e] text-white shadow-[0_14px_28px_rgba(20,56,78,0.18)]"
                        : "text-slate-700 hover:bg-white hover:text-[#0b6fa4]"
                    )
                  }
                >
                  {item.label}
                </NavLink>
                {item.children ? (
                  <div className="invisible absolute left-0 top-full z-50 mt-3 w-80 rounded-[1.4rem] border border-white/80 bg-white/95 p-3 opacity-0 shadow-[0_24px_50px_rgba(15,23,42,0.12)] transition duration-150 group-hover:visible group-hover:opacity-100">
                    {item.children.map((child) => (
                      <Link
                        key={child.to}
                        to={child.to}
                        className="block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-[#0b6fa4]"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-slate-200/70 bg-[rgba(248,250,252,0.92)] backdrop-blur lg:hidden">
            <div className="page-shell py-4">
              <div className="surface-panel-strong max-h-[calc(100vh-7rem)] overflow-y-auto p-4">
                <div className="space-y-4">
                  <div className="rounded-[1.35rem] border border-slate-200/80 bg-white/95 p-3 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Site navigation
                    </p>
                    <div className="mt-3 overflow-hidden rounded-[1.2rem] border border-slate-200/80 bg-slate-50/70">
                      {headerLinks.map((item, index) => {
                        const isActive =
                          location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
                        const isExpanded = expandedMobileGroup === item.to

                        return (
                          <div
                            key={item.to}
                            className={cn(index > 0 && "border-t border-slate-200/80")}
                          >
                            <div className="flex items-stretch">
                              <Link
                                to={item.to}
                                className={cn(
                                  "flex min-w-0 flex-1 items-center justify-between px-4 py-4 text-sm font-semibold transition",
                                  isActive
                                    ? "bg-[linear-gradient(135deg,#14384e_0%,#184d44_100%)] text-white shadow-[0_12px_24px_rgba(20,56,78,0.16)]"
                                    : "bg-white/88 text-slate-700 hover:bg-white"
                                )}
                              >
                                <span className="pr-3">{item.label}</span>
                                <ArrowRight className={cn("h-4 w-4 shrink-0", isActive ? "text-white/80" : "text-[#0b6fa4]")} />
                              </Link>
                              {item.children?.length ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedMobileGroup((current) => (current === item.to ? null : item.to))
                                  }
                                  className="flex w-12 shrink-0 items-center justify-center border-l border-slate-200/80 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                                  aria-label={isExpanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
                                >
                                  <ChevronDown
                                    className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")}
                                  />
                                </button>
                              ) : null}
                            </div>
                            {item.children?.length && isExpanded ? (
                              <div className="border-t border-slate-200/80 bg-slate-50/85 px-4 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                  {item.label} pages
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {item.children.map((child) => {
                                    const isChildActive = location.pathname === child.to

                                    return (
                                      <Link
                                        key={child.to}
                                        to={child.to}
                                        className={cn(
                                          "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                                          isChildActive
                                            ? "border-[#0b6fa4]/20 bg-[#edf5f9] text-[#0b6fa4]"
                                            : "border-slate-200 bg-white text-slate-600 hover:border-[#0b6fa4]/20 hover:text-[#0b6fa4]"
                                        )}
                                      >
                                        {child.label}
                                      </Link>
                                    )
                                  })}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="rounded-[1.35rem] border border-slate-200/80 bg-white/95 p-3 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Quick search
                    </p>
                    <div className="mt-3">
                      <SearchBox settings={settings} compact inlineResults />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-[1.35rem] border border-slate-200/80 bg-white/95 p-3 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Login access
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {loginLinks.map((link) => (
                          <Link
                            key={link.to}
                            to={link.to}
                            className={cn(
                              buttonVariants({ variant: "outline" }),
                              "w-full justify-between px-4"
                            )}
                          >
                            {link.label}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        ))}
                      </div>
                    </div>

                    <Link to="/dashboard" className={cn(buttonVariants(), "w-full")}>
                      Dashboard
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main>{children}</main>
      <Footer settings={settings} />
      {/* JASTI assistant - shown on all pages except the homepage */}
      {location.pathname !== "/" ? <HomepageAssistant settings={settings} /> : null}
      <Toaster position="top-right" />
    </div>
  )
}


function HomePage() {
  const { settings } = useJournalSettings()
  const [featuredArticles, setFeaturedArticles] = React.useState<FeaturedArticle[]>([])
  const whatsappUrl = React.useMemo(() => buildWhatsAppUrl(settings.whatsapp_number), [settings.whatsapp_number])
  const heroPhrases = React.useMemo(
    () => [
      settings.homepage_tagline,
      "Shape a trusted African journal ecosystem for applied scholarship.",
    ],
    [settings.homepage_tagline]
  )
  const heroBackgroundImage = React.useMemo(
    () => resolveVisual(settings.publish_with_us_image || "/images/publish-with-us.jpg"),
    [settings.publish_with_us_image]
  )
  const visibleCallForPapers = settings.call_for_papers.filter(
    (call) => call.title !== "Technology-driven climate and sustainability solutions"
  )

  React.useEffect(() => {
    void getFeaturedArticles({ limit: 6 })
      .then((response) => setFeaturedArticles(response.articles))
      .catch(() => setFeaturedArticles([]))
  }, [])

  return (
    <SiteShell>
      <section id="homepage-overview" className="page-shell py-8 sm:py-10 lg:py-14">
        <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1.12fr_0.88fr]">
          <div className="surface-panel-strong relative overflow-hidden p-6 sm:p-10 lg:p-12">
            {heroBackgroundImage ? (
              <>
                <div className="absolute inset-x-0 top-0 h-24 overflow-hidden sm:hidden">
                  <img
                    src={heroBackgroundImage}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover opacity-30 saturate-[0.88]"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,255,255,0.96))]" />
                </div>
                <div className="absolute inset-y-0 right-0 hidden w-[42%] overflow-hidden rounded-l-[2rem] sm:block lg:w-[35%] xl:w-[33%]">
                  <img
                    src={heroBackgroundImage}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover opacity-70 saturate-[0.86]"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(247,249,251,1)_0%,rgba(247,249,251,0.88)_18%,rgba(247,249,251,0.22)_54%,rgba(20,56,78,0.08)_100%)]" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.52),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.18))]" />
                </div>
              </>
            ) : null}
            <div className="absolute right-[-6rem] top-[-4rem] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(48,169,215,0.24),transparent_70%)] blur-3xl" />
            <div className="absolute bottom-[-5rem] left-[-3rem] h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(31,107,92,0.18),transparent_68%)] blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0))]" />
            <div className="relative max-w-[44rem] lg:max-w-[43rem] xl:max-w-[45rem]">
              <span className="eyebrow">Home for rigorous research</span>
              <HeroHeadline phrases={heroPhrases} />
              <p className="mt-5 max-w-3xl text-[0.98rem] leading-7 text-slate-600 sm:mt-6 sm:text-[1.04rem] sm:leading-8 lg:text-[1.12rem]">
                {settings.homepage_intro}
              </p>
              <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
                <Link to="/call-for-papers" className={cn(buttonVariants({ size: "lg" }), "w-full justify-center sm:w-auto")}>
                  View call for papers
                </Link>
                <Link to="/login/author?redirect=%2Fdashboard%3Frole%3Dauthor%26section%3Dsubmission" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full justify-center sm:w-auto")}>
                  Submit Manuscript
                </Link>
                {whatsappUrl ? (
                  <a href={whatsappUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full justify-center border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 sm:w-auto")}>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    WhatsApp Us
                  </a>
                ) : null}
              </div>
              <div className="mt-8 grid gap-3 sm:mt-10 md:grid-cols-3">
                {heroStats.map((item) => (
                  <div key={item.label} className="surface-muted p-4 sm:p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-900 sm:text-base">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <Card className="surface-panel-strong">
              <CardHeader>
                <CardTitle className="display-card text-slate-950">
                  Search research, calls, and journal content
                </CardTitle>
                <CardDescription className="text-[15px] leading-7">
                  Search across JASTI pages, thematic areas, calls for papers, and trending research topics.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <SearchBox settings={settings} inlineResults />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Popular searches</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {popularSearches.map((item) => (
                      <Link
                        key={item}
                        to={`/search?q=${encodeURIComponent(item)}`}
                        className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0b6fa4] shadow-sm hover:border-[#0b6fa4]/30"
                      >
                        {item}
                      </Link>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="surface-panel overflow-hidden">
              <div className="h-1.5 bg-[linear-gradient(90deg,#0b6fa4_0%,#1f6b5c_100%)]" />
              <CardHeader>
                <CardTitle className="display-card text-slate-950">
                  Submission windows and public pages
                </CardTitle>
                <CardDescription>
                  The journal combines public discovery, editorial publishing flows, and author tracking in one system.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {headerLinks.slice(0, 4).map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="surface-muted flex items-center justify-between px-4 py-4 text-sm font-semibold text-slate-700 hover:text-[#0b6fa4]"
                    >
                      <span>{item.label}</span>
                      <ArrowRight className="h-4 w-4 text-[#0b6fa4]" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <FeaturedArticlesSection
        articles={featuredArticles}
        title={settings.featured_articles_title}
        description={settings.featured_articles_description}
        sectionId="featured-articles-home"
      />

      <section className="page-shell py-8 sm:py-10 lg:py-14">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <SectionIntro
            eyebrow="Discover"
            title={settings.research_pathways_title}
            description="Three core pathways organize the JASTI experience: public publishing information, author guidance, and research visibility."
          />
        </div>
        <div className="grid gap-5 lg:grid-cols-3 xl:gap-6">
          <FeatureCard
            title={settings.discover_open_access_title}
            body={settings.discover_open_access_body}
            to="/discover-open-access"
            image={settings.discover_open_access_image}
          />
          <FeatureCard
            title={settings.publish_with_us_title}
            body={settings.publish_with_us_body}
            to="/publish-with-us"
            image={settings.publish_with_us_image}
          />
          <FeatureCard
            title={settings.track_research_title}
            body={settings.track_research_body}
            to="/login/author"
            image={settings.track_research_image}
          />
        </div>
      </section>

      <section id="call-for-papers-home" className="page-shell py-8 sm:py-10 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[1.04fr_0.96fr]">
          <Card className="surface-panel-strong">
            <CardHeader>
              <Badge className="w-fit bg-white/90 text-[#0b6fa4]">Call for papers</Badge>
              <CardTitle className="display-section text-slate-950">
                {settings.call_for_papers_title}
              </CardTitle>
              <CardDescription className="max-w-2xl text-base leading-8">
                {settings.call_for_papers_description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {visibleCallForPapers.length ? (
                visibleCallForPapers.map((call) => (
                  <div key={`${call.title}-${call.deadline}`} className="surface-muted p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">{call.title}</h3>
                      <Badge className="bg-[#edf5f9] text-[#0b6fa4]">
                        <CalendarClock className="mr-1 h-3.5 w-3.5" />
                        Deadline: {call.deadline}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{call.summary}</p>
                  </div>
                ))
              ) : (
                <div className="surface-muted p-5 text-sm leading-7 text-slate-600">
                  No active calls have been published yet.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="overflow-hidden border-none bg-[linear-gradient(135deg,#14384e_0%,#184d44_100%)] text-white shadow-editorial">
              <CardHeader>
                <Badge className="w-fit border-white/20 bg-white/10 text-white">Author access</Badge>
                <CardTitle className="display-section text-white">
                  {settings.call_for_papers_cta_title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-7 text-white/80">{settings.call_for_papers_cta_body}</p>
                <Link
                  to="/login/author?redirect=%2Fdashboard%3Frole%3Dauthor%26section%3Dsubmission"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Submit Manuscript
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>

            {/*
            <Card className="surface-panel">
              <CardHeader>
                <CardTitle className="display-card text-slate-950">Submission notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {settings.call_for_papers_notes.map((item) => (
                  <div key={item} className="surface-muted p-4 text-sm leading-7 text-slate-600">
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>
            */}
          </div>
        </div>
      </section>

      <section
        id="trending-research-home"
        className="hidden page-shell py-8 sm:py-10 lg:py-14"
      >
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <SectionIntro
            eyebrow="Trending Research"
            title={settings.trending_research_title}
            description={settings.trending_research_description}
          />
          <Link
            to="/trending-research"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0b6fa4]"
          >
            View all trending research
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {settings.trending_research.length ? (
            settings.trending_research.map((item) => (
              <Card key={item.title} className="surface-panel">
                <CardHeader>
                  <Badge className="w-fit bg-[#edf5f9] text-[#0b6fa4]">{item.area}</Badge>
                  <CardTitle className="display-card">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-slate-600">{item.summary}</p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="surface-panel lg:col-span-3">
              <CardContent className="p-8 text-sm leading-7 text-slate-600">
                Trending research themes will appear here once the administrator adds them.
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <section className="page-shell py-8 sm:py-10 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="surface-panel overflow-hidden">
            <CardHeader className="space-y-2 p-5 pb-2.5 sm:p-5 sm:pb-2.5">
              <Badge className="w-fit bg-white/90 text-[#0b6fa4]">Publishing overview</Badge>
              <CardTitle className="display-section text-slate-950">
                {settings.publishing_overview_title}
              </CardTitle>
              <CardDescription className="text-sm leading-6 text-slate-600">
                {settings.publishing_overview_description}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2.5 px-5 pb-5 pt-0 sm:px-5 sm:pb-5">
              {settings.scope.slice(0, 6).map((area) => (
                <div key={area} className="surface-muted flex items-center gap-2.5 px-3.5 py-2.5">
                  <Globe2 className="h-4 w-4 shrink-0 text-jostum-600" />
                  <p className="text-[13px] leading-5 text-slate-600">{area}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-none bg-[linear-gradient(140deg,rgba(20,56,78,0.98),rgba(11,111,164,0.94),rgba(31,107,92,0.95))] text-white shadow-editorial">
            <CardHeader className="space-y-2 p-5 pb-2.5 sm:p-5 sm:pb-2.5">
              <Badge className="w-fit border-white/20 bg-white/10 text-white">Workflow snapshot</Badge>
              <CardTitle className="display-section text-white">
                {settings.workflow_snapshot_title}
              </CardTitle>
              <CardDescription className="text-sm leading-6 text-slate-100/85">
                {settings.workflow_snapshot_description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 px-5 pb-5 pt-0 sm:px-5 sm:pb-5">
              {workflowStages.slice(0, 5).map((stage, index) => (
                <div
                  key={stage}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/6 px-3.5 py-2.5"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-xs font-semibold text-white">
                    {index + 1}
                  </div>
                  <p className="text-[13px] leading-5 text-slate-100">{stage}</p>
                </div>
              ))}
              <Link
                to="/workflow"
                className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-white"
              >
                View full workflow
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
      <HomepageAssistant settings={settings} />
    </SiteShell>
  )
}

function AboutPage() {
  const { sectionId } = useParams()
  const visibleSections = sectionId
    ? aboutSections.filter((section) => section.id === sectionId)
    : aboutSections

  if (sectionId && visibleSections.length === 0) {
    return <Navigate to="/about" replace />
  }

  return (
    <SiteShell>
      <section className="page-shell py-16">
        <SectionIntro
          eyebrow="About JASTI"
          title="Proposal foundation"
          description="A dedicated page for the journal's introduction, rationale, mission, and positioning."
        />
        <div className="mt-8 flex flex-wrap gap-3">
          {aboutSections.map((section) => (
            <Link
              key={section.id}
              to={`/about/${section.id}`}
              className={cn(
                buttonVariants({
                  variant: sectionId === section.id ? "default" : "outline",
                  size: "sm",
                })
              )}
            >
              {section.title}
            </Link>
          ))}
        </div>
        <div className={cn("mt-8 grid gap-6", sectionId ? "grid-cols-1" : "lg:grid-cols-2")}>
          {visibleSections.map((section) => (
            <Card id={section.id} key={section.id} className="surface-panel scroll-mt-28">
              <CardHeader>
                <CardTitle className="display-card">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-8 text-slate-600">
                    {paragraph}
                  </p>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </SiteShell>
  )
}

function ScopePage() {
  const { settings } = useJournalSettings()
  const effectiveAims = settings.aims.length > 0 ? settings.aims : aims
  const effectiveScope = settings.scope.length > 0 ? settings.scope : scopeAreas
  const effectiveObjectives = settings.objectives.length > 0 ? settings.objectives : aims

  return (
    <SiteShell>
      <section className="page-shell py-16">
        <SectionIntro
          eyebrow="Aims and Scope"
          title="Applied, interdisciplinary, and impact-driven"
          description="JASTI prioritizes practical relevance, methodological soundness, innovation, and measurable societal, industrial, or policy impact."
        />
        <div className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Card className="surface-panel">
            <CardHeader>
              <CardTitle className="display-card">Core aims</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {effectiveAims.map((aimItem) => (
                <div key={aimItem} className="surface-muted flex items-start gap-3 p-4">
                  <CheckCircle2 className="mt-1 h-5 w-5 text-jostum-600" />
                  <p className="text-sm leading-7 text-slate-700">{aimItem}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="surface-panel">
            <CardHeader>
              <CardTitle className="display-card">Thematic areas</CardTitle>
              <CardDescription>
                Original research, reviews, case studies, and technical notes are welcome.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {effectiveScope.map((area) => (
                <div key={area} className="surface-muted p-4 text-sm font-medium text-slate-700">
                  {area}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <Card className="surface-panel mt-6">
          <CardHeader>
            <CardTitle className="display-card">Objectives</CardTitle>
            <CardDescription>
              These objectives can be managed directly by the administrator in system settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {effectiveObjectives.map((objective) => (
              <div key={objective} className="surface-muted p-4 text-sm leading-7 text-slate-700">
                {objective}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </SiteShell>
  )
}

function GovernancePage() {
  return (
    <SiteShell>
      <section className="page-shell py-16">
        <SectionIntro
          eyebrow="Governance"
          title="Clear editorial roles and independence"
          description="JASTI adopts a focused governance structure that protects academic judgment from financial or administrative influence."
        />
        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {governanceRoles.map((role) => (
            <Card key={role.title} className="surface-panel h-full">
              <CardHeader>
                <CardTitle className="display-card">{role.title}</CardTitle>
                <CardDescription>{role.summary}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {role.responsibilities.map((item) => (
                  <div key={item} className="surface-muted p-4 text-sm leading-7 text-slate-600">
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </SiteShell>
  )
}

function WorkflowPage() {
  return (
    <SiteShell>
      <section className="page-shell py-16">
        <SectionIntro
          eyebrow="Digital Workflow"
          title="End-to-end manuscript lifecycle"
          description="The journal system is modeled around the full digital publishing sequence from submission to indexing and citation tracking."
        />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {workflowStages.map((stage, index) => (
            <div key={stage} className="surface-panel p-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-jostum-100 text-sm font-semibold text-jostum-800">
                {index + 1}
              </div>
              <p className="text-sm leading-7 text-slate-700">{stage}</p>
            </div>
          ))}
        </div>
      </section>
    </SiteShell>
  )
}

function TechnologyPage() {
  return (
    <SiteShell>
      <section className="page-shell py-16">
        <SectionIntro
          eyebrow="Modern Platform"
          title="Serious infrastructure for serious publishing"
          description="Advanced integrations and analytics support reviewer matching, integrity checks, DOI issuance, visibility, and editorial monitoring."
        />
        <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="surface-panel">
            <CardHeader>
              <CardTitle className="display-card">Advanced features</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {advancedFeatures.map((feature) => (
                <div key={feature} className="surface-muted flex items-start gap-3 p-4">
                  <BrainCircuit className="mt-1 h-5 w-5 text-jostum-600" />
                  <p className="text-sm leading-7 text-slate-700">{feature}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="overflow-hidden border-none bg-[linear-gradient(160deg,rgba(24,77,68,0.98),rgba(20,56,78,0.97))] text-white shadow-editorial">
            <CardHeader>
              <CardTitle className="display-card text-white">Implementation timeline</CardTitle>
              <CardDescription className="text-slate-200">
                A phased rollout designed for credibility before scale.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {publicationTimeline.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <FileSearch className="mt-1 h-5 w-5 text-jostum-100" />
                  <p className="text-sm leading-7 text-slate-100">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </SiteShell>
  )
}

function DiscoverOpenAccessPage() {
  const { settings } = useJournalSettings()

  return (
    <SiteShell>
      <section className="page-shell py-16">
        <SectionIntro
          eyebrow="Open Access"
          title={settings.discover_open_access_title}
          description={settings.discover_open_access_body}
        />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            {settings.discover_open_access_points.map((item) => (
              <div key={item} className="surface-panel p-5 text-sm leading-8 text-slate-600">
                {item}
              </div>
            ))}
          </div>
          <Card className="surface-panel overflow-hidden p-0">
            <div className="h-full min-h-[360px] bg-[linear-gradient(135deg,#d7eaf4,#f4f8fb)]">
              {settings.discover_open_access_image ? (
                <img
                  src={resolveVisual(settings.discover_open_access_image)}
                  alt={settings.discover_open_access_title}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
          </Card>
        </div>
      </section>
    </SiteShell>
  )
}

function PublishWithUsPage() {
  const { settings } = useJournalSettings()

  return (
    <SiteShell>
      <section className="page-shell py-16">
        <SectionIntro
          eyebrow="Publish with JASTI"
          title={settings.publish_with_us_title}
          description={settings.publish_with_us_body}
        />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card className="surface-panel">
            <CardHeader>
              <CardTitle className="display-card">Why publish here</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {settings.publish_with_us_points.map((item) => (
                <div key={item} className="surface-muted p-4 text-sm leading-7 text-slate-600">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="surface-panel overflow-hidden p-0">
            <div className="h-full min-h-[360px] bg-[linear-gradient(135deg,#d7eaf4,#f4f8fb)]">
              {settings.publish_with_us_image ? (
                <img
                  src={resolveVisual(settings.publish_with_us_image)}
                  alt={settings.publish_with_us_title}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
          </Card>
        </div>
      </section>
    </SiteShell>
  )
}

function CallForPapersPage() {
  const { settings } = useJournalSettings()
  const visibleCallForPapers = settings.call_for_papers.filter(
    (call) => call.title !== "Technology-driven climate and sustainability solutions"
  )

  return (
    <SiteShell>
      <section className="page-shell py-16">
        <SectionIntro
          eyebrow="Call for Papers"
          title={settings.call_for_papers_title}
          description={settings.call_for_papers_description}
        />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            {visibleCallForPapers.map((call) => (
              <Card key={`${call.title}-${call.deadline}`} className="surface-panel">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="display-card">{call.title}</CardTitle>
                    <Badge className="bg-[#edf5f9] text-[#0b6fa4]">Deadline: {call.deadline}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-slate-600">{call.summary}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-6">
            <Card className="overflow-hidden border-none bg-[linear-gradient(135deg,#14384e_0%,#184d44_100%)] text-white shadow-editorial">
              <CardHeader>
                <CardTitle className="display-section text-white">
                  {settings.call_for_papers_cta_title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-7 text-white/80">{settings.call_for_papers_cta_body}</p>
                <Link
                  to="/login/author"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Login to submit
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
            {/*
            <Card className="surface-panel">
              <CardHeader>
                <CardTitle className="display-card">Submission notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {settings.call_for_papers_notes.map((item) => (
                  <div key={item} className="surface-muted p-4 text-sm leading-7 text-slate-600">
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>
            */}
          </div>
        </div>
      </section>
    </SiteShell>
  )
}

function TrendingResearchPage() {
  const { settings } = useJournalSettings()

  return (
    <SiteShell>
      <section className="page-shell py-16">
        <SectionIntro
          eyebrow="Trending Research"
          title={settings.trending_research_title}
          description={settings.trending_research_description}
        />
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {settings.trending_research.map((item) => (
            <Card key={item.title} className="surface-panel">
              <CardHeader>
                <Badge className="w-fit bg-[#edf5f9] text-[#0b6fa4]">{item.area}</Badge>
                <CardTitle className="display-card">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-7 text-slate-600">{item.summary}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </SiteShell>
  )
}

function SearchResultsPage() {
  const { settings } = useJournalSettings()
  const [params] = useSearchParams()
  const query = params.get("q") ?? ""
  const entries = useSearchEntries(settings)
  const results = React.useMemo(() => filterEntries(entries, query), [entries, query])

  return (
    <SiteShell>
      <section className="page-shell py-16">
        <SectionIntro
          eyebrow="Search"
          title={`Results for "${query}"`}
          description="Search results from published JASTI articles, public pages, calls for papers, and research discovery sections."
        />
        <div className="mt-8">
          <SearchBox settings={settings} initialQuery={query} />
        </div>
        <div className="mt-8 space-y-4">
          {results.length ? (
            results.map((entry) => (
              <Link key={`${entry.category}-${entry.title}-${entry.to}`} to={entry.to} className="block">
                <Card className="surface-panel transition hover:-translate-y-0.5">
                  <CardContent className="p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0b6fa4]">
                      {entry.category}
                    </p>
                    <h3 className="display-card mt-2 text-slate-950">{entry.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{entry.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <Card className="surface-panel">
              <CardContent className="p-6 text-sm text-slate-600">No results matched your search.</CardContent>
            </Card>
          )}
        </div>
      </section>
    </SiteShell>
  )
}

function PrivacyPage() {
  return (
    <SiteShell>
      <section className="page-shell py-16">
        <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr]">
          <Card className="surface-panel-strong h-fit">
            <CardHeader>
              <Badge className="w-fit bg-[#edf5f9] text-[#0b6fa4]">Privacy</Badge>
              <CardTitle className="display-section text-slate-950">Privacy Policy</CardTitle>
              <CardDescription className="max-w-xl text-base leading-8">
                This page explains the small amount of browser storage the journal platform uses
                to run the site and remember your consent choice.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-7 text-slate-600">
              <p>
                JASTI uses session cookies to support authentication, consent cookies to remember
                whether you accepted or declined the banner, and browser storage for in-progress
                draft content where the dashboard needs it.
              </p>
              <p>
                We do not ask for more information than is needed to run journal workflows, manage
                accounts, and support manuscript submission and review.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="surface-panel">
              <CardHeader>
                <CardTitle className="display-card text-slate-950">What we store</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-slate-600">
                <p>
                  Essential session cookies help keep signed-in areas secure and maintain your
                  authenticated workspace.
                </p>
                <p>
                  A consent cookie records your accept or decline choice so the banner does not
                  reappear on every visit.
                </p>
                <p>
                  Some dashboard forms may use browser storage to preserve unsent draft content on
                  your device until you submit or clear it.
                </p>
              </CardContent>
            </Card>

            <Card className="surface-panel">
              <CardHeader>
                <CardTitle className="display-card text-slate-950">How to manage it</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-slate-600">
                <p>
                  You can clear stored cookies from your browser settings at any time. If you do,
                  the consent banner may appear again on your next visit.
                </p>
                <p>
                  If you clear local browser storage, any saved draft data that has not been
                  submitted may also be removed from that device.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link to="/" className={cn(buttonVariants({ variant: "outline" }))}>
                    Return home
                  </Link>
                  <Link to="/login/author" className={cn(buttonVariants())}>
                    Go to portal
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </SiteShell>
  )
}

function HomeEntry() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const verification = params.get("verification")
  const resetPassword = params.get("reset_password")
  const login = params.get("login")

  if (verification || resetPassword === "1") {
    const page =
      login === "editor"
        ? "editor_login"
        : login === "reviewer"
          ? "reviewer_login"
          : login === "admin"
            ? "admin_login"
            : "author_login"

    return <PortalApp onAuthenticated={() => Promise.resolve()} page={page} />
  }

  return <HomePage />
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomeEntry />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/about/:sectionId" element={<AboutPage />} />
        <Route path="/scope" element={<ScopePage />} />
        <Route path="/governance" element={<GovernancePage />} />
        <Route path="/workflow" element={<WorkflowPage />} />
        <Route path="/technology" element={<TechnologyPage />} />
        <Route path="/discover-open-access" element={<DiscoverOpenAccessPage />} />
        <Route path="/publish-with-us" element={<PublishWithUsPage />} />
        <Route path="/call-for-papers" element={<CallForPapersPage />} />
        <Route path="/trending-research" element={<TrendingResearchPage />} />
        <Route path="/publications" element={<PublicationsPage />} />
        <Route path="/researchers" element={<ResearchersPage />} />
        <Route path="/search" element={<SearchResultsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/articles/:articleId" element={<ArticleDetailPage />} />
        <Route path="/portal" element={<Navigate to="/login/author" replace />} />
        <Route path="/login/author" element={<PortalApp onAuthenticated={() => Promise.resolve()} page="author_login" />} />
        <Route path="/login/reviewer" element={<PortalApp onAuthenticated={() => Promise.resolve()} page="reviewer_login" />} />
        <Route path="/login/editor" element={<PortalApp onAuthenticated={() => Promise.resolve()} page="editor_login" />} />
        <Route path="/login/admin" element={<PortalApp onAuthenticated={() => Promise.resolve()} page="admin_login" />} />
        <Route path="/register/author" element={<PortalApp onAuthenticated={() => Promise.resolve()} page="author_registration" />} />
        <Route path="/register/reviewer" element={<PortalApp onAuthenticated={() => Promise.resolve()} page="reviewer_registration" />} />
        <Route path="/register/editor" element={<PortalApp onAuthenticated={() => Promise.resolve()} page="editor_registration" />} />
        <Route path="/dashboard" element={<AdminApp />} />
        <Route path="/campaign" element={<CampaignLandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CookieConsentBanner />
    </>
  )
}
