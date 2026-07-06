import * as React from "react"
import {
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  ChevronDown,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSearch,
  FileText,
  Globe2,
  Menu,
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
} from "@/data/ajastiContent"
import { useJournalSettings } from "@/hooks/useJournalSettings"
import {
  buildPublicArticleDownloadUrl,
  getFeaturedArticles,
  getPublicArticle,
  resolveApiAssetUrl,
  type FeaturedArticle,
  type JournalSettings,
  type PublicArticleDetail,
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

const headerLinks = [
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

const footerGroups = [
  {
    title: "Explore",
    links: [
      { to: "/", label: "Home" },
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
      { to: "/login/author", label: "Author Login" },
      { to: "/login/reviewer", label: "Reviewer Login" },
      { to: "/login/editor", label: "Editor Login" },
      { to: "/login/admin", label: "Admin Login" },
      { to: "/login/author", label: "Track Your Research" },
      { to: "/dashboard", label: "Dashboard" },
      { to: "/trending-research", label: "Trending Research" },
      { to: "/governance", label: "Editorial Roles" },
    ],
  },
]

const popularSearches = [
  "Open access",
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
}

const resolveVisual = (value?: string) => (value ? resolveApiAssetUrl(value) : "")

const buildSearchEntries = (settings: JournalSettings): SearchEntry[] => [
  { title: "Home", description: settings.homepage_intro, to: "/", category: "Overview" },
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

const filterEntries = (entries: SearchEntry[], query: string) => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []

  return entries.filter((entry) =>
    [entry.title, entry.description, entry.category].some((field) =>
      field.toLowerCase().includes(normalized)
    )
  )
}

const HERO_MAX_LINES = 3

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

function HeroHeadline({ children }: { children: string }) {
  const headingRef = React.useRef<HTMLHeadingElement | null>(null)

  React.useLayoutEffect(() => {
    const heading = headingRef.current
    if (!heading || typeof window === "undefined" || typeof document === "undefined") return

    let frame = 0
    let observer: ResizeObserver | null = null
    let cancelled = false

    const fitHeading = () => {
      const element = headingRef.current
      if (!element) return

      element.style.removeProperty("--hero-display-size")

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

      let low = Math.min(fitMinSize, baseSize)
      let high = baseSize
      let best = low

      for (let index = 0; index < 14; index += 1) {
        const mid = (low + high) / 2
        element.style.setProperty("--hero-display-size", `${mid}px`)

        const currentStyles = getComputedStyle(element)
        const lineHeight = Number.parseFloat(currentStyles.lineHeight) || mid * 1.02
        const allowedHeight = lineHeight * HERO_MAX_LINES + 1
        const fits = element.scrollHeight <= allowedHeight

        if (fits) {
          best = mid
          low = mid
        } else {
          high = mid
        }
      }

      element.style.setProperty("--hero-display-size", `${best}px`)
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
      if (heading.parentElement) observer.observe(heading.parentElement)
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", scheduleFit)
      observer?.disconnect()
    }
  }, [children])

  return (
    <h1 ref={headingRef} className="display-hero mt-5 max-w-4xl text-balance text-slate-950 sm:mt-6">
      {children}
    </h1>
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
}: {
  settings: JournalSettings
  compact?: boolean
  inlineResults?: boolean
}) {
  const navigate = useNavigate()
  const entries = React.useMemo(() => buildSearchEntries(settings), [settings])
  const [query, setQuery] = React.useState("")
  const matches = React.useMemo(() => filterEntries(entries, query).slice(0, 6), [entries, query])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    navigate(`/search?q=${encodeURIComponent(query)}`)
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
      <Card className="surface-panel-strong h-full overflow-hidden border-white/80 shadow-[0_22px_48px_rgba(15,23,42,0.1)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_56px_rgba(15,23,42,0.14)]">
        <div className="relative h-56 overflow-hidden bg-[linear-gradient(135deg,#d7eaf4,#f3f6f9)] sm:h-60 lg:h-64">
          {resolved ? (
            <img
              src={resolved}
              alt={title}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-transparent" />
          <div className="absolute left-5 top-5">
            <Badge className="border border-[#a7ddd8] bg-white/96 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0b6fa4] shadow-[0_8px_18px_rgba(11,111,164,0.08)]">
              JASTI feature
            </Badge>
          </div>
        </div>
        <CardContent className="space-y-4 border-t border-slate-100/80 px-6 pb-6 pt-5 sm:px-7 sm:pb-7 sm:pt-6">
          <div className="space-y-3">
            <h3 className="display-card text-slate-950">{title}</h3>
            <p className="text-sm leading-8 text-slate-600">{body}</p>
          </div>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#0b6fa4]">
            Open page
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
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
}: {
  articles: FeaturedArticle[]
  title: string
  description: string
}) {
  return (
    <section className="page-shell py-8 sm:py-10 lg:py-14">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <SectionIntro eyebrow="Featured Articles" title={title} description={description} />
        <Link
          to="/trending-research"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#0b6fa4]"
        >
          Explore research trends
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
                      <span className="text-[11px] font-semibold tracking-normal text-slate-900 sm:text-[12px]">
                        {article.downloads}
                      </span>
                      <span className="ml-1 text-[10px] tracking-[0.08em] sm:ml-1.5 sm:text-[11px]">Downloads</span>
                    </Badge>
                    <Badge
                      variant="outline"
                      className="min-w-0 justify-center whitespace-nowrap border-slate-200/90 bg-white/85 px-2 py-1.5 text-slate-500"
                    >
                      <span className="text-[11px] font-semibold tracking-normal text-slate-900 sm:text-[12px]">
                        {article.citations}
                      </span>
                      <span className="ml-1 text-[10px] tracking-[0.08em] sm:ml-1.5 sm:text-[11px]">Citations</span>
                    </Badge>
                    <Badge
                      variant="outline"
                      className="min-w-0 justify-center whitespace-nowrap border-slate-200/90 bg-white/85 px-2 py-1.5 text-[10px] font-semibold tracking-normal text-slate-900 sm:text-[12px]"
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
            <h1 className="mt-6 max-w-5xl font-display text-[clamp(2.15rem,4.2vw,4.2rem)] leading-[1.06] tracking-[-0.03em] text-slate-950">
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
              <CardContent className="text-[15px] leading-8 text-slate-700">
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
                <p>
                  <span className="font-semibold text-slate-900">Altmetric score:</span>{" "}
                  {article.altmetric_score}
                </p>
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
        <div className="page-shell flex flex-col gap-3 py-5 text-sm text-white/60 lg:flex-row lg:items-center lg:justify-between">
          <p>
            {new Date().getFullYear()} {settings.journal_acronym}. {settings.footer_bottom_text}
          </p>
          <p>{settings.footer_bottom_tagline}</p>
        </div>
      </div>
    </footer>
  )
}

function SiteShell({ children }: { children: React.ReactNode }) {
  const { settings } = useJournalSettings()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
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

  React.useEffect(() => {
    setMobileMenuOpen(false)
    setExpandedMobileGroup(activeMobileGroup)
  }, [location.pathname, activeMobileGroup])

  return (
    <div className="relative min-h-screen overflow-x-clip text-slate-900">
      <div className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top,rgba(11,111,164,0.12),transparent_46%),radial-gradient(circle_at_top_left,rgba(31,107,92,0.16),transparent_28%)]" />
      <header className="sticky top-0 z-50 border-b border-white/60 bg-[rgba(248,250,252,0.76)] backdrop-blur-xl">
        <div className="border-b border-white/20 bg-[linear-gradient(90deg,#14384e_0%,#184d44_100%)] text-white">
          <div className="page-shell flex items-center justify-between gap-3 py-2.5 text-[11px] sm:text-xs">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 font-semibold uppercase tracking-[0.22em] text-white/95">
                {effectiveAcronym}
              </span>
              <span className="hidden truncate text-white/70 md:inline">
                {settings.home_topbar_text || "Applied research, editorial quality, and author visibility."}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/login/author"
                className="inline-flex shrink-0 items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-white/15"
              >
                Track your research
              </Link>
            </div>
          </div>
        </div>
        <div className="page-shell flex items-center gap-3 py-3 sm:gap-4 sm:py-4">
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[1.1rem] border border-white/80 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.1)] sm:h-14 sm:w-14 sm:rounded-2xl">
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
            <div className="min-w-0">
              <div className="flex items-end gap-2">
                <p className="display-acronym text-[1.45rem] text-[#14384e] sm:text-[30px]">{effectiveAcronym}</p>
                <span className="hidden rounded-full border border-slate-200 bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0b6fa4] sm:inline-flex">
                  Research journal
                </span>
              </div>
              <p className="mt-1 hidden max-w-[30rem] text-[10px] font-semibold uppercase leading-[1.55] tracking-[0.2em] text-slate-500 md:block lg:max-w-[36rem] lg:text-[11px] xl:max-w-[42rem]">
                {effectiveName}
              </p>
            </div>
          </Link>

          <div className="hidden flex-1 lg:block">
            <div className="mx-auto max-w-xl">
              <SearchBox settings={settings} compact />
            </div>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <Link to="/login/author" className={cn(buttonVariants({ variant: "outline" }))}>
              Login
            </Link>
            <Link to="/dashboard" className={cn(buttonVariants({ size: "lg" }))}>
              Dashboard
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((current) => !current)}
            className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-white/70 bg-white/88 text-slate-700 shadow-sm lg:hidden"
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <div className="hidden border-t border-slate-200/70 lg:block">
          <div className="page-shell flex items-center gap-3 py-3">
            {headerLinks.map((item) => (
              <div key={item.to} className="group relative">
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex items-center rounded-full px-4 py-2.5 text-sm font-semibold transition",
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

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Link to="/login/author" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
                      Login
                    </Link>
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
      <Toaster position="top-right" />
    </div>
  )
}

function HomePage() {
  const { settings } = useJournalSettings()
  const [featuredArticles, setFeaturedArticles] = React.useState<FeaturedArticle[]>([])
  const visibleCallForPapers = settings.call_for_papers.filter(
    (call) => call.title !== "Technology-driven climate and sustainability solutions"
  )

  React.useEffect(() => {
    void getFeaturedArticles()
      .then((response) => setFeaturedArticles(response.articles))
      .catch(() => setFeaturedArticles([]))
  }, [])

  return (
    <SiteShell>
      <section className="page-shell py-8 sm:py-10 lg:py-14">
        <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1.12fr_0.88fr]">
          <div className="surface-panel-strong relative overflow-hidden p-6 sm:p-10 lg:p-12">
            <div className="absolute right-[-6rem] top-[-4rem] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(48,169,215,0.24),transparent_70%)] blur-3xl" />
            <div className="absolute bottom-[-5rem] left-[-3rem] h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(31,107,92,0.18),transparent_68%)] blur-3xl" />
            <div className="relative">
              <span className="eyebrow">Home for rigorous research</span>
              <HeroHeadline>{settings.homepage_tagline}</HeroHeadline>
              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:mt-6 sm:text-lg lg:text-[1.28rem]">
                {settings.homepage_intro}
              </p>
              <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
                <Link to="/call-for-papers" className={cn(buttonVariants({ size: "lg" }), "w-full justify-center sm:w-auto")}>
                  View call for papers
                </Link>
                <Link to="/login/author" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full justify-center sm:w-auto")}>
                  Login to track your research
                </Link>
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
      />

      <section className="page-shell py-8 sm:py-10 lg:py-14">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <SectionIntro
            eyebrow="Discover"
            title={settings.research_pathways_title}
            description="Three core pathways organize the JASTI experience: public publishing information, author guidance, and research visibility."
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
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

      <section className="page-shell py-8 sm:py-10 lg:py-14">
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
                  to="/login/author"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Login to track your research
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

      <section className="page-shell py-8 sm:py-10 lg:py-14">
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
            <CardHeader>
              <Badge className="w-fit bg-white/90 text-[#0b6fa4]">Publishing overview</Badge>
              <CardTitle className="display-section text-slate-950">
                {settings.publishing_overview_title}
              </CardTitle>
              <CardDescription className="text-base leading-8">
                {settings.publishing_overview_description}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {settings.scope.slice(0, 6).map((area) => (
                <div key={area} className="surface-muted flex items-start gap-3 p-4">
                  <Globe2 className="mt-1 h-5 w-5 text-jostum-600" />
                  <p className="text-sm leading-7 text-slate-600">{area}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-none bg-[linear-gradient(140deg,rgba(20,56,78,0.98),rgba(11,111,164,0.94),rgba(31,107,92,0.95))] text-white shadow-editorial">
            <CardHeader>
              <Badge className="w-fit border-white/20 bg-white/10 text-white">Workflow snapshot</Badge>
              <CardTitle className="display-section text-white">
                {settings.workflow_snapshot_title}
              </CardTitle>
              <CardDescription className="text-base leading-8 text-slate-100/85">
                {settings.workflow_snapshot_description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {workflowStages.slice(0, 5).map((stage, index) => (
                <div
                  key={stage}
                  className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/6 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/12 text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-7 text-slate-100">{stage}</p>
                </div>
              ))}
              <Link
                to="/workflow"
                className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-white"
              >
                View full workflow
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
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
  const results = React.useMemo(() => filterEntries(buildSearchEntries(settings), query), [settings, query])

  return (
    <SiteShell>
      <section className="page-shell py-16">
        <SectionIntro
          eyebrow="Search"
          title={`Results for "${query}"`}
          description="Search results from JASTI public content, calls for papers, and research discovery sections."
        />
        <div className="mt-8">
          <SearchBox settings={settings} />
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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
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
      <Route path="/search" element={<SearchResultsPage />} />
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
  )
}
