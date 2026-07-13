import * as React from "react"
import { isAxiosError } from "axios"
import { Archive, BarChart3, BookMarked, BookOpenText, CheckCircle2, CheckSquare, ChevronDown, FileClock, FileText, Globe2, LayoutDashboard, LogOut, Mail, Menu, Microscope, Pencil, Plus, Settings2, ShieldCheck, Trash2, Upload, User, UserCog, Users, Workflow, X } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { createPortal } from "react-dom"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { workspaceConfigs } from "@/data/dashboardModules"
import { scopeAreas } from "@/data/jastiContent"
import { useCountryOptions } from "@/hooks/useCountryOptions"
import { applyJournalBranding, normalizeJournalSettings } from "@/hooks/useJournalSettings"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Toaster } from "@/components/ui/sonner"
import { Textarea } from "@/components/ui/textarea"
import ApplicationsReview from "@/admin/components/ApplicationsReview"
import { ManuscriptFileBundlePreview, parseManuscriptFileBundle } from "@/components/ManuscriptFilePreview"
import {
  claimAssignment,
  createAdminUser,
  decideTechnicalScreening,
  deletePublication,
  deleteAdminUser,
  editAdminUser,
  getAdminIntegrations,
  getPublicSettings,
  getWorkspace,
  initializePaystackPayment,
  inviteReviewer,
  logoutAccount,
  manageIssues,
  archivePublication,
  publishManuscript,
  recordEditorDecision,
  recordFinalDecision,
  reviewPaymentReceipt,
  resendVerificationEmail,
  respondToInvitation,
  resolveApiAssetUrl,
  sendPaymentReminder,
  sendMessage,
  submitManuscript,
  submitTechnicalScreening,
  submitPayment,
  submitCopyrightForm,
  submitRevision,
  submitReview,
  uploadProductionPdf,
  type AuthUser,
  type AdminIntegrationsSettings,
  type JournalSettings,
  type WorkspacePayload,
  updateAdminSettings,
  updateAdminIntegrations,
  updateManuscriptPlagiarismScore,
  updatePublication,
  updateEditorProfile,
  updateProfile,
  updateReviewerProfile,
  updateUserAccess,
  uploadJournalLogo,
  verifyPaystackPayment,
  buildReportDownloadUrl,
} from "@/lib/journalApi"
import { cn } from "@/lib/utils"
import * as pdfjs from "pdfjs-dist/legacy/build/pdf"
import pdfWorkerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.js?url"

const roleIcons: Record<string, LucideIcon> = {
  author: BookOpenText,
  reviewer: Microscope,
  editor: FileClock,
  managing_editor: FileClock,
  section_editor: FileClock,
  technical_editor: FileClock,
  advisory_board: FileClock,
  editor_in_chief: BookMarked,
  admin: UserCog,
}
const roleLabels: Record<string, string> = {
  author: "Author",
  reviewer: "Reviewer",
  editor: "Editor",
  managing_editor: "Managing Editor",
  section_editor: "Section Editor",
  technical_editor: "Technical Editor",
  advisory_board: "Advisory Board",
  editor_in_chief: "Editor-in-Chief",
  admin: "Admin",
}
const userRoleOptions = [
  { value: "author", label: "Author" },
  { value: "reviewer", label: "Reviewer" },
  { value: "editor", label: "Editor" },
  { value: "managing_editor", label: "Managing Editor" },
  { value: "section_editor", label: "Section Editor" },
  { value: "technical_editor", label: "Technical Editor" },
  { value: "advisory_board", label: "Advisory Board" },
  { value: "editor_in_chief", label: "Editor-in-Chief" },
  { value: "admin", label: "Admin" },
] as const
const editorWorkspaceRoles = new Set(["editor", "managing_editor", "section_editor", "technical_editor", "advisory_board"])
const hasEditorWorkspaceRole = (roles: unknown) =>
  Array.isArray(roles) && roles.some((role) => editorWorkspaceRoles.has(String(role)))
const resolveWorkspaceRole = (role: string) => (role === "technical_editor" ? "technical_editor" : editorWorkspaceRoles.has(role) ? "editor" : role)
const hasProfileValue = (value: unknown) => String(value ?? "").trim() !== ""
const roleDefaultSections: Record<string, string> = {
  author: "submission",
  reviewer: "invitations",
  editor: "selection",
  technical_editor: "technical-screening",
}
const needsProfileCompletion = (user?: AuthUser | null) => {
  if (!user) return false
  const firstLogin = !hasProfileValue(user.last_login)
  if (!firstLogin) return false
  return !hasProfileValue(user.institution) || !hasProfileValue(user.country) || !hasProfileValue(user.phone)
}
const resolveLogoutRedirect = (role: string) => {
  if (role === "author") return "/login/author"
  if (role === "reviewer") return "/login/reviewer"
  if (role === "admin") return "/login/admin"
  if (role === "editor_in_chief" || editorWorkspaceRoles.has(role)) return "/login/editor"
  return "/login/author"
}
const fallbackSettings: JournalSettings = { journal_name: "Journal of Applied Science, Technology, and Innovation", journal_acronym: "JASTI", logo_path: "", homepage_tagline: "Building a rigorous African journal platform for applied research.", homepage_intro: "Home for multidisciplinary research, applied scholarship, editorial quality, and publication visibility across science, technology, and innovation.", home_topbar_text: "Home for all research in applied science, technology, and innovation", featured_articles_title: "Recently published research", featured_articles_description: "Peer-reviewed articles and manuscripts published through the JASTI editorial workflow.", research_pathways_title: "Research publishing pathways", call_for_papers_title: "Submission deadlines and current opportunities", call_for_papers_description: "Calls for papers are published here by the administrator and provide issue opportunities for authors across JASTI thematic areas.", call_for_papers_cta_title: "Login and submit", call_for_papers_cta_body: "Use the JASTI portal to log in, prepare your manuscript, and submit within the relevant deadline window.", call_for_papers_notes: [], trending_research_title: "Current topics across applied scholarship", trending_research_description: "Highlighted research areas help readers, authors, and editors identify emerging themes across applied science, technology, and innovation.", publishing_overview_title: "Editorial quality and practical relevance", publishing_overview_description: "JASTI prioritizes methodological soundness, publication ethics, applied relevance, and multidisciplinary integration across research contexts.", workflow_snapshot_title: "From submission to publication", workflow_snapshot_description: "The journal system is modeled around the full digital publishing sequence from submission to indexing and citation tracking.", discover_open_access_title: "Discover Open Access", discover_open_access_body: "Explore open and accessible research pathways, publication ethics, visibility strategies, and the role of open scholarship in applied knowledge exchange.", discover_open_access_image: "/images/discover-open-access.jpg", discover_open_access_points: [], publish_with_us_title: "Publish with Us", publish_with_us_body: "Learn how JASTI supports authors through submission, peer review, revision, production planning, and publication-ready editorial workflows.", publish_with_us_image: "/images/publish-with-us.jpg", publish_with_us_points: [], track_research_title: "Track Your Research", track_research_body: "Monitor submissions, revisions, editorial decisions, downloads, citations, DOI progress, and journal communication through the JASTI portal.", track_research_image: "/images/track-your-research.jpg", call_for_papers: [], trending_research: [], aims: [], scope: [], objectives: [], review_specializations: [], footer_summary: "Home for multidisciplinary research, applied scholarship, editorial quality, and publication visibility across science, technology, and innovation.", footer_bottom_text: "Journal publishing, peer review, and research visibility.", footer_bottom_tagline: "Applied science. Technology. Innovation.", whatsapp_number: "", default_gq_percent: "0", default_ai_score_percent: "0", default_similarity_percent: "0", submission_fee_ngn: "10000", publication_fee_ngn: "50000" }
const asArray = (value: unknown) => Array.isArray(value) ? value as Array<Record<string, unknown>> : []
const manuscriptPaymentBaseAmount = 50000
const manuscriptPaymentIncludedPages = 10
const manuscriptPaymentExtraPageRate = 1000
const nairaAmountFormatter = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 })

if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc
}

function formatNairaAmount(value: number) {
  return `₦${nairaAmountFormatter.format(Math.max(0, Math.round(value)))}`
}

function numericSetting(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback
}

function calculateManuscriptPaymentAmount(totalPages: number) {
  const extraPages = Math.max(0, Math.ceil(totalPages) - manuscriptPaymentIncludedPages)
  return manuscriptPaymentBaseAmount + (extraPages * manuscriptPaymentExtraPageRate)
}

function countPagesFromPageNumbers(value: unknown) {
  const pageNumbers = String(value ?? "").trim()
  if (!pageNumbers) return 0

  const rangeMatch = pageNumbers.match(/(\d+)\s*-\s*(\d+)/)
  if (rangeMatch) {
    const start = Number(rangeMatch[1])
    const end = Number(rangeMatch[2])
    if (Number.isFinite(start) && Number.isFinite(end) && start > 0 && end >= start) {
      return end - start + 1
    }
  }

  const singleMatch = pageNumbers.match(/\d+/)
  return singleMatch ? Number(singleMatch[0]) : 0
}

function resolvePaymentManuscriptEntry(fileBundle: unknown) {
  const entries = parseManuscriptFileBundle(fileBundle)
  const publicationPdfEntry = entries.find((entry) => {
    const label = entry.label.toLowerCase()
    return entry.extension === "pdf" && (label.includes("publication_pdf") || label.includes("publication pdf"))
  })
  if (publicationPdfEntry) return publicationPdfEntry

  const manuscriptEntry = entries.find((entry) => {
    const label = entry.label.toLowerCase()
    return entry.extension === "pdf" && (label.includes("revised_manuscript") || label.includes("manuscript"))
  })
  return manuscriptEntry ?? entries.find((entry) => entry.extension === "pdf") ?? entries[0] ?? null
}

async function countPdfPagesFromUrl(url: string) {
  const candidateUrls = [url]

  try {
    const parsedUrl = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost")
    const apiUploadsMarker = "/api/uploads/"
    const uploadsMarker = "/uploads/"

    if (parsedUrl.pathname.includes(apiUploadsMarker)) {
      candidateUrls.push(parsedUrl.toString().replace(apiUploadsMarker, uploadsMarker))
    } else if (parsedUrl.pathname.includes(uploadsMarker)) {
      candidateUrls.push(parsedUrl.toString().replace(uploadsMarker, apiUploadsMarker))
    }
  } catch {
  }

  let lastStatus: number | null = null
  let lastError: unknown = null

  for (const candidateUrl of [...new Set(candidateUrls)]) {
    try {
      const response = await fetch(candidateUrl, { credentials: "include" })
      if (!response.ok) {
        lastStatus = response.status
        continue
      }

      const arrayBuffer = await response.arrayBuffer()
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) })
      const pdf = await loadingTask.promise
      const pageCount = Number(pdf.numPages || 0)
      await pdf.destroy()
      return pageCount
    } catch (error) {
      lastError = error
    }
  }

  if (lastError instanceof Error && lastError.message) {
    throw lastError
  }

  throw new Error(`Unable to load PDF (${lastStatus ?? 404}).`)
}
const asRecord = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
const sectionIconMap: Record<string, LucideIcon> = {
  profile: LayoutDashboard,
  submission: FileText,
  applications: FileText,
  compliance: CheckSquare,
  tracker: Workflow,
  revision: Upload,
  communication: Mail,
  metrics: BarChart3,
  invitations: Users,
  assigned: BookOpenText,
  evaluation: Microscope,
  recommendation: CheckSquare,
  comments: Mail,
  deadlines: Workflow,
  assignments: FileText,
  screening: ShieldCheck,
  selection: Microscope,
  monitoring: BarChart3,
  decisions: FileClock,
  analytics: BarChart3,
  overview: BookMarked,
  "final-decisions": FileClock,
  "published-articles": BookMarked,
  "view-submitted-articles": FileText,
  board: Users,
  ethics: ShieldCheck,
  impact: Globe2,
  scheduling: BookMarked,
  "manage-issues": BookMarked,
  users: Users,
  settings: Settings2,
  integrations: Settings2,
}
function RoleIcon({ role, className }: { role: string; className?: string }) {
  const Icon = roleIcons[role] ?? BarChart3
  return <Icon className={className} />
}
function SectionIcon({ sectionId, className }: { sectionId: string; className?: string }) {
  const Icon = sectionIconMap[sectionId] ?? ShieldCheck
  return <Icon className={className} />
}
function CardHeading({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return <div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(11,111,164,0.14),rgba(31,107,92,0.18))] text-jostum-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">{icon}</div><div className="space-y-1">{description ? <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{description}</CardDescription> : null}<CardTitle className="font-display text-2xl leading-[1.08] tracking-[-0.03em] sm:text-[2rem]">{title}</CardTitle></div></div>
}
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const MANUSCRIPT_ABSTRACT_WORD_LIMIT = 400
const MANUSCRIPT_KEYWORD_WORD_LIMIT = 20
const SUBMISSION_SCREENING_PAYMENT_AMOUNT = 10000
const manuscriptArticleTypeOptions = ["Original Research Article", "Case Studies", "Review", "Conference", "Short Communication", "Technical Note"] as const
const reviewCriteria = [
  { key: "score_novelty", label: "Originality/Novelty" },
  { key: "score_relevance", label: "Relevance to Journal Scope" },
  { key: "score_technical_quality", label: "Technical Quality" },
  { key: "score_methodology", label: "Methodology" },
  { key: "score_literature_review", label: "Literature Review" },
  { key: "score_data_analysis", label: "Data Analysis" },
  { key: "score_clarity", label: "Clarity of Presentation" },
  { key: "score_grammar_language", label: "Grammar and Language" },
  { key: "score_references_quality", label: "References Quality" },
  { key: "score_ethical_compliance", label: "Ethical Compliance" },
  { key: "score_contribution", label: "Practical/Scientific Contribution" },
] as const
const reviewModelLabels: Record<string, string> = {
  single_blind: "Single blind",
  double_blind: "Double blind",
  open_review: "Open review",
}
const reviewerDecisionOptions = [
  { value: "accept", label: "Accept" },
  { value: "minor_revision", label: "Accept with Minor Revisions" },
  { value: "major_revision", label: "Major Revisions Required" },
  { value: "reject", label: "Reject" },
  { value: "resubmit_new_review", label: "Resubmit for New Review" },
] as const
function tokenizeMatchText(value: unknown) {
  const stopWords = new Set(["and", "the", "for", "with", "from", "into", "using", "based", "study", "analysis", "effect", "effects", "of", "in", "on", "to", "a", "an"])
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token))
}

function reviewerMatchAccuracy(manuscript: Record<string, unknown> | null, reviewer: Record<string, unknown>) {
  if (!manuscript) return 0
  const manuscriptTokens = new Set(tokenizeMatchText(`${String(manuscript.title ?? "")} ${String(manuscript.keywords ?? "")} ${String(manuscript.abstract ?? "")}`))
  if (manuscriptTokens.size === 0) return 0
  let specializationText = `${String(reviewer.expertise_area ?? "")} `
  const rawSpecializations = reviewer.specializations_json
  if (typeof rawSpecializations === "string") {
    try {
      specializationText += (JSON.parse(rawSpecializations) as string[]).join(" ")
    } catch {
      specializationText += rawSpecializations
    }
  }
  const reviewerTokens = new Set(tokenizeMatchText(specializationText))
  const matches = [...manuscriptTokens].filter((token) => reviewerTokens.has(token)).length
  const base = Math.round((matches / Math.max(3, manuscriptTokens.size)) * 100)
  const availabilityBoost = String(reviewer.availability_status ?? "") === "available" ? 8 : 0
  const experienceBoost = Math.min(12, Math.floor(Number(reviewer.completed_reviews ?? reviewer.total_reviews ?? 0) / 2))
  return Math.max(0, Math.min(99, base + availabilityBoost + experienceBoost))
}
const emptySubmissionFieldErrors = {
  title: "",
  scope_area: "",
  abstract: "",
  keywords: "",
  article_type: "",
}
type SubmissionContributor = {
  author_name: string
  author_email: string
  affiliation: string
}
type SubmissionSuccessState = {
  title: string
  reference_number: string
  submitted_at: string
  author_list: string[]
}
type SubmissionDraft = {
  title: string
  scope_area: string
  abstract: string
  keywords: string
  article_type: string
  contributors: SubmissionContributor[]
  manuscript_file_name: string
  supplementary_file_name: string
  saved_at: string
}
type SubmissionDraftFileNames = {
  manuscript_file: string
  supplementary_file: string
}
function createEmptySubmission() {
  return { title: "", scope_area: "", abstract: "", keywords: "", article_type: "", plagiarism_score: "", manuscript_file: null as File | null, supplementary_file: null as File | null }
}
function createEmptyContributor(): SubmissionContributor {
  return { author_name: "", author_email: "", affiliation: "" }
}
function normalizeContributorDraft(value: unknown): SubmissionContributor {
  const contributor = value && typeof value === "object" ? value as Partial<SubmissionContributor> : {}
  return {
    author_name: String(contributor.author_name ?? ""),
    author_email: String(contributor.author_email ?? ""),
    affiliation: String(contributor.affiliation ?? ""),
  }
}
function restoreContributorDrafts(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.map(normalizeContributorDraft).filter(hasContributorContent)
}
function hasContributorContent(contributor: SubmissionContributor) {
  return contributor.author_name.trim() !== "" || contributor.author_email.trim() !== "" || contributor.affiliation.trim() !== ""
}
function createEmptySubmissionDraftFiles(): SubmissionDraftFileNames {
  return { manuscript_file: "", supplementary_file: "" }
}
function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim())
}
function contributorSubmissionError(contributor: SubmissionContributor) {
  if (!hasContributorContent(contributor)) return ""
  if (contributor.author_name.trim() === "") return "Enter the contributor's full name or remove this row."
  if (contributor.author_email.trim() !== "" && !isValidEmailAddress(contributor.author_email)) {
    return "Enter a valid contributor email address or leave it blank."
  }
  return ""
}
function formatSavedTimestamp(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString()
}
function hasSubmissionDraftContent(
  submission: ReturnType<typeof createEmptySubmission>,
  contributors: SubmissionContributor[],
  savedDraftFiles?: SubmissionDraftFileNames,
) {
  return submission.title.trim() !== ""
    || submission.abstract.trim() !== ""
    || submission.scope_area.trim() !== ""
    || submission.keywords.trim() !== ""
    || submission.article_type.trim() !== ""
    || submission.manuscript_file !== null
    || submission.supplementary_file !== null
    || contributors.some(hasContributorContent)
    || Boolean(savedDraftFiles?.manuscript_file)
    || Boolean(savedDraftFiles?.supplementary_file)
}
const mimeExtensionFallback: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/zip": ["zip"],
  "application/x-zip-compressed": ["zip"],
  "text/csv": ["csv"],
  "text/plain": ["txt", "tex"],
  "text/x-tex": ["tex"],
  "application/x-tex": ["tex"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
}
function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
}
function validateUploadFile(file: File, allowedMimeTypes: string[], label: string, maxBytes = MAX_UPLOAD_BYTES) {
  const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "" : ""
  const mimeAllowed = file.type ? allowedMimeTypes.includes(file.type) : false
  const extensionAllowed = extension !== "" && allowedMimeTypes.some((mimeType) => (mimeExtensionFallback[mimeType] ?? []).includes(extension))
  if (!mimeAllowed && !extensionAllowed) {
    return `${label} must match one of the allowed file types.`
  }
  if (file.size > maxBytes) {
    return `${label} must be ${(maxBytes / (1024 * 1024)).toFixed(0)}MB or smaller.`
  }
  return ""
}
function countWords(value: string) {
  return value.trim() === "" ? 0 : value.trim().split(/\s+/u).filter(Boolean).length
}
function titleSubmissionError(value: string, enforceRequired = false) {
  return enforceRequired && value.trim() === "" ? "Title is required." : ""
}
function articleTypeSubmissionError(value: string, enforceRequired = false) {
  return enforceRequired && value.trim() === "" ? "Article type is required." : ""
}
function scopeAreaSubmissionError(value: string, enforceRequired = false) {
  const trimmed = value.trim()
  if (trimmed === "") return enforceRequired ? "Scope area is required." : ""
  return scopeAreas.includes(trimmed) ? "" : "Select a valid scope area."
}
function abstractSubmissionError(value: string, enforceRequired = false) {
  const trimmed = value.trim()
  if (trimmed === "") return enforceRequired ? "Abstract is required." : ""
  if (countWords(trimmed) > MANUSCRIPT_ABSTRACT_WORD_LIMIT) {
    return `Abstract cannot exceed ${MANUSCRIPT_ABSTRACT_WORD_LIMIT} words.`
  }
  return ""
}
function keywordSubmissionError(value: string, enforceRequired = false) {
  const trimmed = value.trim()
  if (trimmed === "") return enforceRequired ? "Keywords are required." : ""
  if (countWords(trimmed) > MANUSCRIPT_KEYWORD_WORD_LIMIT) {
    return `Keywords cannot exceed ${MANUSCRIPT_KEYWORD_WORD_LIMIT} words.`
  }
  return ""
}
function plagiarismProviderLabel(provider?: string) {
  if (provider === "copyleaks") return "Copyleaks"
  if (provider === "local_archive") return "JASTI archive"
  return provider ? provider.replaceAll("_", " ") : "Plagiarism scanner"
}

function plagiarismStatusLabel(status?: string) {
  const normalized = String(status ?? "pending").toLowerCase()
  const labels: Record<string, string> = {
    pending: "Pending",
    queued: "Queued",
    submitted: "Submitted",
    creditschecked: "Credits Checked",
    credits_checked: "Credits Checked",
    indexed: "Indexed",
    completed: "Completed",
    error: "Error",
  }
  return labels[normalized] ?? normalized.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())
}

function PlagiarismStatusBadge({ status }: { status?: string }) {
  const normalized = String(status ?? "pending").toLowerCase()
  const styles: Record<string, string> = {
    pending: "bg-slate-100 text-slate-700",
    queued: "bg-amber-100 text-amber-800",
    submitted: "bg-blue-100 text-blue-800",
    creditschecked: "bg-indigo-100 text-indigo-800",
    credits_checked: "bg-indigo-100 text-indigo-800",
    indexed: "bg-cyan-100 text-cyan-800",
    completed: "bg-emerald-100 text-emerald-800",
    error: "bg-red-100 text-red-700",
  }
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", styles[normalized] ?? styles.pending)}>{plagiarismStatusLabel(normalized)}</span>
}
function FileDropzone({
  label,
  file,
  error,
  accept,
  helperText,
  progress,
  progressLabel,
  required,
  onFileSelect,
  onRemove,
}: {
  label: string
  file: File | null
  error?: string
  accept: string
  helperText: string
  progress?: number
  progressLabel?: string
  required?: boolean
  onFileSelect: (file: File | null) => void
  onRemove: () => void
}) {
  const [dragging, setDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const handleFile = (selectedFile: File | null) => onFileSelect(selectedFile)
  return <div className="space-y-2">
    <Label>
      {label}
      {required ? <span className="ml-1 text-red-500">*</span> : null}
    </Label>
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        handleFile(event.dataTransfer.files?.[0] ?? null)
      }}
      className={cn(
        "rounded-[1.5rem] border border-dashed bg-white/90 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_12px_30px_rgba(15,23,42,0.05)] backdrop-blur transition",
        dragging ? "border-jostum-500 bg-jostum-50/90" : "border-slate-300/90 hover:border-jostum-400 hover:bg-white",
        error ? "border-red-300 bg-red-50/70" : "",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        aria-label={label}
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(11,111,164,0.14),rgba(31,107,92,0.18))] text-jostum-700">
            <Upload className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{file ? file.name : "Drop a file here or click to browse"}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{file ? formatFileSize(file.size) : helperText}</p>
          </div>
        </div>
        {file ? <button type="button" aria-label="Remove selected file" title="Remove selected file" onClick={(event) => { event.stopPropagation(); onRemove() }} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button> : null}
      </div>
    </div>
    {error ? <p className="text-xs text-red-600">{error}</p> : null}
    {typeof progress === "number" && progress > 0 ? <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500"><span>{progressLabel ?? "Upload progress"}</span><span>{progress}%</span></div>
      <div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-jostum-700 transition-all" style={{ width: `${Math.min(progress, 100)}%` }} /></div>
    </div> : null}
  </div>
}

const countrySelectFieldClassName = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
const academicTitleOptions = [
 
  "Emeritus Prof.",
  "Prof.",
  "Prof. Dr.",
  "Assoc. Prof.",
  "Asst. Prof.",
  "Adjunct Prof.",
  "Visiting Prof.",
  "Dr.",
  "Dr. habil.",
   "Mr.",
  "Mrs.",
  "Ms.",
] as const
const isAcademicTitle = (value: string): value is (typeof academicTitleOptions)[number] =>
  academicTitleOptions.includes(value as (typeof academicTitleOptions)[number])

function TitleSelectField({
  value,
  onChange,
  label = "Title",
}: {
  value: string
  onChange: (value: string) => void
  label?: string
}) {
  const normalizedValue = value.trim()

  React.useEffect(() => {
    if (normalizedValue && !isAcademicTitle(normalizedValue)) {
      onChange("")
    }
  }, [normalizedValue, onChange])

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <select className={countrySelectFieldClassName} value={isAcademicTitle(normalizedValue) ? normalizedValue : ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select title</option>
        {academicTitleOptions.map((title) => (
          <option key={title} value={title}>
            {title}
          </option>
        ))}
      </select>
    </div>
  )
}

function CountrySelectField({
  label,
  value,
  onChange,
  countryOptions,
  countriesLoading,
  countryLookupFailed,
  placeholder = "Select a country",
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  countryOptions: string[]
  countriesLoading: boolean
  countryLookupFailed: boolean
  placeholder?: string
  required?: boolean
}) {
  const resolvedCountryOptions = React.useMemo(() => {
    const currentValue = value.trim()
    if (!currentValue || countryOptions.includes(currentValue)) return countryOptions
    return [currentValue, ...countryOptions]
  }, [countryOptions, value])

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {countryLookupFailed ? (
        <>
          <Input value={value} onChange={(event) => onChange(event.target.value)} required={required} />
          <p className="text-xs text-amber-600">Country list is unavailable, so manual entry is enabled.</p>
        </>
      ) : (
        <>
          <select
            className={countrySelectFieldClassName}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={countriesLoading}
            required={required}
          >
            {countriesLoading ? <option value={value}>Loading countries...</option> : <option value="">{placeholder}</option>}
            {resolvedCountryOptions.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
          {countriesLoading ? <p className="text-xs text-slate-500">Loading country list from the online country API...</p> : null}
        </>
      )}
    </div>
  )
}

function ProfileMenu({ user, activeRoleLabel, onSaved, onLogout, loggingOut }: { user: AuthUser; activeRoleLabel: string; onSaved: () => Promise<void>; onLogout: () => Promise<void>; loggingOut: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [avatarError, setAvatarError] = React.useState("")
  const [avatarUploadProgress, setAvatarUploadProgress] = React.useState(0)
  const menuRef = React.useRef<HTMLDivElement | null>(null)
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null)
  const [form, setForm] = React.useState({ first_name: user.first_name, last_name: user.last_name, orcid_id: user.orcid_id ?? "", institution: user.institution ?? "", country: user.country ?? "", phone: user.phone ?? "", password: "", confirm_password: "" })
  const { countryOptions, countriesLoading, countryLookupFailed } = useCountryOptions()
  React.useEffect(() => setForm({ first_name: user.first_name, last_name: user.last_name, orcid_id: user.orcid_id ?? "", institution: user.institution ?? "", country: user.country ?? "", phone: user.phone ?? "", password: "", confirm_password: "" }), [user])
  React.useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick)
    }
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])
  const initials = `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() || "U"
  const avatarSrc = user.avatar_path ? resolveApiAssetUrl(user.avatar_path) : ""
  const closeEditing = () => {
    setEditing(false)
    setAvatarFile(null)
    setAvatarError("")
    setAvatarUploadProgress(0)
  }
  React.useEffect(() => {
    if (!editing || typeof document === "undefined") return
    const originalOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeEditing()
    }

    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [editing])
  const editProfileModal = editing && typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[260] overflow-y-auto bg-slate-950/55 p-3 pt-5 sm:p-4 sm:pt-8" onClick={closeEditing}>
      <div className="mx-auto w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
        <div className="overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-6">
            <div>
              <h3 className="display-modal text-slate-950">Edit Profile</h3>
              <p className="mt-2 text-sm text-slate-600">Update your journal account details, upload a profile image, and change your password.</p>
            </div>
            <button type="button" onClick={closeEditing} className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50">Close</button>
          </div>
          <form
            className="max-h-[calc(100vh-9.5rem)] overflow-y-auto px-4 py-4 sm:max-h-[calc(100vh-12rem)] sm:px-6 sm:py-5"
            onSubmit={async (e) => {
              e.preventDefault()
              setSaving(true)
              setAvatarUploadProgress(0)
              try {
                const payload = new FormData()
                Object.entries(form).forEach(([key, value]) => payload.append(key, value))
                if (avatarFile) payload.append("avatar", avatarFile)
                await updateProfile(payload as unknown as Record<string, unknown>, { onProgress: setAvatarUploadProgress })
                await onSaved()
                toast.success("Profile updated.")
                closeEditing()
              } catch (error) {
                toast.error(errorText(error, "Unable to update profile."))
              } finally {
                setSaving(false)
                setTimeout(() => setAvatarUploadProgress(0), 500)
              }
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-jostum-700 text-xl font-semibold text-white">
                  {avatarFile ? <img src={URL.createObjectURL(avatarFile)} alt="Profile preview" className="h-full w-full object-cover" /> : avatarSrc ? <img src={avatarSrc} alt={`${user.first_name} ${user.last_name}`} className="h-full w-full object-cover" /> : initials}
                </div>
                <div className="min-w-0 flex-1">
                  <FileDropzone
                    label="Profile image"
                    accept="image/png,image/jpeg,image/webp"
                    helperText="Accepted: PNG, JPG, WEBP. Maximum 5MB."
                    file={avatarFile}
                    error={avatarError}
                    progress={avatarUploadProgress}
                    progressLabel="Uploading profile image"
                    onFileSelect={(file) => {
                      if (!file) {
                        setAvatarFile(null)
                        setAvatarError("")
                        return
                      }
                      const error = validateUploadFile(file, ["image/png", "image/jpeg", "image/webp"], "Profile image", 5 * 1024 * 1024)
                      if (error) {
                        setAvatarFile(null)
                        setAvatarError(error)
                        return
                      }
                      setAvatarFile(file)
                      setAvatarError("")
                    }}
                    onRemove={() => {
                      setAvatarFile(null)
                      setAvatarError("")
                      setAvatarUploadProgress(0)
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>First name</Label>
                <Input value={form.first_name} onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Last name</Label>
                <Input value={form.last_name} onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>ORCID</Label>
                <Input value={form.orcid_id} onChange={(e) => setForm((p) => ({ ...p, orcid_id: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Institution</Label>
                <Input value={form.institution} onChange={(e) => setForm((p) => ({ ...p, institution: e.target.value }))} />
              </div>
              <CountrySelectField
                label="Country"
                value={form.country}
                onChange={(value) => setForm((prev) => ({ ...prev, country: value }))}
                countryOptions={countryOptions}
                countriesLoading={countriesLoading}
                countryLookupFailed={countryLookupFailed}
              />
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>New password</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Confirm password</Label>
                <Input type="password" value={form.confirm_password} onChange={(e) => setForm((p) => ({ ...p, confirm_password: e.target.value }))} />
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 border-t border-slate-100 pt-2 sm:pt-3">
                <Button type="button" variant="outline" onClick={closeEditing}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  ) : null
  return <>
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-controls="profile-menu-dropdown"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 py-1 pl-1 pr-1.5 text-left shadow-sm transition hover:border-jostum-300 sm:gap-3 sm:px-2 sm:py-2"
      >
        <div className={cn(
          "flex items-center justify-center overflow-hidden rounded-full border-2 border-white bg-jostum-700 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(15,23,42,0.12)]",
          "h-9 w-9 sm:h-11 sm:w-11",
        )}>{avatarSrc ? <img src={avatarSrc} alt={`${user.first_name} ${user.last_name}`} className="h-full w-full object-cover" /> : initials}</div>
        <div className="hidden sm:block">
          <p className="text-sm font-semibold text-slate-900">{user.first_name} {user.last_name}</p>
          <p className="text-xs text-slate-500">{activeRoleLabel || "User"}</p>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-slate-500 sm:h-4 sm:w-4" />
      </button>
      {open ? <div id="profile-menu-dropdown" className="absolute right-0 top-full z-[140] mt-3 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"><div className="rounded-2xl bg-slate-50 px-4 py-3"><p className="font-semibold text-slate-900">{user.first_name} {user.last_name}</p><p className="text-sm text-slate-500">{activeRoleLabel || "User"}</p><p className="mt-1 text-sm text-slate-500">{user.email}</p></div><button type="button" onClick={() => { setEditing(true); setOpen(false) }} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-jostum-50 hover:text-jostum-700"><User className="h-4 w-4" />Edit profile</button><button type="button" onClick={() => { setOpen(false); void onLogout() }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50">{loggingOut ? <Workflow className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}Logout</button></div> : null}
    </div>
    {editProfileModal}
  </>
}
function errorText(error: unknown, fallback: string) { if (isAxiosError(error)) { const payload = error.response?.data as { message?: string } | undefined; if (payload?.message) return payload.message } return error instanceof Error && error.message ? error.message : fallback }
function displayValue(value: unknown, key?: string) {
  if (Array.isArray(value)) {
    if (!value.length) return "0"
    if (value.every((entry) => ["string", "number", "boolean"].includes(typeof entry))) {
      const values = value.map((entry) => String(entry)).filter(Boolean)
      if (!values.length) return "0"
      if (values.length <= 3) return values.join(", ")
      return `${values.slice(0, 3).join(", ")} +${values.length - 3} more`
    }
    return `${value.length} items`
  }
  if (value && typeof value === "object") return `${Object.keys(value as Record<string, unknown>).length} fields`
  const text = String(value ?? "")
  if (key === "file_bundle") return <ManuscriptFileBundlePreview value={text} compact />
  if (key === "reference_number" || key === "manuscript_id") return <span className="whitespace-nowrap">{text}</span>
  if (key === "abstract" && text.length > 100) return `${text.slice(0, 100)}...`
  if (text.length > 160) return `${text.slice(0, 160)}...`
  return text
}
function formatColumnLabel(column: string) {
  return column.replaceAll("_", " ")
}
function statValue(value: unknown) { if (Array.isArray(value)) return value.length; if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length; return String(value ?? 0) }
function deadlineCountdown(value: unknown) {
  const raw = String(value ?? "").trim()
  if (!raw) return "No deadline set"
  const deadline = new Date(raw.replace(" ", "T"))
  if (Number.isNaN(deadline.getTime())) return raw
  const remainingMs = deadline.getTime() - Date.now()
  const absolute = deadline.toLocaleString()
  if (remainingMs <= 0) return `Overdue since ${absolute}`
  const totalHours = Math.ceil(remainingMs / 3600000)
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} ${hours} hour${hours === 1 ? "" : "s"} remaining (${absolute})`
  return `${hours} hour${hours === 1 ? "" : "s"} remaining (${absolute})`
}
function Table({ rows, columns }: { rows: Array<Record<string, unknown>>; columns?: string[] }) {
  const pageSize = 5
  const firstRow = rows[0] ?? {}
  const filterCandidates = ["status", "response", "assignment_status", "payment_status", "final_decision", "decision_type", "availability_status", "read_status"]
  const filterKey = filterCandidates.find((key) => rows.some((row) => row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== ""))
  const filterOptions = React.useMemo(() => {
    if (!filterKey) return []
    return Array.from(new Set(rows.map((row) => String(row[filterKey] ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [filterKey, rows])
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [page, setPage] = React.useState(1)
  const filteredRows = React.useMemo(() => {
    if (!filterKey || statusFilter === "all") return rows
    return rows.filter((row) => String(row[filterKey] ?? "").trim() === statusFilter)
  }, [filterKey, rows, statusFilter])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  React.useEffect(() => {
    setPage(1)
  }, [rows.length, statusFilter])

  if (!rows.length) {
    return <div className="rounded-[1.4rem] border border-slate-200/80 bg-white/88 p-5 text-sm text-slate-500 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">No records available.</div>
  }

  const baseKeys = columns?.length ? [...columns] : Object.keys(firstRow)
  if (!baseKeys.includes("reference_number") && Object.prototype.hasOwnProperty.call(firstRow, "reference_number")) {
    baseKeys.unshift("reference_number")
  }
  const cols = columns?.length ? baseKeys : baseKeys.slice(0, 6)
  const cardTitleColumn = ["title", "reference_number", "subject", "email", "journal_name", "payment_reference", "manuscript_id", "invitation_id", "issue_id", "user_id", "message_id"].find((column) => cols.includes(column)) ?? cols[0]
  const detailColumns = cols.filter((column) => column !== cardTitleColumn)

  const cellClass = (column: string) => {
    const base = "px-4 py-3 align-top text-[13px] leading-5 text-slate-700"
    if (column === "reference_number" || column === "manuscript_id") return `${base} whitespace-nowrap`
    if (column === "file_bundle") return `${base} min-w-[17rem]`
    if (column === "status" || column === "plagiarism_score") return `${base} whitespace-nowrap`
    return `${base} whitespace-normal`
  }

  const paginationControls = (
    <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
        <span>{filteredRows.length} record{filteredRows.length === 1 ? "" : "s"}</span>
        <span>Page {currentPage} of {totalPages}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filterKey && filterOptions.length > 1 ? (
          <select
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All {formatColumnLabel(filterKey)}</option>
            {filterOptions.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
          </select>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1}>Previous</Button>
        <Button size="sm" variant="outline" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages}>Next page</Button>
      </div>
    </div>
  )

  return <div className="min-w-0 max-w-full overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/92 shadow-[0_18px_38px_rgba(15,23,42,0.07)] backdrop-blur">
    {paginationControls}
    {!filteredRows.length ? <div className="border-t border-slate-200/80 p-5 text-sm text-slate-500">No records match the selected filter.</div> : null}
    <div className="space-y-3 p-3 sm:hidden">
      {pagedRows.map((row, index) => (
        <div key={index} className="rounded-[1.3rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-4 shadow-[0_12px_26px_rgba(15,23,42,0.06)]">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{formatColumnLabel(cardTitleColumn)}</p>
            <div className="mt-1.5 break-words text-sm font-semibold leading-6 text-slate-950">{displayValue(row[cardTitleColumn], cardTitleColumn)}</div>
          </div>
          {detailColumns.length ? <div className="mt-4 grid gap-3">
            {detailColumns.map((column) => (
              <div key={column} className="min-w-0 rounded-[1rem] border border-slate-200/70 bg-slate-50/80 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{formatColumnLabel(column)}</p>
                <div className="mt-1.5 break-words text-[13px] leading-5 text-slate-700">{displayValue(row[column], column)}</div>
              </div>
            ))}
          </div> : null}
        </div>
      ))}
    </div>
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full min-w-[52rem] table-auto text-[13px]">
        <thead className="bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.95))]">
          <tr>{cols.map((c)=><th key={c} className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-950">{formatColumnLabel(c)}</th>)}</tr>
        </thead>
        <tbody>{pagedRows.map((r,i)=><tr key={i} className="border-t border-slate-200/80 align-top odd:bg-white even:bg-slate-50/45">{cols.map((c)=><td key={c} className={cellClass(c)}>{displayValue(r[c], c)}</td>)}</tr>)}</tbody>
      </table>
    </div>
    {filteredRows.length > pageSize ? <div className="border-t border-slate-200/80">{paginationControls}</div> : null}
  </div>
}

type PublicationEditForm = {
  title: string
  reference_number: string
  publication_date: string
}

function PublicationRecordsTable({
  rows,
  search,
  onSearchChange,
  deletingId,
  onDelete,
  onEdit,
  emptyMessage,
}: {
  rows: Array<Record<string, unknown>>
  search: string
  onSearchChange: (value: string) => void
  deletingId: number | null
  onDelete: (entry: Record<string, unknown>) => Promise<void>
  onEdit: (entry: Record<string, unknown>, form: PublicationEditForm) => Promise<void>
  emptyMessage: string
}) {
  const [editingEntry, setEditingEntry] = React.useState<Record<string, unknown> | null>(null)
  const [editForm, setEditForm] = React.useState<PublicationEditForm>({
    title: "",
    reference_number: "",
    publication_date: "",
  })
  const [savingEdit, setSavingEdit] = React.useState(false)

  const openEdit = (entry: Record<string, unknown>) => {
    setEditingEntry(entry)
    setEditForm({
      title: String(entry.title ?? ""),
      reference_number: String(entry.reference_number ?? ""),
      publication_date: String(entry.publication_date ?? "").slice(0, 10),
    })
  }

  const closeEdit = () => {
    if (savingEdit) return
    setEditingEntry(null)
    setEditForm({ title: "", reference_number: "", publication_date: "" })
  }

  const submitEdit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingEntry) return
    setSavingEdit(true)
    try {
      await onEdit(editingEntry, editForm)
      setEditingEntry(null)
      setEditForm({ title: "", reference_number: "", publication_date: "" })
    } finally {
      setSavingEdit(false)
    }
  }

  const confirmDelete = async (entry: Record<string, unknown>) => {
    const label = String(entry.reference_number ?? entry.manuscript_id ?? "this publication")
    if (!window.confirm(`Delete publication ${label}? This will permanently remove its manuscript reference, payments, files, reviews, decisions, and related records.`)) {
      return
    }
    await onDelete(entry)
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-slate-600">
          {rows.length} publication{rows.length === 1 ? "" : "s"}
        </p>
        <Input
          className="max-w-xs"
          placeholder="Search author, title, ref #"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <div className="min-w-0 overflow-hidden rounded-[1.4rem] border border-white/80 bg-white/92 shadow-[0_18px_38px_rgba(15,23,42,0.07)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] table-fixed text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Author name", "Title of publication", "Date of publication", "Publication ref number", "Action"].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((entry) => {
                const rowId = Number(entry.manuscript_id)
                const deleting = deletingId === rowId
                return (
                  <tr key={String(entry.article_id ?? entry.manuscript_id)} className="border-t border-slate-200/80 align-top odd:bg-white even:bg-slate-50/45">
                    <td className="px-4 py-3 text-slate-700">{String(entry.author_name ?? "Unknown author")}</td>
                    <td className="break-words px-4 py-3 font-semibold text-slate-950">{String(entry.title ?? entry.manuscript_id)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{String(entry.publication_date ?? "Not set")}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{String(entry.reference_number ?? entry.manuscript_id)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 rounded-full"
                          title="Edit publication"
                          aria-label="Edit publication"
                          onClick={() => openEdit(entry)}
                          disabled={deleting}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 rounded-full text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                          title="Delete publication"
                          aria-label="Delete publication"
                          onClick={() => void confirmDelete(entry)}
                          disabled={deleting}
                        >
                          <Trash2 className={cn("h-4 w-4", deleting ? "opacity-50" : "")} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-slate-500">{emptyMessage}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {editingEntry ? (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-white/70 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="display-modal text-slate-950">Edit Publication</h3>
                <p className="mt-2 text-sm text-slate-600">{String(editingEntry.author_name ?? "Unknown author")}</p>
              </div>
              <button type="button" onClick={closeEdit} className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50" disabled={savingEdit}>
                Close
              </button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={submitEdit}>
              <div className="space-y-2">
                <Label>Title of publication</Label>
                <Input value={editForm.title} onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Publication ref number</Label>
                  <Input value={editForm.reference_number} onChange={(event) => setEditForm((prev) => ({ ...prev, reference_number: event.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Date of publication</Label>
                  <Input type="date" value={editForm.publication_date} onChange={(event) => setEditForm((prev) => ({ ...prev, publication_date: event.target.value }))} required />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeEdit} disabled={savingEdit}>Cancel</Button>
                <Button type="submit" disabled={savingEdit}>{savingEdit ? "Saving..." : "Save changes"}</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
function paymentLifecycleStatus(entry: Record<string, unknown>) {
  const status = String(entry.payment_status ?? "")
  const hasProof = String(entry.proof_file_path ?? "").trim() !== ""
  if (status === "reviewed") return "reviewed"
  if (status === "rejected") return "rejected"
  if (status === "confirmed" && hasProof) return "receipt_uploaded"
  if (status === "confirmed") return "confirmed"
  if (status === "initialized") return "initialized"
  return status || "submitted"
}
function PaymentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    initialized: "bg-amber-100 text-amber-800",
    confirmed: "bg-blue-100 text-blue-800",
    receipt_uploaded: "bg-emerald-100 text-emerald-800",
    reviewed: "bg-jostum-100 text-jostum-800",
    rejected: "bg-red-100 text-red-800",
    submitted: "bg-slate-100 text-slate-700",
  }
  const labels: Record<string, string> = {
    initialized: "Initialized",
    confirmed: "Confirmed",
    receipt_uploaded: "Receipt Uploaded",
    reviewed: "Reviewed",
    rejected: "Rejected",
    submitted: "Submitted",
  }
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", styles[status] ?? styles.submitted)}>{labels[status] ?? status}</span>
}
function PaymentRecordsCard({ payments, copyrightForms }: { payments: Array<Record<string, unknown>>; copyrightForms: Array<Record<string, unknown>> }) {
  return <Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Workflow className="h-5 w-5" />} title="Payment and Copyright Records" /></CardHeader><CardContent className="space-y-6"><div><p className="mb-3 text-sm font-semibold text-slate-900">Payment records</p><div className="space-y-3">{payments.length ? payments.map((entry) => <div key={String(entry.payment_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-slate-900">Manuscript #{String(entry.manuscript_id)}</p><p className="mt-1 text-sm text-slate-500">{String(entry.payment_reference ?? "")}</p></div><PaymentStatusBadge status={paymentLifecycleStatus(entry)} /></div><div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2"><p>Amount: {String(entry.amount ?? "")}</p><p>Submitted: {String(entry.submitted_at ?? "")}</p><p className="md:col-span-2">Details: {String(entry.payment_details ?? "No payment details recorded.")}</p></div></div>) : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No payment records available.</div>}</div></div><div><p className="mb-3 text-sm font-semibold text-slate-900">Copyright forms</p><Table rows={copyrightForms} /></div></CardContent></Card>
}
function Stats({ source }: { source: unknown }) {
  const entries = Array.isArray(source) ? source.map((entry, i) => [`Item ${i + 1}`, entry] as const) : Object.entries(asRecord(source))
  return <div data-workspace-stats className="grid gap-3 grid-cols-2 xl:grid-cols-4">{entries.slice(0,4).map(([k,v])=><Card key={k} className="min-w-0 overflow-hidden border-white/80 bg-white/92"><div className="h-1.5 bg-[linear-gradient(90deg,#0b6fa4_0%,#1f6b5c_100%)]" /><CardContent className="p-3.5 sm:p-5"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-[11px]">{k.replaceAll("_"," ")}</p><div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(11,111,164,0.14),rgba(31,107,92,0.18))] text-jostum-700 sm:h-10 sm:w-10"><BarChart3 className="h-4 w-4" /></div></div><p className="mt-2.5 text-[2rem] font-semibold tracking-tight text-slate-950 sm:mt-3 sm:text-[2rem]">{statValue(v)}</p></CardContent></Card>)}</div>
}
function ProfileCard({ user, onSaved }: { user: AuthUser; onSaved: () => Promise<void> }) {
  const [form, setForm] = React.useState({ first_name: user.first_name, last_name: user.last_name, orcid_id: user.orcid_id ?? "", institution: user.institution ?? "", country: user.country ?? "", phone: user.phone ?? "" })
  React.useEffect(() => setForm({ first_name: user.first_name, last_name: user.last_name, orcid_id: user.orcid_id ?? "", institution: user.institution ?? "", country: user.country ?? "", phone: user.phone ?? "" }), [user])
  const { countryOptions, countriesLoading, countryLookupFailed } = useCountryOptions()
  const [saving, setSaving] = React.useState(false)
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setSaving(true); try { await updateProfile(form); await onSaved(); toast.success("Profile updated.") } catch (error) { toast.error(errorText(error, "Unable to update profile.")) } finally { setSaving(false) } }
  return <Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<LayoutDashboard className="h-5 w-5" />} title="Profile Management" /></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-2" onSubmit={submit}><div className="space-y-2"><Label>First name</Label><Input value={form.first_name} onChange={(e)=>setForm((p)=>({...p,first_name:e.target.value}))} /></div><div className="space-y-2"><Label>Last name</Label><Input value={form.last_name} onChange={(e)=>setForm((p)=>({...p,last_name:e.target.value}))} /></div><div className="space-y-2"><Label>ORCID</Label><Input value={form.orcid_id} onChange={(e)=>setForm((p)=>({...p,orcid_id:e.target.value}))} /></div><div className="space-y-2"><Label>Institution</Label><Input value={form.institution} onChange={(e)=>setForm((p)=>({...p,institution:e.target.value}))} /></div><CountrySelectField label="Country" value={form.country} onChange={(value)=>setForm((p)=>({...p,country:value}))} countryOptions={countryOptions} countriesLoading={countriesLoading} countryLookupFailed={countryLookupFailed} /><div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e)=>setForm((p)=>({...p,phone:e.target.value}))} /></div><div className="md:col-span-2"><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save profile"}</Button></div></form></CardContent></Card>
}
function MessageHistoryPanel({ messages, user, onReply }: { messages: Array<Record<string, unknown>>; user: AuthUser; onReply: (message: Record<string, unknown>) => void }) {
  const rootId = (message: Record<string, unknown>) => String(message.parent_message_id || message.message_id)
  const sortedMessages = [...messages].sort((left, right) => String(right.sent_date ?? "").localeCompare(String(left.sent_date ?? "")))
  const threads = Array.from(new Map(sortedMessages.map((message) => [rootId(message), sortedMessages.filter((entry) => rootId(entry) === rootId(message))])).values())
  return <div className="space-y-5"><Table rows={messages} columns={["subject", "sender_name", "receiver_name", "sent_date", "email_sent", "email_status", "message_body"]} /><div className="space-y-3">{threads.length ? threads.map((thread) => { const latest = thread[0]; return <div key={rootId(latest)} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold text-slate-950">{String(latest.subject ?? "Message")}</p><p className="mt-1 text-sm text-slate-500">Latest: {String(latest.sent_date ?? "")} | {thread.length} message{thread.length === 1 ? "" : "s"}</p></div><Button size="sm" variant="outline" onClick={()=>onReply(latest)}>Reply</Button></div><div className="mt-4 space-y-3">{[...thread].reverse().map((message)=><div key={String(message.message_id)} className={cn("rounded-2xl border px-4 py-3 text-sm", Number(message.sender_id) === user.user_id ? "border-jostum-100 bg-jostum-50/70" : "border-slate-200 bg-slate-50")}><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-slate-900">{Number(message.sender_id) === user.user_id ? "You" : String(message.sender_name ?? "Sender")}</p><p className="text-xs text-slate-500">{String(message.sent_date ?? "")}</p></div><p className="mt-2 whitespace-pre-wrap leading-6 text-slate-700">{String(message.message_body ?? "")}</p><p className="mt-2 text-xs text-slate-500">{Number(message.email_sent ?? 0) === 1 || String(message.email_sent ?? "") === "1" ? "Email sent" : String(message.email_status ?? "Workspace copy saved")}</p></div>)}</div></div> }) : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No message history yet.</div>}</div></div>
}
function ReportsPanel() {
  const [report, setReport] = React.useState({ type: "submissions", format: "csv" })
  const reportTypes = [
    ["submissions", "Submission report"],
    ["reviews", "Reviewer reports"],
    ["payments", "APC/payment report"],
    ["users", "User and role report"],
    ["publications", "Publication report"],
  ]
  const formats = ["pdf", "csv", "xlsx", "docx"]
  const download = (event: React.FormEvent) => {
    event.preventDefault()
    window.open(buildReportDownloadUrl(report.type, report.format), "_blank", "noreferrer")
  }
  return <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<FileText className="h-5 w-5" />} title="Report Generator" description="Select a report type and export format, then download it for records, meetings, or audits." /></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-3" onSubmit={download}><div className="space-y-2"><Label>Report type</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={report.type} onChange={(e)=>setReport((prev)=>({...prev,type:e.target.value}))}>{reportTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div><div className="space-y-2"><Label>Format</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm uppercase" value={report.format} onChange={(e)=>setReport((prev)=>({...prev,format:e.target.value}))}>{formats.map((format)=><option key={format} value={format}>{format.toUpperCase()}</option>)}</select></div><div className="flex items-end"><Button type="submit" className="w-full">Generate and download</Button></div></form></CardContent></Card>
}
function MessagesCard({ workspace, user, onSaved }: { workspace: WorkspacePayload; user: AuthUser; onSaved: () => Promise<void> }) {
  const users = [...asArray(workspace.admin?.users), ...asArray(workspace.editor_in_chief?.users)].filter((v, i, a) => v.user_id && a.findIndex((e) => e.user_id === v.user_id) === i)
  const reviewerAcceptedManuscripts = asArray(workspace.reviewer?.invitations).filter((entry) => String(entry.response) === "accepted")
  const editorAssignments = asArray(workspace.editor?.assignments)
  const editorReviewers = asArray(workspace.editor?.reviewers)
  const isEditor = hasEditorWorkspaceRole(user.roles)
  const [form, setForm] = React.useState({ receiver_id: "", manuscript_id: "", recipient_type: "author", reviewer_id: "", subject: "", message_body: "" })
  const [replyingTo, setReplyingTo] = React.useState<Record<string, unknown> | null>(null)
  const [sending, setSending] = React.useState(false)
  const selectedEditorAssignment = editorAssignments.find((entry) => String(entry.manuscript_id) === form.manuscript_id) ?? null
  const assignedReviewerIds = String(selectedEditorAssignment?.assigned_reviewer_ids ?? "").split(",").map((id) => id.trim()).filter(Boolean)
  const manuscriptReviewers = assignedReviewerIds.length
    ? editorReviewers.filter((entry) => assignedReviewerIds.includes(String(entry.user_id)))
    : editorReviewers
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    try {
      const payload = isEditor
        ? {
            manuscript_id: form.manuscript_id ? Number(form.manuscript_id) : null,
            recipient_type: form.recipient_type,
            reviewer_id: form.recipient_type === "reviewer" ? Number(form.reviewer_id) : undefined,
            subject: form.subject,
            message_body: form.message_body,
            parent_message_id: replyingTo ? Number(replyingTo.message_id) : undefined,
          }
        : {
            ...form,
            receiver_id: user.roles.includes("reviewer") ? undefined : Number(form.receiver_id),
            manuscript_id: form.manuscript_id ? Number(form.manuscript_id) : null,
            parent_message_id: replyingTo ? Number(replyingTo.message_id) : undefined,
          }
      const response = await sendMessage(payload)
      setForm({ receiver_id: "", manuscript_id: "", recipient_type: "author", reviewer_id: "", subject: "", message_body: "" })
      setReplyingTo(null)
      await onSaved()
      toast.success(response.email_sent ? "Message and email sent." : response.email_message || "Message sent.")
    } catch (error) {
      toast.error(errorText(error, "Unable to send message."))
    } finally {
      setSending(false)
    }
  }
  return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Mail className="h-5 w-5" />} title="Communication Center" description="Track message history, read messages sent to you, and reply from the workspace even if email delivery is unavailable." /></CardHeader><CardContent><MessageHistoryPanel messages={asArray(workspace.messages)} user={user} onReply={(message)=>{ setReplyingTo(message); setForm((prev)=>({...prev, manuscript_id: String(message.manuscript_id ?? ""), subject: `Re: ${String(message.subject ?? "Message").replace(/^Re:\\s*/i, "")}`, message_body: "" })) }} /></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Mail className="h-5 w-5" />} title={replyingTo ? "Reply to Message" : user.roles.includes("reviewer") ? "Send Message to Corresponding Author" : isEditor ? "Editor Message Center" : "Send Message"} description={replyingTo ? `Replying to: ${String(replyingTo.subject ?? "Message")}` : isEditor ? "Choose author or reviewer, select the manuscript context, then send an internal message and email notification." : undefined} /></CardHeader><CardContent><form className="space-y-4" onSubmit={submit}>{replyingTo ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-jostum-100 bg-jostum-50 px-4 py-3 text-sm text-jostum-900"><span>Reply will be saved in this message thread and emailed when delivery is available.</span><Button type="button" size="sm" variant="outline" onClick={()=>{ setReplyingTo(null); setForm({ receiver_id: "", manuscript_id: "", recipient_type: "author", reviewer_id: "", subject: "", message_body: "" }) }}>Cancel reply</Button></div> : null}{!replyingTo && user.roles.includes("reviewer") ? <div className="space-y-2"><Label>Assigned manuscript</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.manuscript_id} onChange={(e)=>setForm((p)=>({...p,manuscript_id:e.target.value}))}><option value="">Select manuscript</option>{reviewerAcceptedManuscripts.map((entry)=><option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>{String(entry.title ?? entry.manuscript_id)}</option>)}</select><p className="text-xs text-slate-500">The corresponding author will receive your message without exposing author details on your screen.</p></div> : !replyingTo && isEditor ? <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Recipient type</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.recipient_type} onChange={(e)=>setForm((p)=>({...p,recipient_type:e.target.value, reviewer_id: ""}))}><option value="author">Author</option><option value="reviewer">Reviewer</option></select></div><div className="space-y-2"><Label>Manuscript</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.manuscript_id} onChange={(e)=>setForm((p)=>({...p,manuscript_id:e.target.value, reviewer_id: ""}))}><option value="">Select manuscript</option>{editorAssignments.map((entry)=><option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>{String(entry.reference_number ?? entry.manuscript_id)} - {String(entry.title ?? entry.manuscript_id)}</option>)}</select></div>{form.recipient_type === "reviewer" ? <div className="space-y-2 md:col-span-2"><Label>Reviewer</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.reviewer_id} onChange={(e)=>setForm((p)=>({...p,reviewer_id:e.target.value}))} disabled={!form.manuscript_id}><option value="">{form.manuscript_id ? "Select reviewer" : "Select manuscript first"}</option>{manuscriptReviewers.map((entry)=><option key={String(entry.user_id)} value={String(entry.user_id)}>{String(entry.first_name ?? "")} {String(entry.last_name ?? "")} ({String(entry.email ?? "")})</option>)}</select></div> : null}</div> : !replyingTo ? <div className="space-y-2"><Label>Receiver</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.receiver_id} onChange={(e)=>setForm((p)=>({...p,receiver_id:e.target.value}))}><option value="">Select user</option>{users.filter((entry)=>Number(entry.user_id)!==user.user_id).map((entry)=><option key={String(entry.user_id)} value={String(entry.user_id)}>{String(entry.first_name ?? "")} {String(entry.last_name ?? "")} ({String(entry.email ?? "")})</option>)}</select></div> : null}{!replyingTo && !user.roles.includes("reviewer") && !isEditor ? <div className="space-y-2"><Label>Manuscript ID</Label><Input value={form.manuscript_id} onChange={(e)=>setForm((p)=>({...p,manuscript_id:e.target.value}))} /></div> : null}<div className="space-y-2"><Label>Subject</Label><Input value={form.subject} onChange={(e)=>setForm((p)=>({...p,subject:e.target.value}))} /></div><div className="space-y-2"><Label>Message</Label><Textarea rows={6} value={form.message_body} onChange={(e)=>setForm((p)=>({...p,message_body:e.target.value}))} /></div><Button type="submit" disabled={sending || (isEditor && !replyingTo && (!form.manuscript_id || (form.recipient_type === "reviewer" && !form.reviewer_id)))}>{sending ? "Sending..." : replyingTo ? "Send reply" : "Send message and email"}</Button></form></CardContent></Card></div>
}
function ManualPlagiarismScorePanel({
  entries,
  title,
  description,
  emptyMessage,
  onSaved,
}: {
  entries: Array<Record<string, unknown>>
  title: string
  description: string
  emptyMessage: string
  onSaved: () => Promise<void>
}) {
  const availableEntries = entries.filter((entry) => Number(entry.manuscript_id ?? 0) > 0)
  const [selectedId, setSelectedId] = React.useState("")
  const [scoreValue, setScoreValue] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!availableEntries.length) {
      setSelectedId("")
      setScoreValue("")
      return
    }

    const hasSelectedEntry = availableEntries.some((entry) => String(entry.manuscript_id) === selectedId)
    if (!selectedId || !hasSelectedEntry) {
      const nextEntry = availableEntries[0]
      setSelectedId(String(nextEntry.manuscript_id))
      setScoreValue(nextEntry.plagiarism_score === null || nextEntry.plagiarism_score === undefined || nextEntry.plagiarism_score === "" ? "" : String(nextEntry.plagiarism_score))
    }
  }, [availableEntries, selectedId])

  const selectedEntry = availableEntries.find((entry) => String(entry.manuscript_id) === selectedId) ?? null

  React.useEffect(() => {
    if (!selectedEntry) {
      setScoreValue("")
      return
    }
    setScoreValue(selectedEntry.plagiarism_score === null || selectedEntry.plagiarism_score === undefined || selectedEntry.plagiarism_score === "" ? "" : String(selectedEntry.plagiarism_score))
  }, [selectedEntry?.manuscript_id, selectedEntry?.plagiarism_score])

  return <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
    <CardHeader>
      <CardHeading icon={<ShieldCheck className="h-5 w-5" />} title={title} description={description} />
    </CardHeader>
    <CardContent className="space-y-5">
      {availableEntries.length ? <>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!selectedEntry) {
              toast.error("Select a manuscript first.")
              return
            }
            const trimmedScore = scoreValue.trim()
            if (trimmedScore !== "") {
              const numericScore = Number(trimmedScore)
              if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100) {
                toast.error("Plagiarism score must be between 0 and 100.")
                return
              }
            }

            setSaving(true)
            try {
              const response = await updateManuscriptPlagiarismScore({
                manuscript_id: Number(selectedEntry.manuscript_id),
                plagiarism_score: trimmedScore === "" ? null : Number(trimmedScore),
              })
              await onSaved()
              setScoreValue(response.manuscript.plagiarism_score === null ? "" : String(response.manuscript.plagiarism_score))
              toast.success(response.message || "Plagiarism score saved.")
            } catch (error) {
              toast.error(errorText(error, "Unable to save plagiarism score."))
            } finally {
              setSaving(false)
            }
          }}
        >
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-2">
              <Label>Manuscript</Label>
              <select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                {availableEntries.map((entry) => <option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>
                  {String(entry.title ?? `Manuscript #${String(entry.manuscript_id)}`)}
                </option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Plagiarism score (%)</Label>
              <Input
                inputMode="decimal"
                value={scoreValue}
                onChange={(event) => setScoreValue(event.target.value)}
                placeholder="Enter score or leave blank"
              />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">{String(selectedEntry?.title ?? "")}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <p>Manuscript ID: <span className="font-semibold text-slate-900">{String(selectedEntry?.manuscript_id ?? "")}</span></p>
              <p>Current score: <span className="font-semibold text-slate-900">{selectedEntry?.plagiarism_score === null || selectedEntry?.plagiarism_score === undefined || selectedEntry?.plagiarism_score === "" ? "Not set" : `${Number(selectedEntry.plagiarism_score).toFixed(2)}%`}</span></p>
              <p>Status: <span className="font-semibold text-slate-900">{String(selectedEntry?.status ?? "submitted")}</span></p>
              <p>Article type: <span className="font-semibold text-slate-900">{String(selectedEntry?.article_type ?? "Not specified")}</span></p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save score"}</Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setScoreValue("")}>Clear field</Button>
          </div>
        </form>
      </> : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">{emptyMessage}</div>}
    </CardContent>
  </Card>
}
function AuthorPanels({ section, workspace, settings, onSaved }: { section: string; workspace: WorkspacePayload; settings: JournalSettings; onSaved: () => Promise<void> }) {
  const manuscripts = asArray(workspace.author?.manuscripts)
  const revisionEligibleManuscripts = React.useMemo(() => manuscripts.filter((entry) => String(entry.status ?? "") === "revision_required"), [manuscripts])
  const revisions = asArray(workspace.author?.revisions)
  const payments = asArray(workspace.author?.payments)
  const copyrightForms = asArray(workspace.author?.copyright_forms)
  const payableManuscripts = React.useMemo(() => manuscripts.filter((entry) => {
    const status = String(entry.status ?? "").toLowerCase()
    const submissionPaid = Number(entry.submission_payment_completed ?? 0) === 1 || String(entry.submission_payment_completed ?? "") === "1"
    const publicationPaid = Number(entry.publication_payment_completed ?? 0) === 1 || String(entry.publication_payment_completed ?? "") === "1"
    return status !== "published" && (!submissionPaid || (["accepted", "production"].includes(status) && !publicationPaid))
  }), [manuscripts])
  const submissionScreeningPaymentAmount = numericSetting(settings.submission_fee_ngn, SUBMISSION_SCREENING_PAYMENT_AMOUNT)
  const publicationFeeAmount = numericSetting(settings.publication_fee_ngn, manuscriptPaymentBaseAmount)
  const confirmedPayments = React.useMemo(() => payments.filter((entry) => String(entry.payment_status ?? "") === "confirmed"), [payments])
  const receiptEligiblePayments = React.useMemo(() => payments.filter((entry) => String(entry.payment_status ?? "") === "confirmed" && String(entry.proof_file_path ?? "").trim() === ""), [payments])
  const [submission, setSubmission] = React.useState(createEmptySubmission)
  const [submissionStep, setSubmissionStep] = React.useState(1)
  const submissionStepLabels = [
    { mobile: "Details", desktop: "Core details" },
    { mobile: "Scope", desktop: "Scope area" },
    { mobile: "Abstract", desktop: "Abstract" },
    { mobile: "Authors", desktop: "Authors" },
    { mobile: "Files", desktop: "Files & submit" },
  ] as const
  const [contributors, setContributors] = React.useState<SubmissionContributor[]>([])
  const [contributorDraft, setContributorDraft] = React.useState<SubmissionContributor>(createEmptyContributor())
  const [showContributorForm, setShowContributorForm] = React.useState(false)
  const [contributorErrors, setContributorErrors] = React.useState<string[]>([])
  const [submissionErrors, setSubmissionErrors] = React.useState(emptySubmissionFieldErrors)
  const [submissionSuccess, setSubmissionSuccess] = React.useState<SubmissionSuccessState | null>(null)
  const [draftSavedAt, setDraftSavedAt] = React.useState("")
  const [savedDraftFiles, setSavedDraftFiles] = React.useState<SubmissionDraftFileNames>(createEmptySubmissionDraftFiles)
  const [revision, setRevision] = React.useState({ manuscript_id: "", response_document: "", revised_file: null as File | null })
  const [paymentForm, setPaymentForm] = React.useState({ manuscript_id: "", amount: "", payment_reference: "", payment_details: "", proof_file: null as File | null })
  const [copyrightForm, setCopyrightForm] = React.useState({ manuscript_id: "", signed_file: null as File | null, notes: "" })
  const [onlinePayment, setOnlinePayment] = React.useState({ manuscript_id: "", amount: "", total_pages: "" })
  const [isCalculatingAmount, setIsCalculatingAmount] = React.useState(false)
  const [, setManuscriptFileIsNotPdf] = React.useState(false)
  const [amountCalculationNote, setAmountCalculationNote] = React.useState("")
  const [amountCalculationTone, setAmountCalculationTone] = React.useState<"muted" | "success" | "warning">("muted")
  const selectedPayableManuscript = React.useMemo(
    () => payableManuscripts.find((entry) => String(entry.manuscript_id) === onlinePayment.manuscript_id) ?? null,
    [onlinePayment.manuscript_id, payableManuscripts],
  )
  const paymentDetailsForManuscript = React.useCallback((entry: Record<string, unknown> | null) => {
    if (!entry) return { amount: submissionScreeningPaymentAmount, label: "Submission screening payment", helper: "This payment unlocks the paper for technical editing." }
    const status = String(entry.status ?? "").toLowerCase()
    const submissionPaid = Number(entry.submission_payment_completed ?? 0) === 1 || String(entry.submission_payment_completed ?? "") === "1"
    const isPublicationPayment = ["accepted", "production"].includes(status) && submissionPaid
    return isPublicationPayment
      ? { amount: publicationFeeAmount, label: "Publication payment", helper: "This payment unlocks final PDF production and publication." }
      : { amount: submissionScreeningPaymentAmount, label: "Submission screening payment", helper: "This payment unlocks the paper for technical editing." }
  }, [publicationFeeAmount, submissionScreeningPaymentAmount])
  const selectedManualPaymentManuscript = React.useMemo(
    () => payableManuscripts.find((entry) => String(entry.manuscript_id) === paymentForm.manuscript_id) ?? null,
    [paymentForm.manuscript_id, payableManuscripts],
  )
  const selectedManualPaymentDetails = paymentDetailsForManuscript(selectedManualPaymentManuscript)

  React.useEffect(() => {
    const updateGeneratedPayment = (nextAmount: string, nextPages = "") => {
      setOnlinePayment((prev) => (
        prev.amount === nextAmount && prev.total_pages === nextPages
          ? prev
          : { ...prev, amount: nextAmount, total_pages: nextPages }
      ))
    }

    const clearAmountState = () => {
      setIsCalculatingAmount(false)
      setManuscriptFileIsNotPdf(false)
      setAmountCalculationTone("muted")
      setAmountCalculationNote("")
      updateGeneratedPayment("")
    }

    if (!onlinePayment.manuscript_id || !selectedPayableManuscript) {
      clearAmountState()
      return
    }

    setIsCalculatingAmount(false)
    setManuscriptFileIsNotPdf(false)
    setAmountCalculationTone("success")
    const paymentDetails = paymentDetailsForManuscript(selectedPayableManuscript)
    setAmountCalculationNote(`${paymentDetails.label}: ${formatNairaAmount(paymentDetails.amount)}.`)
    updateGeneratedPayment(String(paymentDetails.amount), "1")

    return undefined
  }, [onlinePayment.manuscript_id, paymentDetailsForManuscript, selectedPayableManuscript])

  const [uploadErrors, setUploadErrors] = React.useState({ manuscript_file: "", supplementary_file: "", revised_file: "", payment_proof: "", signed_file: "" })
  const [uploadProgress, setUploadProgress] = React.useState({ manuscript_file: 0, revised_file: 0, payment_proof: 0, signed_file: 0 })
  const [saving, setSaving] = React.useState(false)
  const [showTermsModal, setShowTermsModal] = React.useState(false)
  const [termsAgreed, setTermsAgreed] = React.useState(false)
  const [payingOnline, setPayingOnline] = React.useState(false)
  const [verifyingPayment, setVerifyingPayment] = React.useState(false)
  const [manuscriptSearch, setManuscriptSearch] = React.useState("")
  // Admin inline publication records table (safe insertion)
  const adminLocalDelete = async (entry: Record<string, unknown>) => {
    try {
      const payload: Record<string, unknown> = {}
      const manuscriptId = Number(entry.manuscript_id ?? 0)
      const articleId = Number(entry.article_id ?? 0)
      if (articleId) payload.article_id = articleId
      else if (manuscriptId) payload.manuscript_id = manuscriptId
      await deletePublication(payload)
      await onSaved()
      toast.success("Publication and related records deleted.")
    } catch (error) {
      toast.error(errorText(error, "Unable to delete publication."))
    }
  }
  const adminLocalEdit = async (entry: Record<string, unknown>, form: PublicationEditForm) => {
    try {
      const payload: Record<string, unknown> = { title: form.title, publication_date: form.publication_date, reference_number: form.reference_number }
      if (entry.article_id) payload.article_id = Number(entry.article_id)
      else if (entry.manuscript_id) payload.manuscript_id = Number(entry.manuscript_id)
      await updatePublication(payload)
      await onSaved()
      toast.success("Publication updated.")
    } catch (error) {
      toast.error(errorText(error, "Unable to update publication."))
    }
  }
  const AdminPublicationRecordsTableCard = () => (
    <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
      <CardHeader>
        <CardHeading icon={<BookMarked className="h-5 w-5" />} title="Publication Records (Admin)" description="Table view with edit/delete actions." />
      </CardHeader>
      <CardContent>
        <PublicationRecordsTable
          rows={publishedManuscripts}
          search={manuscriptSearch}
          onSearchChange={(v) => setManuscriptSearch(v)}
          deletingId={null}
          onDelete={adminLocalDelete}
          onEdit={adminLocalEdit}
          emptyMessage="No published manuscripts available."
        />
      </CardContent>
    </Card>
  )
  const AllManuscriptsTableCard = () => (
    <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
      <CardHeader>
        <CardHeading icon={<BookMarked className="h-5 w-5" />} title="All Manuscripts" description="Complete view of all manuscripts in the journal workspace." />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Input className="max-w-xs" placeholder="Search ref #, ID, title, scope, type" value={manuscriptSearch} onChange={(e) => setManuscriptSearch(e.target.value)} />
            <div className="text-sm text-slate-500">{filteredManuscripts.length} manuscripts found</div>
          </div>
          {filteredManuscripts.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-slate-900">Ref #</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-900">Title</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-900">Status</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-900">Type</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-900">Scope</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-900">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredManuscripts.map((entry) => (
                    <tr key={String(entry.manuscript_id)} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-900">{String(entry.reference_number ?? entry.manuscript_id)}</td>
                      <td className="px-4 py-2 text-slate-700">{String(entry.title ?? "Untitled")}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                          String(entry.status ?? "").toLowerCase() === "published" ? "bg-green-100 text-green-800" :
                          String(entry.status ?? "").toLowerCase() === "accepted" ? "bg-blue-100 text-blue-800" :
                          String(entry.status ?? "").toLowerCase() === "rejected" ? "bg-red-100 text-red-800" :
                          "bg-slate-100 text-slate-800"
                        }`}>
                          {String(entry.status ?? "Pending")}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{String(entry.article_type ?? "")}</td>
                      <td className="px-4 py-2 text-slate-600">{String(entry.scope_area ?? "")}</td>
                      <td className="px-4 py-2 text-slate-600">{String(entry.created_at ?? "").split("T")[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
              No manuscripts available.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
  const submissionDraftStorageKey = React.useMemo(() => `jasti-submission-draft-${String(workspace.user.user_id ?? "anonymous")}`, [workspace.user.user_id])
  const abstractWordCount = React.useMemo(() => countWords(submission.abstract), [submission.abstract])
  const keywordWordCount = React.useMemo(() => countWords(submission.keywords), [submission.keywords])
  const normalize = (value: unknown) => String(value ?? "").toLowerCase()
  const filteredManuscripts = manuscriptSearch.trim() === ""
    ? manuscripts
    : manuscripts.filter((entry) => {
        const q = manuscriptSearch.toLowerCase()
        return normalize(entry.reference_number).includes(q)
          || normalize(entry.manuscript_id).includes(q)
          || normalize(entry.title).includes(q)
          || normalize(entry.scope_area).includes(q)
          || normalize(entry.article_type).includes(q)
      })
  const contributorDraftError = React.useMemo(() => contributorSubmissionError(contributorDraft), [contributorDraft])
  const correspondingAuthorName = `${String(workspace.user.first_name ?? "")} ${String(workspace.user.last_name ?? "")}`.trim() || String(workspace.user.email ?? "")
  const correspondingAuthorEmail = String(workspace.user.email ?? "").trim()
  const correspondingAuthorInstitution = String(workspace.user.institution ?? "").trim()
  const totalAuthors = contributors.length + 1

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const savedDraft = window.localStorage.getItem(submissionDraftStorageKey)
    if (!savedDraft) return

    try {
      const parsed = JSON.parse(savedDraft) as Partial<SubmissionDraft>
      const restoredContributors = restoreContributorDrafts(parsed.contributors)

      setSubmission({
        title: String(parsed.title ?? ""),
        scope_area: String(parsed.scope_area ?? ""),
        abstract: String(parsed.abstract ?? ""),
        keywords: String(parsed.keywords ?? ""),
        article_type: String(parsed.article_type ?? ""),
        plagiarism_score: "",
        manuscript_file: null,
        supplementary_file: null,
      })
      setContributors(restoredContributors)
      setContributorErrors(restoredContributors.map(() => ""))
      setSubmissionErrors(emptySubmissionFieldErrors)
      setUploadErrors((prev) => ({ ...prev, manuscript_file: "", supplementary_file: "" }))
      setDraftSavedAt(String(parsed.saved_at ?? ""))
      setSavedDraftFiles({
        manuscript_file: String(parsed.manuscript_file_name ?? ""),
        supplementary_file: String(parsed.supplementary_file_name ?? ""),
      })
    } catch {
      window.localStorage.removeItem(submissionDraftStorageKey)
    }
  }, [submissionDraftStorageKey])

  React.useEffect(() => {
    if (!submissionSuccess || typeof document === "undefined") return

    const originalOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSubmissionSuccess(null)
      }
    }

    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [submissionSuccess])

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const callbackFlag = params.get("paystack_callback")
    const reference = params.get("reference") ?? params.get("trxref")
    if (callbackFlag !== "1" || !reference) return
    setVerifyingPayment(true)
    void verifyPaystackPayment({ reference })
      .then(async (response) => {
        toast.success(response.message)
        await onSaved()
      })
      .catch((error) => {
        toast.error(errorText(error, "Unable to verify Paystack payment."))
      })
      .finally(() => {
        setVerifyingPayment(false)
        params.delete("paystack_callback")
        params.delete("reference")
        params.delete("trxref")
        const nextQuery = params.toString()
        window.history.replaceState({}, document.title, `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`)
      })
  }, [onSaved])
  const resetSubmissionComposer = React.useCallback(() => {
    setSubmission(createEmptySubmission())
    setSubmissionStep(1)
    setContributors([])
    setContributorErrors([])
    setContributorDraft(createEmptyContributor())
    setShowContributorForm(false)
    setSubmissionErrors(emptySubmissionFieldErrors)
    setUploadErrors((prev) => ({ ...prev, manuscript_file: "", supplementary_file: "" }))
    setSavedDraftFiles(createEmptySubmissionDraftFiles())
  }, [])
  const clearSubmissionDraft = React.useCallback((silent = false) => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(submissionDraftStorageKey)
    }
    setDraftSavedAt("")
    setSavedDraftFiles(createEmptySubmissionDraftFiles())
    if (!silent) {
      toast.success("Saved manuscript draft cleared from this device.")
    }
  }, [submissionDraftStorageKey])
  const saveSubmissionDraft = React.useCallback(() => {
    if (!hasSubmissionDraftContent(submission, contributors, savedDraftFiles)) {
      toast.error("Add some manuscript details before saving a draft.")
      return false
    }

    if (typeof window === "undefined") return false

    const nextDraft: SubmissionDraft = {
      title: submission.title,
      scope_area: submission.scope_area,
      abstract: submission.abstract,
      keywords: submission.keywords,
      article_type: submission.article_type,
      contributors,
      manuscript_file_name: submission.manuscript_file?.name ?? savedDraftFiles.manuscript_file,
      supplementary_file_name: submission.supplementary_file?.name ?? savedDraftFiles.supplementary_file,
      saved_at: new Date().toISOString(),
    }

    window.localStorage.setItem(submissionDraftStorageKey, JSON.stringify(nextDraft))
    setDraftSavedAt(nextDraft.saved_at)
    setSavedDraftFiles({
      manuscript_file: nextDraft.manuscript_file_name,
      supplementary_file: nextDraft.supplementary_file_name,
    })
    toast.success("Draft saved on this device. Reattach files if you continue after a refresh.")
    return true
  }, [contributors, savedDraftFiles, submission, submissionDraftStorageKey])
  const updateContributorDraftField = (field: keyof SubmissionContributor, value: string) => {
    setContributorDraft((prev) => ({ ...prev, [field]: value }))
  }
  const appendContributorDraft = () => {
    const nextContributor = {
      author_name: contributorDraft.author_name.trim(),
      author_email: contributorDraft.author_email.trim(),
      affiliation: contributorDraft.affiliation.trim(),
    }

    const error = contributorSubmissionError(nextContributor)
    if (error) {
      toast.error(error)
      return false
    }

    if (!hasContributorContent(nextContributor)) {
      return false
    }

    setContributors((prev) => {
      const next = [...prev, nextContributor]
      setContributorErrors(next.map(contributorSubmissionError))
      return next
    })
    setContributorDraft(createEmptyContributor())
    setShowContributorForm(false)
    return true
  }
  const removeContributor = (index: number) => {
    setContributors((prev) => {
      const next = prev.filter((_, contributorIndex) => contributorIndex !== index)
      setContributorErrors(next.map(contributorSubmissionError))
      return next
    })
  }
  const assignUpload = (
    field: keyof typeof uploadErrors,
    file: File | null,
    allowedMimeTypes: string[],
    label: string,
    onValid: (value: File | null) => void,
  ) => {
    if (!file) {
      onValid(null)
      setUploadErrors((prev) => ({ ...prev, [field]: "" }))
      return
    }
    const error = validateUploadFile(file, allowedMimeTypes, label)
    if (error) {
      onValid(null)
      setUploadErrors((prev) => ({ ...prev, [field]: error }))
      return
    }
    onValid(file)
    setUploadErrors((prev) => ({ ...prev, [field]: "" }))
  }
  const handleManuscriptSelect = (file: File | null) => {
    if (!file) {
      setSubmission((prev) => ({ ...prev, plagiarism_score: "", manuscript_file: null }))
      setUploadErrors((prev) => ({ ...prev, manuscript_file: "" }))
      setSavedDraftFiles((prev) => ({ ...prev, manuscript_file: "" }))
      return
    }
    const error = validateUploadFile(file, ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], "Main manuscript")
    if (error) {
      setSubmission((prev) => ({ ...prev, plagiarism_score: "", manuscript_file: null }))
      setUploadErrors((prev) => ({ ...prev, manuscript_file: error }))
      return
    }
    setSubmission((prev) => ({ ...prev, manuscript_file: file, plagiarism_score: "" }))
    setUploadErrors((prev) => ({ ...prev, manuscript_file: "" }))
    setSavedDraftFiles((prev) => ({ ...prev, manuscript_file: "" }))
  }
  const validateSubmissionStep = (currentStep: number) => {
    if (currentStep === 1) {
      const nextSubmissionErrors = {
        title: titleSubmissionError(submission.title, true),
        abstract: "",
        keywords: keywordSubmissionError(submission.keywords, true),
        article_type: articleTypeSubmissionError(submission.article_type, true),
      }
      setSubmissionErrors((prev) => ({ ...prev, ...nextSubmissionErrors }))
      return Object.values(nextSubmissionErrors).every((value) => value === "")
    }

    if (currentStep === 2) {
      const scopeError = scopeAreaSubmissionError(submission.scope_area, true)
      setSubmissionErrors((prev) => ({ ...prev, scope_area: scopeError }))
      return scopeError === ""
    }

    if (currentStep === 3) {
      const abstractError = abstractSubmissionError(submission.abstract, true)
      setSubmissionErrors((prev) => ({ ...prev, abstract: abstractError }))
      return abstractError === ""
    }

    if (currentStep === 4) {
      const nextContributorErrors = contributors.map(contributorSubmissionError)
      setContributorErrors(nextContributorErrors)
      return nextContributorErrors.every((value) => value === "")
    }

    if (currentStep === 5) {
      const manuscriptFileError = submission.manuscript_file ? "" : "Upload the main manuscript file before submitting."
      setUploadErrors((prev) => ({
        ...prev,
        manuscript_file: manuscriptFileError,
      }))
      return manuscriptFileError === ""
    }

    return true
  }
  const validateSubmissionForm = () => {
    const nextSubmissionErrors = {
      title: titleSubmissionError(submission.title, true),
      scope_area: scopeAreaSubmissionError(submission.scope_area, true),
      abstract: abstractSubmissionError(submission.abstract, true),
      keywords: keywordSubmissionError(submission.keywords, true),
      article_type: articleTypeSubmissionError(submission.article_type, true),
    }
    const nextContributorErrors = contributors.map(contributorSubmissionError)
    const manuscriptFileError = submission.manuscript_file ? "" : "Upload the main manuscript file before submitting."
    const supplementaryFileError = "" // Supplementary file is optional
    setSubmissionErrors(nextSubmissionErrors)
    setContributorErrors(nextContributorErrors)
    setUploadErrors((prev) => ({
      ...prev,
      manuscript_file: manuscriptFileError,
      supplementary_file: supplementaryFileError,
    }))

    return Object.values(nextSubmissionErrors).every((value) => value === "")
      && nextContributorErrors.every((value) => value === "")
      && manuscriptFileError === ""
  }
  const scrollToDashboardStats = () => {
    window.setTimeout(() => {
      const target = document.querySelector("[data-workspace-stats], [data-workspace-summary]") as HTMLElement | null
      if (!target) {
        window.scrollTo({ top: 0, behavior: "smooth" })
        return
      }

      const top = Math.max(target.getBoundingClientRect().top + window.scrollY - 108, 0)
      window.scrollTo({ top, behavior: "smooth" })
    }, 140)
  }
  const closeSubmissionSuccess = () => {
    setSubmissionSuccess(null)
    scrollToDashboardStats()
  }
  const performSubmit = async () => {
    if (!validateSubmissionForm()) {
      toast.error("Complete all required manuscript submission fields and fix the validation errors.")
      return
    }

    setSaving(true)
    setUploadProgress((prev) => ({ ...prev, manuscript_file: 0 }))
    try {
      const normalizedContributors = contributors
        .map((contributor) => ({
          author_name: contributor.author_name.trim(),
          author_email: contributor.author_email.trim(),
          affiliation: contributor.affiliation.trim(),
        }))
        .filter(hasContributorContent)
      const correspondingAuthorName = `${String(workspace.user.first_name ?? "")} ${String(workspace.user.last_name ?? "")}`.trim() || String(workspace.user.email ?? "")
      const submissionTitle = submission.title.trim()
      const submissionAuthorList = [correspondingAuthorName, ...normalizedContributors.map((contributor) => contributor.author_name)].filter(Boolean)
      const payload = new FormData()
      payload.append("title", submission.title)
      payload.append("scope_area", submission.scope_area)
      payload.append("abstract", submission.abstract)
      payload.append("keywords", submission.keywords)
      payload.append("article_type", submission.article_type)
      payload.append("authors", JSON.stringify(normalizedContributors))
      if (submission.manuscript_file) payload.append("manuscript_file", submission.manuscript_file)

      const response = await submitManuscript(payload as unknown as Record<string, unknown>, {
        onProgress: (progress) => setUploadProgress((prev) => ({ ...prev, manuscript_file: progress })),
      })

      clearSubmissionDraft(true)
      resetSubmissionComposer()
      setUploadErrors({ manuscript_file: "", supplementary_file: "", revised_file: "", payment_proof: "", signed_file: "" })
      await onSaved()
      setSubmissionSuccess({
        title: submissionTitle,
        reference_number: response.reference_number,
        submitted_at: response.submitted_at,
        author_list: submissionAuthorList,
      })
    } catch (error) {
      toast.error(errorText(error, "Unable to submit manuscript."))
    } finally {
      setSaving(false)
      setTimeout(() => setUploadProgress((prev) => ({ ...prev, manuscript_file: 0 })), 500)
    }
  }
  const savedDraftSummary = [
    savedDraftFiles.manuscript_file ? `Main manuscript: ${savedDraftFiles.manuscript_file}` : "",
    savedDraftFiles.supplementary_file ? `Supplementary file: ${savedDraftFiles.supplementary_file}` : "",
  ].filter(Boolean)
  const submissionSuccessModal = submissionSuccess && typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[260] overflow-y-auto bg-slate-950/55 p-3 pt-5 sm:p-4 sm:pt-8" onClick={closeSubmissionSuccess}>
      <div className="mx-auto w-full max-w-xl" onClick={(event) => event.stopPropagation()}>
        <div className="overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <h3 className="display-modal text-slate-950">Submission Successful</h3>
                <p className="mt-2 text-sm text-slate-600">Your manuscript is now in the editorial workflow and the reference details below have been recorded.</p>
              </div>
            </div>
            <button type="button" onClick={closeSubmissionSuccess} className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50">Close</button>
          </div>
          <div className="space-y-5 px-4 py-5 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Reference Number</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">{submissionSuccess.reference_number}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Submitted At</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{submissionSuccess.submitted_at}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Manuscript Title</p>
              <p className="mt-2 text-base font-semibold text-slate-950">{submissionSuccess.title}</p>
            </div>
            {submissionSuccess.author_list.length ? <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Author List</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{submissionSuccess.author_list.join(", ")}</p>
            </div> : null}
            <div className="flex justify-end">
              <Button type="button" onClick={closeSubmissionSuccess}>Continue</Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  ) : null
  const termsModal = showTermsModal && typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[270] overflow-y-auto bg-slate-950/55 p-3 pt-5 sm:p-4 sm:pt-8" onClick={() => setShowTermsModal(false)}>
      <div className="mx-auto w-full max-w-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-6">
            <div>
              <h3 className="display-modal text-slate-950">JASTI | Journal of Applied Science, Technology, and Innovation</h3>
              <p className="mt-2 text-sm text-slate-600">Terms and Conditions for Manuscript Submission</p>
            </div>
            <button type="button" onClick={() => setShowTermsModal(false)} className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50">Close</button>
          </div>
          <div className="space-y-4 px-4 py-5 sm:px-6">
            <div className="max-h-[50vh] overflow-y-auto space-y-3 text-sm text-slate-700">
              <p><strong>1. Originality and Authorship</strong><br/>The submitted manuscript must be original, unpublished, and not under consideration elsewhere. All listed authors must have significantly contributed to the work and approved the final version.</p>

              <p><strong>2. Plagiarism and Ethical Standards</strong><br/>JASTI maintains a strict anti-plagiarism policy. All submissions may be screened using plagiarism detection tools. Manuscripts must comply with accepted ethical standards, including proper citation and avoidance of data fabrication or falsification.</p>

              <p><strong>3. Peer Review Process</strong><br/>All manuscripts undergo a peer review process. The editorial team reserves the right to accept, reject, or request revisions based on reviewers’ comments and editorial judgment.</p>

              <p><strong>4. Copyright and Licensing</strong><br/>Upon acceptance, authors agree to transfer or license publication rights to JASTI. Authors retain responsibility for the content and grant JASTI the right to publish, reproduce, and distribute the work.</p>

              <p><strong>5. Article Processing Charges (APC)</strong><br/>If applicable, authors agree to pay the required publication fees after acceptance. Payment details will be communicated officially by the journal.</p>

              <p><strong>6. Publication Fee and Page Charges</strong><br/>Authors are required to pay {formatNairaAmount(publicationFeeAmount)} for each accepted manuscript, covering up to {manuscriptPaymentIncludedPages} pages. Pages above {manuscriptPaymentIncludedPages} are charged at {formatNairaAmount(manuscriptPaymentExtraPageRate)} per page.</p>

              <p><strong>7. Conflict of Interest Disclosure</strong><br/>Authors must disclose any financial or personal relationships that could influence the research.</p>

              <p><strong>8. Withdrawal Policy</strong><br/>Authors may withdraw their manuscript before acceptance. After acceptance, withdrawal requests must be justified and may incur administrative charges.</p>

              <p><strong>9. Corrections and Retractions</strong><br/>JASTI reserves the right to issue corrections or retract published articles in cases of proven misconduct or significant errors.</p>

              <p><strong>10. Disclaimer</strong><br/>The opinions expressed in published articles are those of the authors and do not necessarily reflect the views of JASTI or its editorial board.</p>

              <p><strong>11. Agreement</strong><br/>By submitting a manuscript, the author(s) confirm that they have read, understood, and agreed to these terms and conditions.</p>
            </div>
            <div className="flex items-start gap-3">
              <input id="terms-agree" type="checkbox" checked={termsAgreed} onChange={(e) => setTermsAgreed(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-200 text-jostum-700" />
              <label htmlFor="terms-agree" className="text-sm text-slate-700">I have read and agree to the terms and conditions above.</label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowTermsModal(false)}>Cancel</Button>
              <Button type="button" disabled={!termsAgreed} onClick={async () => {
                setShowTermsModal(false)
                setTermsAgreed(true)
                await performSubmit()
              }}>{saving ? "Submitting..." : "Confirm and Submit"}</Button>
            </div>
            <p className="mt-2 text-xs text-slate-500">JASTI Editorial Office</p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  ) : null
  if (section === "submission") return <><div className="grid gap-5">
    <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
      <CardHeader className="pb-4">
        <CardHeading icon={<FileText className="h-5 w-5" />} title="New Manuscript Submission" description="Upload a clean manuscript package for editorial review." />
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Save & Continue</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">Drafts are stored on this device so you can return later without re-entering your manuscript details and contributor list.</p>
              {draftSavedAt ? <p className="mt-2 text-xs font-medium text-slate-600">Last saved: {formatSavedTimestamp(draftSavedAt)}</p> : null}
              {savedDraftSummary.length
                ? <p className="mt-2 text-xs leading-6 text-slate-600">Reattach these saved files before final submission: {savedDraftSummary.join(" | ")}.</p>
                : <p className="mt-2 text-xs leading-6 text-slate-500">If you refresh or return later, selected files will need to be attached again.</p>}
            </div>
            {draftSavedAt ? <Button type="button" size="sm" variant="ghost" onClick={() => clearSubmissionDraft()}>
              Clear saved draft
            </Button> : null}
          </div>
        </div>
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!termsAgreed) {
              setShowTermsModal(true)
              return
            }
            await performSubmit()
          }}
        >
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-2 sm:p-3">
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {submissionStepLabels.map((stepLabel, index) => {
                const stepNumber = index + 1
                const isActive = submissionStep === stepNumber
                const isComplete = submissionStep > stepNumber
                return (
                  <button
                    key={stepLabel.desktop}
                    type="button"
                    onClick={() => {
                      if (stepNumber > submissionStep && !validateSubmissionStep(submissionStep)) {
                        toast.error("Complete the current step before moving on.")
                        return
                      }
                      setSubmissionStep(stepNumber)
                    }}
                    className={cn(
                      "min-w-0 rounded-[1.15rem] border px-2 py-2 text-center text-[11px] font-medium leading-4 transition sm:px-3 sm:py-2.5 sm:text-left sm:text-sm sm:leading-5",
                      isActive
                        ? "border-jostum-700 bg-jostum-50 text-jostum-800"
                        : isComplete
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-600",
                    )}
                  >
                    <div className="flex flex-col items-center gap-1 sm:items-start sm:gap-1.5">
                      <span className={cn(
                        "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold sm:hidden",
                        isActive
                          ? "bg-jostum-700 text-white"
                          : isComplete
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-200 text-slate-700",
                      )}>
                        {stepNumber}
                      </span>
                      <p className="hidden text-[10px] uppercase tracking-[0.16em] sm:block">Step {stepNumber}</p>
                      <p className="min-w-0 text-balance">
                        <span className="sm:hidden">{stepLabel.mobile}</span>
                        <span className="hidden sm:inline">{stepLabel.desktop}</span>
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {submissionStep === 1 ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="submission-title">
                  Title
                  <span className="ml-1 text-red-500">*</span>
                </Label>
                <Input
                  id="submission-title"
                  required
                  aria-invalid={Boolean(submissionErrors.title)}
                  value={submission.title}
                  onChange={(e) => {
                    const value = e.target.value
                    setSubmission((p) => ({ ...p, title: value }))
                    setSubmissionErrors((prev) => ({
                      ...prev,
                      title: titleSubmissionError(value, prev.title !== ""),
                    }))
                  }}
                />
                {submissionErrors.title ? <p className="text-xs text-red-600">{submissionErrors.title}</p> : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                <Label htmlFor="submission-article-type">
                  Article type
                  <span className="ml-1 text-red-500">*</span>
                </Label>
                <select
                  id="submission-article-type"
                  required
                  aria-invalid={Boolean(submissionErrors.article_type)}
                  value={submission.article_type}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    onChange={(e) => {
                      const value = e.target.value
                      setSubmission((p) => ({ ...p, article_type: value }))
                      setSubmissionErrors((prev) => ({
                        ...prev,
                        article_type: articleTypeSubmissionError(value, prev.article_type !== ""),
                      }))
                    }}
                  >
                    <option value="">Select article type</option>
                    {manuscriptArticleTypeOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  {submissionErrors.article_type ? <p className="text-xs text-red-600">{submissionErrors.article_type}</p> : null}
                </div>
                <div className="space-y-2">
                <Label htmlFor="submission-keywords">
                  Keywords
                  <span className="ml-1 text-red-500">*</span>
                </Label>
                <Input
                  id="submission-keywords"
                  required
                  aria-invalid={submissionErrors.keywords ? "true" : undefined}
                  value={submission.keywords}
                    onChange={(e) => {
                      const value = e.target.value
                      setSubmission((p) => ({ ...p, keywords: value }))
                      setSubmissionErrors((prev) => ({
                        ...prev,
                        keywords: keywordSubmissionError(value, prev.keywords !== ""),
                      }))
                    }}
                  />
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>Separate keywords with commas.</span>
                    <span className={cn(keywordWordCount > MANUSCRIPT_KEYWORD_WORD_LIMIT && "font-semibold text-red-600")}>
                      {keywordWordCount}/{MANUSCRIPT_KEYWORD_WORD_LIMIT} words
                    </span>
                  </div>
                  {submissionErrors.keywords ? <p className="text-xs text-red-600">{submissionErrors.keywords}</p> : null}
                </div>
              </div>
              <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">Core submission details are completed first so authors can save and return without losing progress.</p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={() => {
                      if (!validateSubmissionStep(1)) {
                        toast.error("Complete the required fields before continuing.")
                        return
                      }
                      if (saveSubmissionDraft()) {
                        setSubmissionStep(2)
                      }
                    }}
                  >
                    Save & Continue
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {submissionStep === 2 ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="submission-scope-area">
                  Scope (Schematic Area)
                  <span className="ml-1 text-red-500">*</span>
                </Label>
                <select
                  id="submission-scope-area"
                  required
                  aria-invalid={Boolean(submissionErrors.scope_area)}
                  value={submission.scope_area}
                  className="min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  onChange={(e) => {
                    const value = e.target.value
                    setSubmission((p) => ({ ...p, scope_area: value }))
                    setSubmissionErrors((prev) => ({
                      ...prev,
                      scope_area: scopeAreaSubmissionError(value, prev.scope_area !== ""),
                    }))
                  }}
                >
                  <option value="">Select scope area</option>
                  {scopeAreas.map((scopeArea) => (
                    <option key={scopeArea} value={scopeArea}>{scopeArea}</option>
                  ))}
                </select>
                {submissionErrors.scope_area ? <p className="text-xs text-red-600">{submissionErrors.scope_area}</p> : null}
              </div>
              <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" variant="outline" onClick={() => setSubmissionStep(1)}>
                  Previous
                </Button>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={() => {
                      if (!validateSubmissionStep(2)) {
                        toast.error("Select a manuscript scope before continuing.")
                        return
                      }
                      if (saveSubmissionDraft()) {
                        setSubmissionStep(3)
                      }
                    }}
                  >
                    Save & Continue
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {submissionStep === 3 ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="submission-abstract">
                  Abstract
                  <span className="ml-1 text-red-500">*</span>
                </Label>
                <Textarea
                  id="submission-abstract"
                  required
                  aria-invalid={submissionErrors.abstract ? "true" : undefined}
                  rows={8}
                  value={submission.abstract}
                  onChange={(e) => {
                    const value = e.target.value
                    setSubmission((p) => ({ ...p, abstract: value }))
                    setSubmissionErrors((prev) => ({
                      ...prev,
                      abstract: abstractSubmissionError(value, prev.abstract !== ""),
                    }))
                  }}
                />
                <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>Maximum {MANUSCRIPT_ABSTRACT_WORD_LIMIT} words.</span>
                  <span className={cn(abstractWordCount > MANUSCRIPT_ABSTRACT_WORD_LIMIT && "font-semibold text-red-600")}>
                    {abstractWordCount}/{MANUSCRIPT_ABSTRACT_WORD_LIMIT} words
                  </span>
                </div>
                {submissionErrors.abstract ? <p className="text-xs text-red-600">{submissionErrors.abstract}</p> : null}
              </div>
              <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" variant="outline" onClick={() => setSubmissionStep(2)}>
                  Previous
                </Button>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={() => {
                      if (!validateSubmissionStep(3)) {
                        toast.error("Complete the abstract before continuing.")
                        return
                      }
                      if (saveSubmissionDraft()) {
                        setSubmissionStep(4)
                      }
                    }}
                  >
                    Save & Continue
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {submissionStep === 4 ? (
            <>
              <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">Author Contributions</p>
                    <p className="text-sm leading-6 text-slate-600">The signed-in account is recorded automatically as the corresponding author. Add only the extra contributors needed for this manuscript.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="sm:h-9" onClick={() => setShowContributorForm((prev) => !prev)}>
                    <Plus className="h-4 w-4" />
                    {showContributorForm ? "Hide form" : "Add author"}
                  </Button>
                </div>

                <div className="rounded-[1.6rem] border border-slate-200 bg-white p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">Author roster</p>
                      <p className="text-xs leading-5 text-slate-500">Corresponding and added authors now sit in one compact band for quicker review.</p>
                    </div>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      {totalAuthors} {totalAuthors === 1 ? "author" : "authors"}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="min-w-0 rounded-2xl border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(248,250,252,0.96))] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Corresponding</p>
                          <p className="mt-1 text-sm font-semibold text-slate-950">{correspondingAuthorName}</p>
                        </div>
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Primary</span>
                      </div>
                      {correspondingAuthorEmail ? <p className="mt-2 truncate text-xs text-slate-600">{correspondingAuthorEmail}</p> : null}
                      {correspondingAuthorInstitution ? <p className="mt-1 truncate text-xs text-slate-500">{correspondingAuthorInstitution}</p> : null}
                    </div>

                    {contributors.map((contributor, index) => (
                      <div key={`${contributor.author_name || "author"}-${index}`} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/85 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Added author {index + 1}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-950">{contributor.author_name || `Author ${index + 1}`}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove ${contributor.author_name || `author ${index + 1}`}`}
                            title={`Remove ${contributor.author_name || `author ${index + 1}`}`}
                            className="h-8 w-8 rounded-full p-0 text-slate-500 hover:bg-red-50 hover:text-red-600"
                            onClick={() => removeContributor(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="mt-2 truncate text-xs text-slate-600">{contributor.author_email || "No email provided"}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{contributor.affiliation || "Affiliation not added yet"}</p>
                      </div>
                    ))}

                    {!contributors.length ? (
                      <div className="flex min-h-[7.25rem] items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-6 text-slate-500">
                        {/* Added authors will appear here and stay aligned with the corresponding author. */}
                      </div>
                    ) : null}
                  </div>
                </div>

                {showContributorForm ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4">
                    <div className="grid gap-3 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Full name</Label>
                        <Input value={contributorDraft.author_name} onChange={(e) => updateContributorDraftField("author_name", e.target.value)} placeholder="Contributor full name" />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={contributorDraft.author_email} onChange={(e) => updateContributorDraftField("author_email", e.target.value)} placeholder="Optional contributor email" />
                      </div>
                      <div className="space-y-2">
                        <Label>Affiliation</Label>
                        <Input value={contributorDraft.affiliation} onChange={(e) => updateContributorDraftField("affiliation", e.target.value)} placeholder="Institution or department" />
                      </div>
                    </div>
                    {contributorDraftError ? <p className="mt-3 text-xs text-red-600">{contributorDraftError}</p> : <p className="mt-3 text-xs text-slate-500">Add the contributor to the roster when ready. You can repeat this for multiple authors.</p>}
                    <div className="mt-3 flex flex-wrap justify-end gap-2.5">
                      <Button type="button" variant="outline" onClick={() => { setContributorDraft(createEmptyContributor()); setShowContributorForm(false) }}>Cancel</Button>
                      <Button type="button" onClick={() => { void appendContributorDraft() }}>Add author</Button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" variant="outline" onClick={() => setSubmissionStep(3)}>
                  Previous
                </Button>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={() => {
                      if (showContributorForm && hasContributorContent(contributorDraft)) {
                        if (!appendContributorDraft()) {
                          return
                        }
                      }
                      if (!validateSubmissionStep(4)) {
                        toast.error("Complete the author information before continuing.")
                        return
                      }
                      if (saveSubmissionDraft()) {
                        setSubmissionStep(5)
                      }
                    }}
                  >
                    Save & Continue
                  </Button>
                </div>
              </div>
            </>
          ) : null}

          {submissionStep === 5 ? (
            <div className="space-y-5">
              <div className="grid gap-4">
                <FileDropzone
                  label="Main manuscript"
                  required
                  accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  helperText="DOC or DOCX only. Max 10MB."
                  file={submission.manuscript_file}
                  error={uploadErrors.manuscript_file}
                  progress={uploadProgress.manuscript_file}
                  progressLabel="Uploading manuscript"
                  onFileSelect={handleManuscriptSelect}
                  onRemove={() => {
                    setSubmission((prev) => ({ ...prev, plagiarism_score: "", manuscript_file: null }))
                    setUploadErrors((prev) => ({ ...prev, manuscript_file: "" }))
                    setUploadProgress((prev) => ({ ...prev, manuscript_file: 0 }))
                    setSavedDraftFiles((prev) => ({ ...prev, manuscript_file: "" }))
                  }}
                />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm leading-6 text-slate-600">Review the attached DOC/DOCX file, then submit the manuscript to technical screening when everything is ready.</p>
                {draftSavedAt ? <p className="mt-1 text-xs font-medium text-slate-500">Draft saved locally on {formatSavedTimestamp(draftSavedAt)}</p> : null}
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" variant="outline" onClick={() => setSubmissionStep(4)}>
                  Previous
                </Button>
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={saving} className="sm:min-w-[170px]">
                    {saving ? "Submitting..." : "Submit manuscript"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
    <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
      <CardHeader className="pb-4 sm:flex-row sm:items-end sm:justify-between">
        <CardHeading icon={<BookOpenText className="h-5 w-5" />} title="Submitted Manuscripts" description="Search and review your recent submissions without leaving the author workspace." />
        <Input className="w-full sm:max-w-xs" placeholder="Search ref # or title" value={manuscriptSearch} onChange={(e)=>setManuscriptSearch(e.target.value)} />
      </CardHeader>
      <CardContent className="space-y-4">
        <Table rows={filteredManuscripts} columns={["reference_number", "title", "scope_area", "author_list", "status", "article_type", "plagiarism_score", "file_bundle"]} />
      </CardContent>
    </Card>
  </div>{submissionSuccessModal}{termsModal}</>
  if (section === "revision") return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Upload className="h-5 w-5" />} title="Revision Module" description="Manage revised versions and response documents only for manuscripts currently returned for revision." /></CardHeader><CardContent><form className="space-y-4" onSubmit={async (e)=>{e.preventDefault(); if (!revision.manuscript_id) { toast.error("Select a manuscript that is currently in revision."); return } if (!revision.revised_file) { setUploadErrors((prev) => ({ ...prev, revised_file: "Upload the revised manuscript before submitting the revision." })); return } setSaving(true); setUploadProgress((prev) => ({ ...prev, revised_file: 0 })); try { const payload = new FormData(); payload.append("manuscript_id", revision.manuscript_id); payload.append("response_document", revision.response_document); payload.append("revised_file", revision.revised_file); await submitRevision(payload as unknown as Record<string, unknown>, { onProgress: (progress) => setUploadProgress((prev) => ({ ...prev, revised_file: progress })) }); setRevision({ manuscript_id: "", response_document: "", revised_file: null }); setUploadErrors((prev) => ({ ...prev, revised_file: "" })); await onSaved(); toast.success("Revision submitted.") } catch (error) { toast.error(errorText(error, "Unable to submit revision.")) } finally { setSaving(false); setTimeout(() => setUploadProgress((prev) => ({ ...prev, revised_file: 0 })), 500) } }}><div className="space-y-2"><Label>Manuscript</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={revision.manuscript_id} onChange={(e)=>setRevision((p)=>({...p,manuscript_id:e.target.value}))} disabled={revisionEligibleManuscripts.length === 0}><option value="">{revisionEligibleManuscripts.length ? "Select manuscript" : "No manuscript currently requires revision"}</option>{revisionEligibleManuscripts.map((entry)=><option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>{String(entry.reference_number ?? entry.manuscript_id)} — {String(entry.title ?? entry.manuscript_id)}</option>)}</select></div>{revisionEligibleManuscripts.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">A manuscript will appear here only after reviewers and editors request revision.</div> : null}<div className="space-y-2"><Label>Response to reviewers</Label><Textarea rows={8} value={revision.response_document} onChange={(e)=>setRevision((p)=>({...p,response_document:e.target.value}))} /></div><FileDropzone label="Revised manuscript" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" helperText="DOC or DOCX only. Maximum 10MB." file={revision.revised_file} error={uploadErrors.revised_file} progress={uploadProgress.revised_file} progressLabel="Uploading revision" onFileSelect={(file)=>assignUpload("revised_file", file, ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], "Revised manuscript", (value)=>setRevision((p)=>({...p, revised_file: value})))} onRemove={()=>{ assignUpload("revised_file", null, [], "Revised manuscript", (value)=>setRevision((p)=>({...p, revised_file: value}))); setUploadProgress((prev) => ({ ...prev, revised_file: 0 })) }} /><Button type="submit" disabled={saving || revisionEligibleManuscripts.length === 0}>{saving ? "Submitting..." : "Submit revision"}</Button></form></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Workflow className="h-5 w-5" />} title="Revision History" /></CardHeader><CardContent><Table rows={revisions} /></CardContent></Card></div>
  if (section === "metrics") return <div className="grid gap-6"><div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<BarChart3 className="h-5 w-5" />} title="Manuscript Payments" description="Pay submission screening fees before technical editing and publication fees after acceptance." /></CardHeader><CardContent className="space-y-5"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><p className="font-semibold text-slate-900">Paystack workflow</p><p className="mt-2 leading-7">Choose a manuscript. The system will generate either the submission fee ({formatNairaAmount(submissionScreeningPaymentAmount)}) or publication fee ({formatNairaAmount(publicationFeeAmount)}) depending on the manuscript stage.</p></div>{verifyingPayment ? <div className="rounded-2xl border border-slate-200 bg-jostum-50 p-4 text-sm text-jostum-800">Verifying your Paystack payment...</div> : null}<form className="space-y-4" onSubmit={async (e)=>{ e.preventDefault(); if (!onlinePayment.manuscript_id) { toast.error("Select a manuscript first."); return } if (!onlinePayment.amount) { toast.error("Amount has not been generated yet."); return } setPayingOnline(true); try { const response = await initializePaystackPayment({ manuscript_id: Number(onlinePayment.manuscript_id), amount: Number(onlinePayment.amount), total_pages: Number(onlinePayment.total_pages || 1) }); toast.success(response.message); window.location.assign(response.authorization_url) } catch (error) { toast.error(errorText(error, "Unable to initialize Paystack payment.")) } finally { setPayingOnline(false) } }}><div className="space-y-2"><Label>Manuscript</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={onlinePayment.manuscript_id} onChange={(e)=>setOnlinePayment((p)=>({...p, manuscript_id: e.target.value}))} disabled={payableManuscripts.length === 0}><option value="">{payableManuscripts.length ? "Select manuscript" : "No manuscript is ready for payment"}</option>{payableManuscripts.map((entry)=><option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>{String(entry.reference_number ?? entry.manuscript_id)} — {String(entry.title ?? entry.manuscript_id)}</option>)}</select></div><div className="space-y-2"><Label>Amount (NGN)</Label><Input value={onlinePayment.amount} readOnly placeholder="Generated automatically" /><p className="text-xs text-slate-500">{selectedPayableManuscript ? paymentDetailsForManuscript(selectedPayableManuscript).helper : "Select a manuscript to generate the required fee."}</p>{amountCalculationNote ? <p className={cn("rounded-2xl border px-3 py-2 text-sm", amountCalculationTone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : amountCalculationTone === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600")}>{amountCalculationNote}</p> : null}</div><Button type="submit" disabled={payingOnline || payableManuscripts.length === 0 || !onlinePayment.amount}>{payingOnline ? "Redirecting..." : "Pay with Paystack"}</Button></form></CardContent></Card><div className="space-y-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Workflow className="h-5 w-5" />} title="Manual receipt upload" description="Upload a receipt if payment was made outside Paystack. It must be reviewed before the workflow can continue." /></CardHeader><CardContent><form className="space-y-4" onSubmit={async (e)=>{e.preventDefault(); if (!paymentForm.proof_file) { setUploadErrors((prev) => ({ ...prev, payment_proof: "Upload the payment proof before sending payment details." })); return } setSaving(true); setUploadProgress((prev) => ({ ...prev, payment_proof: 0 })); try { const payload = new FormData(); payload.append("manuscript_id", paymentForm.manuscript_id); payload.append("amount", paymentForm.amount || String(selectedManualPaymentDetails.amount)); payload.append("payment_reference", paymentForm.payment_reference); payload.append("payment_details", paymentForm.payment_details); payload.append("payment_proof", paymentForm.proof_file); await submitPayment(payload as unknown as Record<string, unknown>, { onProgress: (progress) => setUploadProgress((prev) => ({ ...prev, payment_proof: progress })) }); setPaymentForm({ manuscript_id: "", amount: "", payment_reference: "", payment_details: "", proof_file: null }); setUploadErrors((prev) => ({ ...prev, payment_proof: "" })); await onSaved(); toast.success("Receipt submitted and attached to the payment record.") } catch (error) { toast.error(errorText(error, "Unable to submit payment receipt.")) } finally { setSaving(false); setTimeout(() => setUploadProgress((prev) => ({ ...prev, payment_proof: 0 })), 500) } }}><div className="space-y-2"><Label>Manuscript</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={paymentForm.manuscript_id} onChange={(e)=>setPaymentForm((p)=>({...p,manuscript_id:e.target.value, amount: ""}))} disabled={payableManuscripts.length === 0}><option value="">{payableManuscripts.length ? "Select manuscript" : "No manuscript is ready for payment"}</option>{payableManuscripts.map((entry)=><option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>{String(entry.reference_number ?? entry.manuscript_id)} — {String(entry.title ?? entry.manuscript_id)}</option>)}</select>{paymentForm.manuscript_id ? <p className="text-xs text-slate-500">{selectedManualPaymentDetails.label}: {formatNairaAmount(selectedManualPaymentDetails.amount)}.</p> : null}</div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Amount</Label><Input value={paymentForm.amount} onChange={(e)=>setPaymentForm((p)=>({...p,amount:e.target.value}))} placeholder={String(selectedManualPaymentDetails.amount)} /></div><div className="space-y-2"><Label>Payment reference</Label><Input value={paymentForm.payment_reference} onChange={(e)=>setPaymentForm((p)=>({...p,payment_reference:e.target.value}))} placeholder="Bank transfer / receipt reference" /></div></div><FileDropzone label="Payment proof" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" helperText="Accepted: PDF, JPG, PNG, WEBP. Maximum 10MB." file={paymentForm.proof_file} error={uploadErrors.payment_proof} progress={uploadProgress.payment_proof} progressLabel="Uploading payment proof" onFileSelect={(file)=>assignUpload("payment_proof", file, ["application/pdf", "image/jpeg", "image/png", "image/webp"], "Payment proof", (value)=>setPaymentForm((p)=>({...p, proof_file: value})))} onRemove={()=>{ assignUpload("payment_proof", null, [], "Payment proof", (value)=>setPaymentForm((p)=>({...p, proof_file: value}))); setUploadProgress((prev) => ({ ...prev, payment_proof: 0 })) }} /><div className="space-y-2"><Label>Receipt notes</Label><Textarea rows={4} value={paymentForm.payment_details} onChange={(e)=>setPaymentForm((p)=>({...p,payment_details:e.target.value}))} /></div><Button type="submit" disabled={saving || payableManuscripts.length === 0 || !paymentForm.payment_reference || !paymentForm.manuscript_id}>{saving ? "Submitting..." : "Submit receipt"}</Button></form></CardContent></Card></div></div><PaymentRecordsCard payments={payments} copyrightForms={copyrightForms} /></div>
  return <Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>{section === "compliance" ? "Compliance Checks" : "Submission Status Tracker"}</CardTitle></CardHeader><CardContent><Table rows={manuscripts} /></CardContent></Card>
}
function ReviewerOnboardingCard({ onboarding, user, onSaved }: { onboarding?: NonNullable<WorkspacePayload["reviewer"]>["onboarding"]; user: AuthUser; onSaved: () => Promise<void> }) {
  const application = onboarding?.application ?? {}
  const agreements = asRecord(onboarding?.agreements)
  const availability = asRecord(onboarding?.availability)
  const [step, setStep] = React.useState(1)
  const [saving, setSaving] = React.useState(false)
  const [validationMessage, setValidationMessage] = React.useState("")
  const [uploadErrors, setUploadErrors] = React.useState({ cv_file: "", publication_list_file: "", orcid_screenshot_file: "" })
  const [uploadProgress, setUploadProgress] = React.useState(0)
  const [files, setFiles] = React.useState<{ cv_file: File | null; publication_list_file: File | null; orcid_screenshot_file: File | null }>({ cv_file: null, publication_list_file: null, orcid_screenshot_file: null })
  const [form, setForm] = React.useState({
    title: String(application.title ?? ""),
    first_name: String(application.first_name ?? user.first_name ?? ""),
    last_name: String(application.last_name ?? user.last_name ?? ""),
    gender: String(application.gender ?? ""),
    nationality: String(application.nationality ?? ""),
    country: String(application.country ?? user.country ?? ""),
    institution: String(application.institution ?? user.institution ?? ""),
    department: String(application.department ?? ""),
    position: String(application.position ?? ""),
    email: String(application.email ?? user.email ?? ""),
    alt_email: String(application.alt_email ?? ""),
    phone: String(application.phone ?? user.phone ?? ""),
    whatsapp_number: String(application.whatsapp_number ?? ""),
    office_address: String(application.office_address ?? ""),
    orcid_id: String(application.orcid_id ?? user.orcid_id ?? ""),
    scopus_id: String(application.scopus_id ?? ""),
    researcher_id: String(application.researcher_id ?? ""),
    google_scholar_link: String(application.google_scholar_link ?? ""),
    publication_count: String(application.publication_count ?? "0"),
    publication_count_band: String(application.publication_count_band ?? ""),
    reviewer_experience: String(Number(application.reviewer_experience ?? 0)) === "1",
    papers_reviewed_band: String(application.papers_reviewed_band ?? ""),
    manuscripts_per_year: String(application.manuscripts_per_year ?? "3"),
    manuscripts_per_year_band: String(application.manuscripts_per_year_band ?? ""),
    preferred_review_time: String(application.preferred_review_time ?? "14"),
    bio: String(application.bio ?? ""),
    available: String(Number(availability.available ?? 1)) !== "0",
    max_reviews_per_year: String(availability.max_reviews_per_year ?? application.manuscripts_per_year ?? ""),
    last_review_date: String(availability.last_review_date ?? ""),
    confidentiality_agreed: String(Number(agreements.confidentiality_agreed ?? 0)) === "1",
    conflict_policy_agreed: String(Number(agreements.conflict_policy_agreed ?? 0)) === "1",
    ethical_review_agreed: String(Number(agreements.ethical_review_agreed ?? 0)) === "1",
  })
  const [qualifications, setQualifications] = React.useState(
    onboarding?.qualifications?.length
      ? onboarding.qualifications.map((entry) => ({
          degree: String(entry.degree ?? ""),
          field_of_study: String(entry.field_of_study ?? ""),
          institution: String(entry.institution ?? ""),
          graduation_year: String(entry.graduation_year ?? ""),
        }))
      : [{ degree: "", field_of_study: "", institution: "", graduation_year: "" }],
  )
  const [expertise, setExpertise] = React.useState(
    onboarding?.expertise?.length
      ? onboarding.expertise.map((entry) => ({
          research_area: String(entry.research_area ?? ""),
          keywords: String(entry.keywords ?? ""),
        }))
      : [{ research_area: "", keywords: "" }],
  )
  const [specializations, setSpecializations] = React.useState(
    onboarding?.expertise?.map((entry) => String(entry.research_area ?? "")).filter(Boolean) ?? [],
  )
  const [journalExperiences, setJournalExperiences] = React.useState(
    onboarding?.journal_experiences?.length
      ? onboarding.journal_experiences.map((entry) => ({
          journal_name: String(entry.journal_name ?? ""),
          publisher: String(entry.publisher ?? ""),
          years_of_service: String(entry.years_of_service ?? ""),
        }))
      : [{ journal_name: "", publisher: "", years_of_service: "" }],
  )
  const [conflicts, setConflicts] = React.useState(
    onboarding?.conflicts?.length
      ? onboarding.conflicts.map((entry) => ({
          institution_conflict: String(entry.institution_conflict ?? ""),
          author_conflict: String(entry.author_conflict ?? ""),
          notes: String(entry.notes ?? ""),
        }))
      : [{ institution_conflict: "", author_conflict: "", notes: "" }],
  )
  const stepLabels = ["Personal", "Contact", "Qualifications", "Expertise", "Publication", "Experience", "Ethics"]
  const specializationOptions = onboarding?.specialization_options ?? []
  const currentCvPath = String(application.cv_file ?? "")
  const currentPublicationListPath = String(application.publication_list_file ?? "")
  const currentOrcidScreenshotPath = String(application.orcid_screenshot_file ?? "")
  const { countryOptions, countriesLoading, countryLookupFailed } = useCountryOptions()

  const validateStep = (currentStep: number) => {
    if (currentStep === 1) {
      return form.title && form.first_name && form.last_name && form.nationality && form.country && form.institution && form.department && form.position ? "" : "Complete personal and institutional information before continuing."
    }
    if (currentStep === 2) {
      return form.email && form.phone && form.office_address ? "" : "Institutional email, phone number, and office address are required."
    }
    if (currentStep === 3) {
      return qualifications.some((entry) => entry.degree.trim() && entry.field_of_study.trim() && entry.institution.trim() && entry.graduation_year.trim()) ? "" : "Add at least one academic qualification with degree, field, institution, and year."
    }
    if (currentStep === 4) {
      return specializations.length > 0 ? "" : "Select at least one primary research area before continuing."
    }
    if (currentStep === 5) {
      return form.publication_count_band && form.orcid_id ? "" : "ORCID ID and publication count band are required before continuing."
    }
    if (currentStep === 6) {
      if (!form.papers_reviewed_band || !form.manuscripts_per_year_band || !form.preferred_review_time) {
        return "Complete reviewing experience and availability before continuing."
      }
      if (form.reviewer_experience && !journalExperiences.some((entry) => entry.journal_name.trim())) {
        return "List at least one journal under previous reviewing experience or switch the experience answer to No."
      }
      return ""
    }
    if (currentStep === 7) {
      if (!form.bio.trim()) return "Provide a short academic biography before submitting the reviewer application."
      if (!files.cv_file && !currentCvPath) return "Upload the reviewer CV before submitting."
      if (!form.confidentiality_agreed || !form.conflict_policy_agreed || !form.ethical_review_agreed) {
        return "All reviewer ethical declarations must be accepted before completion."
      }
      return ""
    }
    return ""
  }

  const handleFileAssign = (
    field: "cv_file" | "publication_list_file" | "orcid_screenshot_file",
    file: File | null,
    allowedMimeTypes: string[],
    label: string,
    maxBytes = MAX_UPLOAD_BYTES,
  ) => {
    if (!file) {
      setFiles((prev) => ({ ...prev, [field]: null }))
      setUploadErrors((prev) => ({ ...prev, [field]: "" }))
      return
    }
    const error = validateUploadFile(file, allowedMimeTypes, label, maxBytes)
    if (error) {
      setFiles((prev) => ({ ...prev, [field]: null }))
      setUploadErrors((prev) => ({ ...prev, [field]: error }))
      return
    }
    setFiles((prev) => ({ ...prev, [field]: file }))
    setUploadErrors((prev) => ({ ...prev, [field]: "" }))
  }

  const submit = async () => {
    const error = validateStep(7)
    if (error) {
      setValidationMessage(error)
      return
    }
    setSaving(true)
    setUploadProgress(0)
    try {
      const payload = new FormData()
      Object.entries(form).forEach(([key, value]) => payload.append(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value)))
      payload.append("publication_count", form.publication_count || "0")
      payload.append("manuscripts_per_year", form.manuscripts_per_year || "3")
      payload.append("preferred_review_time", form.preferred_review_time || "14")
      payload.append("specializations", JSON.stringify(specializations))
      payload.append("qualifications", JSON.stringify(qualifications))
      payload.append("expertise", JSON.stringify(expertise))
      payload.append("journal_experiences", JSON.stringify(journalExperiences))
      payload.append("conflicts", JSON.stringify(conflicts))
      if (files.cv_file) payload.append("cv_file", files.cv_file)
      if (files.publication_list_file) payload.append("publication_list_file", files.publication_list_file)
      if (files.orcid_screenshot_file) payload.append("orcid_screenshot_file", files.orcid_screenshot_file)
      const response = await updateReviewerProfile(payload as unknown as Record<string, unknown>, { onProgress: setUploadProgress })
      await onSaved()
      setValidationMessage("")
      toast.success(response.message)
    } catch (error) {
      toast.error(errorText(error, "Unable to save reviewer application."))
    } finally {
      setSaving(false)
      setTimeout(() => setUploadProgress(0), 500)
    }
  }

  return <Card className="border-white/70 bg-white/88 backdrop-blur"><CardHeader><CardHeading icon={<Microscope className="h-5 w-5" />} title="Reviewer Application Required" description="Complete the JASTI reviewer application before invitations, review forms, and assigned manuscripts become available." /></CardHeader><CardContent className="space-y-6"><div className="grid gap-3 md:grid-cols-7">{stepLabels.map((label, index) => <button key={label} type="button" onClick={() => { setStep(index + 1); setValidationMessage("") }} className={cn("rounded-2xl border px-3 py-3 text-left text-sm font-medium", step === index + 1 ? "border-jostum-700 bg-jostum-50 text-jostum-800" : "border-slate-200 bg-white text-slate-600")}><p className="text-xs uppercase tracking-[0.16em]">{`Step ${index + 1}`}</p><p className="mt-2">{label}</p></button>)}</div><div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">The final editorial-office section from the reviewer form remains admin-controlled and is not shown to reviewers.</div>{validationMessage ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{validationMessage}</div> : null}{step === 1 ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><TitleSelectField value={form.title} onChange={(value)=>setForm((prev)=>({...prev,title:value}))} /><div className="space-y-2"><Label>First name</Label><Input value={form.first_name} onChange={(e)=>setForm((prev)=>({...prev,first_name:e.target.value}))} /></div><div className="space-y-2"><Label>Last name</Label><Input value={form.last_name} onChange={(e)=>setForm((prev)=>({...prev,last_name:e.target.value}))} /></div><div className="space-y-2"><Label>Gender</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.gender} onChange={(e)=>setForm((prev)=>({...prev,gender:e.target.value}))}><option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Prefer not to say">Prefer not to say</option></select></div><CountrySelectField label="Nationality" value={form.nationality} onChange={(value)=>setForm((prev)=>({...prev,nationality:value}))} countryOptions={countryOptions} countriesLoading={countriesLoading} countryLookupFailed={countryLookupFailed} placeholder="Select nationality" /><CountrySelectField label="Country of residence" value={form.country} onChange={(value)=>setForm((prev)=>({...prev,country:value}))} countryOptions={countryOptions} countriesLoading={countriesLoading} countryLookupFailed={countryLookupFailed} placeholder="Select a country" /><div className="space-y-2"><Label>Institution / Organization</Label><Input value={form.institution} onChange={(e)=>setForm((prev)=>({...prev,institution:e.target.value}))} /></div><div className="space-y-2"><Label>Department / Faculty</Label><Input value={form.department} onChange={(e)=>setForm((prev)=>({...prev,department:e.target.value}))} /></div><div className="space-y-2"><Label>Current position</Label><Input value={form.position} onChange={(e)=>setForm((prev)=>({...prev,position:e.target.value}))} /></div></div> : null}{step === 2 ? <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Institutional email</Label><Input type="email" value={form.email} onChange={(e)=>setForm((prev)=>({...prev,email:e.target.value}))} /></div><div className="space-y-2"><Label>Alternative email</Label><Input type="email" value={form.alt_email} onChange={(e)=>setForm((prev)=>({...prev,alt_email:e.target.value}))} /></div><div className="space-y-2"><Label>Phone number</Label><Input value={form.phone} onChange={(e)=>setForm((prev)=>({...prev,phone:e.target.value}))} /></div><div className="space-y-2"><Label>Whatsapp number</Label><Input value={form.whatsapp_number} onChange={(e)=>setForm((prev)=>({...prev,whatsapp_number:e.target.value}))} /></div><div className="space-y-2 md:col-span-2"><Label>Office address</Label><Textarea rows={5} value={form.office_address} onChange={(e)=>setForm((prev)=>({...prev,office_address:e.target.value}))} /></div></div> : null}{step === 3 ? <div className="space-y-4">{qualifications.map((entry, index) => <div key={index} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><Label>Degree</Label><Input value={entry.degree} onChange={(e)=>setQualifications((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, degree: e.target.value } : item))} /></div><div className="space-y-2"><Label>Field of study</Label><Input value={entry.field_of_study} onChange={(e)=>setQualifications((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, field_of_study: e.target.value } : item))} /></div><div className="space-y-2"><Label>Institution</Label><Input value={entry.institution} onChange={(e)=>setQualifications((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, institution: e.target.value } : item))} /></div><div className="space-y-2"><Label>Graduation year</Label><Input value={entry.graduation_year} onChange={(e)=>setQualifications((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, graduation_year: e.target.value } : item))} /></div></div>)}<Button type="button" variant="outline" onClick={() => setQualifications((prev) => [...prev, { degree: "", field_of_study: "", institution: "", graduation_year: "" }])}>Add qualification</Button></div> : null}{step === 4 ? <div className="space-y-4"><div className="space-y-2"><Label>Primary research areas (select up to 5)</Label><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{specializationOptions.map((option) => <label key={option} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={specializations.includes(option)} disabled={!specializations.includes(option) && specializations.length >= 5} onChange={(e)=>setSpecializations((prev)=>e.target.checked ? [...prev, option] : prev.filter((item)=>item!==option))} />{option}</label>)}</div><p className="text-xs text-slate-500">You can select up to five primary research areas.</p></div><div className="space-y-4">{expertise.map((entry, index) => <div key={index} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2"><div className="space-y-2"><Label>Research area</Label><Input value={entry.research_area} onChange={(e)=>setExpertise((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, research_area: e.target.value } : item))} /></div><div className="space-y-2"><Label>Specific keywords</Label><Input value={entry.keywords} onChange={(e)=>setExpertise((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, keywords: e.target.value } : item))} placeholder="machine learning, smart grids, IoT" /></div></div>)}<Button type="button" variant="outline" onClick={() => setExpertise((prev) => [...prev, { research_area: "", keywords: "" }])}>Add expertise row</Button></div></div> : null}{step === 5 ? <div className="space-y-4"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><Label>Google Scholar profile</Label><Input value={form.google_scholar_link} onChange={(e)=>setForm((prev)=>({...prev,google_scholar_link:e.target.value}))} /></div><div className="space-y-2"><Label>ORCID ID</Label><Input value={form.orcid_id} onChange={(e)=>setForm((prev)=>({...prev,orcid_id:e.target.value}))} /></div><div className="space-y-2"><Label>Scopus Author ID</Label><Input value={form.scopus_id} onChange={(e)=>setForm((prev)=>({...prev,scopus_id:e.target.value}))} /></div><div className="space-y-2"><Label>Web of Science Researcher ID</Label><Input value={form.researcher_id} onChange={(e)=>setForm((prev)=>({...prev,researcher_id:e.target.value}))} /></div></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Publication count</Label><Input value={form.publication_count} onChange={(e)=>setForm((prev)=>({...prev,publication_count:e.target.value}))} /></div><div className="space-y-2"><Label>Peer-reviewed publications band</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.publication_count_band} onChange={(e)=>setForm((prev)=>({...prev,publication_count_band:e.target.value}))}><option value="">Select band</option><option value="1-5">1-5</option><option value="6-15">6-15</option><option value="16-30">16-30</option><option value="30+">30+</option></select></div></div></div> : null}{step === 6 ? <div className="space-y-4"><label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.reviewer_experience} onChange={(e)=>setForm((prev)=>({...prev,reviewer_experience:e.target.checked}))} />I have previously served as a journal reviewer</label>{form.reviewer_experience ? <div className="space-y-4">{journalExperiences.map((entry, index) => <div key={index} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3"><div className="space-y-2"><Label>Journal name</Label><Input value={entry.journal_name} onChange={(e)=>setJournalExperiences((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, journal_name: e.target.value } : item))} /></div><div className="space-y-2"><Label>Publisher</Label><Input value={entry.publisher} onChange={(e)=>setJournalExperiences((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, publisher: e.target.value } : item))} /></div><div className="space-y-2"><Label>Years of service</Label><Input value={entry.years_of_service} onChange={(e)=>setJournalExperiences((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, years_of_service: e.target.value } : item))} /></div></div>)}<Button type="button" variant="outline" onClick={() => setJournalExperiences((prev) => [...prev, { journal_name: "", publisher: "", years_of_service: "" }])}>Add journal experience</Button></div> : null}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><Label>Papers reviewed band</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.papers_reviewed_band} onChange={(e)=>setForm((prev)=>({...prev,papers_reviewed_band:e.target.value}))}><option value="">Select band</option><option value="1-5">1-5</option><option value="6-15">6-15</option><option value="16-30">16-30</option><option value="30+">30+</option></select></div><div className="space-y-2"><Label>Manuscripts willing to review per year</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.manuscripts_per_year_band} onChange={(e)=>setForm((prev)=>({...prev,manuscripts_per_year_band:e.target.value}))}><option value="">Select band</option><option value="2-5">2-5</option><option value="7-12">7-12</option><option value="12-20">12-20</option></select></div><div className="space-y-2"><Label>Numeric max reviews per year</Label><Input value={form.max_reviews_per_year} onChange={(e)=>setForm((prev)=>({...prev,max_reviews_per_year:e.target.value, manuscripts_per_year: e.target.value || prev.manuscripts_per_year}))} /></div><div className="space-y-2"><Label>Preferred review timeline</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.preferred_review_time} onChange={(e)=>setForm((prev)=>({...prev,preferred_review_time:e.target.value}))}><option value="7">7 days</option><option value="14">14 days</option><option value="21">21 days</option></select></div></div><div className="grid gap-4 md:grid-cols-2"><label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.available} onChange={(e)=>setForm((prev)=>({...prev,available:e.target.checked}))} />Currently available for review assignments</label><div className="space-y-2"><Label>Last review date</Label><Input type="date" value={form.last_review_date} onChange={(e)=>setForm((prev)=>({...prev,last_review_date:e.target.value}))} /></div></div><div className="space-y-4">{conflicts.map((entry, index) => <div key={index} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3"><div className="space-y-2"><Label>Institution conflict</Label><Input value={entry.institution_conflict} onChange={(e)=>setConflicts((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, institution_conflict: e.target.value } : item))} /></div><div className="space-y-2"><Label>Author conflict</Label><Input value={entry.author_conflict} onChange={(e)=>setConflicts((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, author_conflict: e.target.value } : item))} /></div><div className="space-y-2"><Label>Notes</Label><Input value={entry.notes} onChange={(e)=>setConflicts((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, notes: e.target.value } : item))} /></div></div>)}<Button type="button" variant="outline" onClick={() => setConflicts((prev) => [...prev, { institution_conflict: "", author_conflict: "", notes: "" }])}>Add conflict entry</Button></div></div> : null}{step === 7 ? <div className="space-y-5"><div className="space-y-2"><Label>Short academic biography</Label><Textarea rows={6} value={form.bio} onChange={(e)=>setForm((prev)=>({...prev,bio:e.target.value}))} /></div><div className="grid gap-6 lg:grid-cols-3"><div className="space-y-3"><FileDropzone label="Curriculum Vitae" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" helperText="Accepted: PDF, DOC, DOCX. Maximum 10MB." file={files.cv_file} error={uploadErrors.cv_file} progress={uploadProgress > 0 ? uploadProgress : undefined} progressLabel="Uploading reviewer files" onFileSelect={(file)=>handleFileAssign("cv_file", file, ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], "Curriculum Vitae")} onRemove={()=>handleFileAssign("cv_file", null, [], "Curriculum Vitae")} />{currentCvPath ? <a href={resolveApiAssetUrl(currentCvPath)} target="_blank" rel="noreferrer" className="text-xs font-medium text-jostum-700 underline underline-offset-4">View current CV</a> : null}</div><div className="space-y-3"><FileDropzone label="List of publications" accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" helperText="Optional: PDF, DOC, DOCX, or TXT. Maximum 10MB." file={files.publication_list_file} error={uploadErrors.publication_list_file} progress={uploadProgress > 0 ? uploadProgress : undefined} progressLabel="Uploading reviewer files" onFileSelect={(file)=>handleFileAssign("publication_list_file", file, ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"], "Publication list")} onRemove={()=>handleFileAssign("publication_list_file", null, [], "Publication list")} />{currentPublicationListPath ? <a href={resolveApiAssetUrl(currentPublicationListPath)} target="_blank" rel="noreferrer" className="text-xs font-medium text-jostum-700 underline underline-offset-4">View current publication list</a> : null}</div><div className="space-y-3"><FileDropzone label="ORCID profile screenshot" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" helperText="Optional: PDF, JPG, PNG, WEBP. Maximum 10MB." file={files.orcid_screenshot_file} error={uploadErrors.orcid_screenshot_file} progress={uploadProgress > 0 ? uploadProgress : undefined} progressLabel="Uploading reviewer files" onFileSelect={(file)=>handleFileAssign("orcid_screenshot_file", file, ["application/pdf", "image/jpeg", "image/png", "image/webp"], "ORCID profile screenshot")} onRemove={()=>handleFileAssign("orcid_screenshot_file", null, [], "ORCID profile screenshot")} />{currentOrcidScreenshotPath ? <a href={resolveApiAssetUrl(currentOrcidScreenshotPath)} target="_blank" rel="noreferrer" className="text-xs font-medium text-jostum-700 underline underline-offset-4">View current ORCID file</a> : null}</div></div><div className="grid gap-3 md:grid-cols-2"><label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.confidentiality_agreed} onChange={(e)=>setForm((prev)=>({...prev,confidentiality_agreed:e.target.checked}))} />I will maintain strict confidentiality of manuscripts.</label><label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.conflict_policy_agreed} onChange={(e)=>setForm((prev)=>({...prev,conflict_policy_agreed:e.target.checked}))} />I will declare conflicts of interest before reviewing.</label><label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.ethical_review_agreed} onChange={(e)=>setForm((prev)=>({...prev,ethical_review_agreed:e.target.checked}))} />I will provide objective and constructive reviews and adhere to JASTI peer review policy.</label></div></div> : null}<div className="flex items-center justify-between gap-3"><Button type="button" variant="outline" disabled={step === 1} onClick={() => { setStep((current) => Math.max(1, current - 1)); setValidationMessage("") }}>Previous</Button><div className="flex items-center gap-3">{step < 7 ? <Button type="button" onClick={() => { const error = validateStep(step); if (error) { setValidationMessage(error); return } setValidationMessage(""); setStep((current) => Math.min(7, current + 1)) }}>Save & Continue</Button> : <Button type="button" onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Finish application"}</Button>}</div></div></CardContent></Card>
}

function ReviewerPanels({ section, workspace, onSaved }: { section: string; workspace: WorkspacePayload; onSaved: () => Promise<void> }) {
  const onboarding = workspace.reviewer?.onboarding ?? { completed: false, application: {}, qualifications: [], expertise: [], journal_experiences: [], availability: {}, conflicts: [], agreements: {}, specialization_options: [] }
  const invitations = asArray(workspace.reviewer?.invitations)
  const reviews = asArray(workspace.reviewer?.reviews)
  const activeInvitations = invitations.filter((entry) => String(entry.status ?? "").toLowerCase() !== "published")
  const acceptedInvitations = activeInvitations.filter((entry) => String(entry.response) === "accepted")
  const pendingInvitations = activeInvitations.filter((entry) => String(entry.response) === "pending")
  const createReviewForm = () => ({
    manuscript_id: "",
    recommendation: "major_revision",
    comments_to_author: "",
    confidential_comments: "",
    no_personal_conflict: false,
    no_institutional_conflict: false,
    no_financial_conflict: false,
    conflict_confirmed: false,
    confidentiality_agreed: false,
    comments_strengths: "",
    comments_weaknesses: "",
    comments_required_corrections: "",
    comments_suggestions: "",
    ethical_concerns: "",
    suspected_plagiarism: "",
    recommendation_justification: "",
    publication_risk_concerns: "",
    possible_plagiarism_detected: false,
    ai_generated_content_suspected: false,
    fabricated_data_concerns: false,
    ethical_approval_missing: false,
    citation_manipulation: false,
    duplicate_publication_suspicion: false,
    ...Object.fromEntries(reviewCriteria.map((criteria) => [criteria.key, "1"])),

    // Section A & Manuscript Info
    title_of_manuscript: "",
    date_received: new Date().toLocaleString(),
    date_reviewed: new Date().toLocaleString(),
    reviewer_code: String(workspace.user.user_id ?? ""),
    review_round: "First Review",
    declaration_no_conflict: false,
    declaration_confidentiality: false,
    declaration_objective: false,
    reviewer_signature: "",
    declaration_date: new Date().toLocaleString(),

    // Section B: ratings (values "1" to "5")
    originality_and_novelty_rating: "",
    scientific_significance_rating: "",
    technical_quality_rating: "",
    research_design_rating: "",
    methodology_rating: "",
    experimental_design_rating: "",
    statistical_analysis_rating: "",
    data_analysis_rating: "",
    interpretation_rating: "",
    practical_relevance_rating: "",

    // Section C: Title
    quality_title_rating: "",
    quality_title_comments: "",

    // Section C: Abstract
    quality_abstract_background: false,
    quality_abstract_objective: false,
    quality_abstract_methodology: false,
    quality_abstract_results: false,
    quality_abstract_conclusion: false,
    quality_abstract_keywords: false,
    quality_abstract_comments: "",

    // Section C: Introduction
    quality_intro_problem_clearly_stated: "",
    quality_intro_objectives_defined: "",
    quality_intro_gap_identified: "",
    quality_intro_contribution_stated: "",
    quality_intro_literature_introduced: "",
    quality_intro_comments: "",

    // Section C: Literature Review
    quality_literature_coverage: "",
    quality_literature_references: "",
    quality_literature_analysis: "",
    quality_literature_gap: "",
    quality_literature_comments: "",

    // Section C: Methodology
    quality_methodology_design: "",
    quality_methodology_procedure: "",
    quality_methodology_equipment: "",
    quality_methodology_model: "",
    quality_methodology_algorithm: "",
    quality_methodology_reproducibility: "",
    quality_methodology_comments: "",

    // Section C: Results
    quality_results_presented: false,
    quality_results_supported: false,
    quality_results_figures: false,
    quality_results_tables: false,
    quality_results_statistical: false,
    quality_results_reproducible: false,
    quality_results_comments: "",

    // Section C: Discussion
    quality_discussion_interpretation: "",
    quality_discussion_comparison: "",
    quality_discussion_depth: "",
    quality_discussion_implication: "",
    quality_discussion_comments: "",

    // Section C: Conclusion
    quality_conclusion_supported: false,
    quality_conclusion_not_overstated: false,
    quality_conclusion_objectives: false,
    quality_conclusion_recommendations: false,
    quality_conclusion_comments: "",

    // Section C: References
    quality_references_adequacy: "",
    quality_references_currency: "",
    quality_references_style: "",
    quality_references_completeness: "",
    quality_references_comments: "",

    // Section C: Figures and Tables
    quality_figures_high_quality: "",
    quality_figures_numbering: "",
    quality_figures_captions: "",
    quality_figures_readable: "",
    quality_figures_necessary: "",
    quality_figures_comments: "",

    // Section C: Language Assessment
    quality_language_grammar: "",
    quality_language_english: "",
    quality_language_organization: "",
    quality_language_clarity: "",
    quality_language_comments: "",

    // Section C: Ethical Compliance
    quality_ethical_no_plagiarism: "",
    quality_ethical_citations: "",
    quality_ethical_approval: "",
    quality_ethical_conflict: "",
    quality_ethical_applicable: "",
    quality_ethical_comments: "",

    // Major Strengths
    strength_1: "",
    strength_2: "",
    strength_3: "",

    // Major Weaknesses
    weakness_1: "",
    weakness_2: "",
    weakness_3: "",

    // Revisions
    comments_major_revisions: "",
    comments_minor_revisions: "",

    // Overall Score
    score_originality: "",
    score_technical_quality_10: "",
    score_methodology_10: "",
    score_literature_review_10: "",
    score_experimental_design_10: "",
    score_results_10: "",
    score_discussion_10: "",
    score_conclusion_10: "",
    score_language_10: "",
    score_contribution_10: "",
  })
  const buildCommentsToAuthor = (form: ReturnType<typeof createReviewForm>) => {
    const lines: string[] = []
    lines.push("### JASTI MANUSCRIPT EVALUATION REPORT\n")
    lines.push(`**Manuscript ID:** ${form.manuscript_id || "N/A"}`)
    lines.push(`**Title of Manuscript:** ${form.title_of_manuscript || "N/A"}`)
    lines.push(`**Date Received:** ${form.date_received || "N/A"} | **Date Reviewed:** ${form.date_reviewed || "N/A"}`)
    lines.push(`**Reviewer Code:** ${form.reviewer_code || "N/A"}`)
    lines.push(`**Review Round:** ${form.review_round}\n`)

    lines.push("---\n")
    lines.push("### SECTION A: REVIEWER DECLARATION")
    lines.push(`- No conflict of interest regarding this manuscript: ${form.declaration_no_conflict ? "✅ Confirmed" : "❌ No"}`)
    lines.push(`- Agree to maintain confidentiality: ${form.declaration_confidentiality ? "✅ Confirmed" : "❌ No"}`)
    lines.push(`- Review is objective, unbiased, and based solely on scientific merit: ${form.declaration_objective ? "✅ Confirmed" : "❌ No"}`)
    lines.push(`- Reviewer Signature (Digital): ${form.reviewer_signature || "None provided"}`)
    lines.push(`- Declaration Date: ${form.declaration_date}\n`)

    lines.push("---\n")
    lines.push("### SECTION B: GENERAL ASSESSMENT")
    const criteriaList = [
      { label: "Originality and Novelty", val: form.originality_and_novelty_rating },
      { label: "Scientific Significance", val: form.scientific_significance_rating },
      { label: "Technical Quality", val: form.technical_quality_rating },
      { label: "Research Design", val: form.research_design_rating },
      { label: "Methodology", val: form.methodology_rating },
      { label: "Experimental Design", val: form.experimental_design_rating },
      { label: "Statistical Analysis", val: form.statistical_analysis_rating },
      { label: "Data Analysis", val: form.data_analysis_rating },
      { label: "Interpretation of Results", val: form.interpretation_rating },
      { label: "Practical Relevance", val: form.practical_relevance_rating },
    ]
    criteriaList.forEach(c => {
      lines.push(`- **${c.label}:** ${c.val ? `${c.val}/5` : "Unrated"}`)
    })
    lines.push("")

    lines.push("---\n")
    lines.push("### SECTION C: MANUSCRIPT QUALITY")

    lines.push(`#### 1. Title`)
    lines.push(`- Rating: ${form.quality_title_rating || "Unrated"}`)
    lines.push(`- Comments: ${form.quality_title_comments || "None"}\n`)

    lines.push(`#### 2. Abstract`)
    const abstractCovers: string[] = []
    if (form.quality_abstract_background) abstractCovers.push("Background")
    if (form.quality_abstract_objective) abstractCovers.push("Objective")
    if (form.quality_abstract_methodology) abstractCovers.push("Methodology")
    if (form.quality_abstract_results) abstractCovers.push("Results")
    if (form.quality_abstract_conclusion) abstractCovers.push("Conclusion")
    if (form.quality_abstract_keywords) abstractCovers.push("Keywords appropriate")
    lines.push(`- Adequately covers: ${abstractCovers.join(", ") || "None declared"}`)
    lines.push(`- Comments: ${form.quality_abstract_comments || "None"}\n`)

    lines.push(`#### 3. Introduction`)
    lines.push(`- Problem clearly stated: ${form.quality_intro_problem_clearly_stated || "Unrated"}`)
    lines.push(`- Objectives clearly defined: ${form.quality_intro_objectives_defined || "Unrated"}`)
    lines.push(`- Research gap identified: ${form.quality_intro_gap_identified || "Unrated"}`)
    lines.push(`- Contribution clearly stated: ${form.quality_intro_contribution_stated || "Unrated"}`)
    lines.push(`- Literature adequately introduced: ${form.quality_intro_literature_introduced || "Unrated"}`)
    lines.push(`- Comments: ${form.quality_intro_comments || "None"}\n`)

    lines.push(`#### 4. Literature Review`)
    lines.push(`- Coverage: ${form.quality_literature_coverage || "Unrated"}`)
    lines.push(`- Recent References: ${form.quality_literature_references || "Unrated"}`)
    lines.push(`- Critical Analysis: ${form.quality_literature_analysis || "Unrated"}`)
    lines.push(`- Research Gap: ${form.quality_literature_gap || "Unrated"}`)
    lines.push(`- Comments: ${form.quality_literature_comments || "None"}\n`)

    lines.push(`#### 5. Methodology`)
    lines.push(`- Research Design: ${form.quality_methodology_design || "Unrated"}`)
    lines.push(`- Experimental Procedure: ${form.quality_methodology_procedure || "Unrated"}`)
    lines.push(`- Equipment Description: ${form.quality_methodology_equipment || "Unrated"}`)
    lines.push(`- Mathematical Model: ${form.quality_methodology_model || "Unrated"}`)
    lines.push(`- Algorithm Description: ${form.quality_methodology_algorithm || "Unrated"}`)
    lines.push(`- Reproducibility: ${form.quality_methodology_reproducibility || "Unrated"}`)
    lines.push(`- Comments: ${form.quality_methodology_comments || "None"}\n`)

    lines.push(`#### 6. Results`)
    const resultsEval: string[] = []
    if (form.quality_results_presented) resultsEval.push("Clearly presented")
    if (form.quality_results_supported) resultsEval.push("Supported by data")
    if (form.quality_results_figures) resultsEval.push("Figures appropriate")
    if (form.quality_results_tables) resultsEval.push("Tables appropriate")
    if (form.quality_results_statistical) resultsEval.push("Statistical analysis adequate")
    if (form.quality_results_reproducible) resultsEval.push("Results reproducible")
    lines.push(`- Evaluations: ${resultsEval.join(", ") || "None selected"}`)
    lines.push(`- Comments: ${form.quality_results_comments || "None"}\n`)

    lines.push(`#### 7. Discussion`)
    lines.push(`- Interpretation: ${form.quality_discussion_interpretation || "Unrated"}`)
    lines.push(`- Comparison with Literature: ${form.quality_discussion_comparison || "Unrated"}`)
    lines.push(`- Scientific Depth: ${form.quality_discussion_depth || "Unrated"}`)
    lines.push(`- Practical Implication: ${form.quality_discussion_implication || "Unrated"}`)
    lines.push(`- Comments: ${form.quality_discussion_comments || "None"}\n`)

    lines.push(`#### 8. Conclusion`)
    const conclusionEval: string[] = []
    if (form.quality_conclusion_supported) conclusionEval.push("Supported by findings")
    if (form.quality_conclusion_not_overstated) conclusionEval.push("Not overstated")
    if (form.quality_conclusion_objectives) conclusionEval.push("Research objectives achieved")
    if (form.quality_conclusion_recommendations) conclusionEval.push("Recommendations appropriate")
    lines.push(`- Evaluations: ${conclusionEval.join(", ") || "None selected"}`)
    lines.push(`- Comments: ${form.quality_conclusion_comments || "None"}\n`)

    lines.push(`#### 9. References`)
    lines.push(`- Adequacy: ${form.quality_references_adequacy || "Unrated"}`)
    lines.push(`- Currency: ${form.quality_references_currency || "Unrated"}`)
    lines.push(`- Citation Style: ${form.quality_references_style || "Unrated"}`)
    lines.push(`- Completeness: ${form.quality_references_completeness || "Unrated"}`)
    lines.push(`- Comments: ${form.quality_references_comments || "None"}\n`)

    lines.push(`#### 10. Figures and Tables`)
    lines.push(`- High quality: ${form.quality_figures_high_quality || "Unrated"}`)
    lines.push(`- Proper numbering: ${form.quality_figures_numbering || "Unrated"}`)
    lines.push(`- Appropriate captions: ${form.quality_figures_captions || "Unrated"}`)
    lines.push(`- Readable: ${form.quality_figures_readable || "Unrated"}`)
    lines.push(`- Necessary: ${form.quality_figures_necessary || "Unrated"}`)
    lines.push(`- Comments: ${form.quality_figures_comments || "None"}\n`)

    lines.push(`#### 11. Language Assessment`)
    lines.push(`- Grammar: ${form.quality_language_grammar || "Unrated"}`)
    lines.push(`- English Quality: ${form.quality_language_english || "Unrated"}`)
    lines.push(`- Organization: ${form.quality_language_organization || "Unrated"}`)
    lines.push(`- Clarity: ${form.quality_language_clarity || "Unrated"}`)
    lines.push(`- Comments: ${form.quality_language_comments || "None"}\n`)

    lines.push(`#### 12. Ethical Compliance`)
    lines.push(`- No plagiarism detected: ${form.quality_ethical_no_plagiarism || "Unrated"}`)
    lines.push(`- Proper citations: ${form.quality_ethical_citations || "Unrated"}`)
    lines.push(`- Ethical approval obtained: ${form.quality_ethical_approval || "Unrated"}`)
    lines.push(`- Conflict of interest declared: ${form.quality_ethical_conflict || "Unrated"}`)
    lines.push(`- Human/Animal ethics applicable: ${form.quality_ethical_applicable || "Unrated"}`)
    lines.push(`- Comments: ${form.quality_ethical_comments || "None"}\n`)

    lines.push("---\n")
    lines.push("### STRENGTHS & WEAKNESSES")
    lines.push("#### Major Strengths")
    if (form.strength_1) lines.push(`1. ${form.strength_1}`)
    if (form.strength_2) lines.push(`2. ${form.strength_2}`)
    if (form.strength_3) lines.push(`3. ${form.strength_3}`)
    if (!form.strength_1 && !form.strength_2 && !form.strength_3) lines.push("None provided")
    lines.push("\n#### Major Weaknesses")
    if (form.weakness_1) lines.push(`1. ${form.weakness_1}`)
    if (form.weakness_2) lines.push(`2. ${form.weakness_2}`)
    if (form.weakness_3) lines.push(`3. ${form.weakness_3}`)
    if (!form.weakness_1 && !form.weakness_2 && !form.weakness_3) lines.push("None provided")
    lines.push("")

    lines.push("---\n")
    lines.push("### DETAILED REVISION COMMENTS FOR AUTHORS")
    lines.push(`#### Major Revisions Required:`)
    lines.push(form.comments_major_revisions || "None specified")
    lines.push(`\n#### Minor Revisions Required:`)
    lines.push(form.comments_minor_revisions || "None specified")
    lines.push("")

    return lines.join("\n")
  }
  const [reviewForm, setReviewForm] = React.useState(createReviewForm)
  const [reviewScreenshot, setReviewScreenshot] = React.useState<File | null>(null)
  const [reviewPreviewOpen, setReviewPreviewOpen] = React.useState(false)
  const [formTab, setFormTab] = React.useState("info")
  const [openSectionC, setOpenSectionC] = React.useState("title")

  const selectedReviewManuscript = acceptedInvitations.find((entry) => String(entry.manuscript_id) === reviewForm.manuscript_id) ?? null
  
  React.useEffect(() => {
    if (selectedReviewManuscript) {
      setReviewForm((prev) => ({
        ...prev,
        title_of_manuscript: String(selectedReviewManuscript.title ?? ""),
        date_received: String(selectedReviewManuscript.response_date || selectedReviewManuscript.invitation_date || prev.date_received || new Date().toLocaleString()),
      }))
    }
  }, [selectedReviewManuscript])

  const totalReviewScore = [
    reviewForm.score_originality,
    reviewForm.score_technical_quality_10,
    reviewForm.score_methodology_10,
    reviewForm.score_literature_review_10,
    reviewForm.score_experimental_design_10,
    reviewForm.score_results_10,
    reviewForm.score_discussion_10,
    reviewForm.score_conclusion_10,
    reviewForm.score_language_10,
    reviewForm.score_contribution_10,
  ].reduce((sum, val) => sum + Number(val || 0), 0)

  const reviewPercent = Math.round((totalReviewScore / 100) * 10000) / 100
  const reviewDraftKey = React.useCallback((manuscriptId: string) => `jasti-review-draft-${String(workspace.user.user_id ?? "anonymous")}-${manuscriptId}`, [workspace.user.user_id])
  React.useEffect(() => {
    const manuscriptId = reviewForm.manuscript_id
    if (!manuscriptId) return
    const savedDraft = window.localStorage.getItem(reviewDraftKey(manuscriptId))
    if (!savedDraft) {
      setReviewForm({ ...createReviewForm(), manuscript_id: manuscriptId })
      setReviewScreenshot(null)
      return
    }
    try {
      const parsed = JSON.parse(savedDraft) as Record<string, unknown>
      setReviewForm((prev) => ({ ...prev, ...parsed, manuscript_id: prev.manuscript_id }))
    } catch {
    }
  }, [reviewDraftKey, reviewForm.manuscript_id])
  React.useEffect(() => {
    if (!reviewForm.manuscript_id) return
    const timeoutId = window.setTimeout(() => {
      window.localStorage.setItem(reviewDraftKey(reviewForm.manuscript_id), JSON.stringify({ ...reviewForm, saved_at: new Date().toISOString(), auto_saved: true }))
    }, 1200)
    return () => window.clearTimeout(timeoutId)
  }, [reviewDraftKey, reviewForm])
  const saveReviewDraft = () => {
    if (!reviewForm.manuscript_id) {
      toast.error("Select a manuscript before saving a draft.")
      return
    }
    window.localStorage.setItem(reviewDraftKey(reviewForm.manuscript_id), JSON.stringify({ ...reviewForm, saved_at: new Date().toISOString() }))
    toast.success("Review draft saved on this device.")
  }
  const requestReviewExtension = async () => {
    if (!selectedReviewManuscript) {
      toast.error("Select a manuscript before requesting an extension.")
      return
    }
    try {
      await respondToInvitation({ invitation_id: Number(selectedReviewManuscript.invitation_id), response: "extension_requested", extension_reason: "Reviewer requested more time from the evaluation page." })
      await onSaved()
      toast.success("Extension request sent.")
    } catch (error) {
      toast.error(errorText(error, "Unable to request extension."))
    }
  }
  const declineSelectedReview = async () => {
    if (!selectedReviewManuscript) {
      toast.error("Select a manuscript before declining.")
      return
    }
    try {
      await respondToInvitation({ invitation_id: Number(selectedReviewManuscript.invitation_id), response: "declined" })
      await onSaved()
      toast.success("Review declined.")
    } catch (error) {
      toast.error(errorText(error, "Unable to decline review."))
    }
  }
  const [saving, setSaving] = React.useState(false)
  if (section === "profile") return <ReviewerOnboardingCard onboarding={onboarding} user={workspace.user} onSaved={onSaved} />
  if (section === "invitations") return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Users className="h-5 w-5" />} title="Invitation Management" description="Accept or decline invitations before moving a manuscript into your active review queue." /></CardHeader><CardContent className="space-y-4">{activeInvitations.length ? activeInvitations.slice(0, 5).map((item)=>{ const response = String(item.response ?? "pending"); const isLocked = response !== "pending"; return <div key={String(item.invitation_id)} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4"><div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 flex-1"><p className="break-words font-semibold text-slate-900">{String(item.title ?? item.manuscript_id)}</p><p className="mt-1 break-words text-sm leading-6 text-slate-500">Response: {response} | Sent: {String(item.invitation_date ?? "")}</p></div><div className="flex flex-wrap gap-2 sm:justify-end"><Button size="sm" className="flex-1 sm:flex-none" disabled={isLocked} onClick={async ()=>{try { await respondToInvitation({ invitation_id: Number(item.invitation_id), response: "accepted" }); await onSaved(); toast.success("Invitation accepted.") } catch (error) { toast.error(errorText(error, "Unable to respond.")) }}}>{response === "accepted" ? "Accepted" : "Accept"}</Button><Button size="sm" variant="outline" className="flex-1 sm:flex-none" disabled={isLocked} onClick={async ()=>{try { await respondToInvitation({ invitation_id: Number(item.invitation_id), response: "declined" }); await onSaved(); toast.success("Invitation declined.") } catch (error) { toast.error(errorText(error, "Unable to respond.")) }}}>{response === "declined" ? "Declined" : "Decline"}</Button></div></div><div className="mt-3"><ManuscriptFileBundlePreview value={item.file_bundle} emptyMessage="No manuscript file bundle available yet." /></div></div>}) : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No active invitations available.</div>}</CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<BarChart3 className="h-5 w-5" />} title="Invitation Summary" /></CardHeader><CardContent className="grid grid-cols-2 gap-4 md:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pending</p><p className="mt-2 text-3xl font-semibold text-slate-950">{pendingInvitations.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Accepted</p><p className="mt-2 text-3xl font-semibold text-slate-950">{acceptedInvitations.length}</p></div><div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 md:col-span-1"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Completed reviews</p><p className="mt-2 text-3xl font-semibold text-slate-950">{reviews.length}</p></div><div className="col-span-2 md:col-span-3"><Table rows={activeInvitations} columns={["title", "response", "status", "invitation_date", "response_date", "file_bundle"]} /></div></CardContent></Card></div>
  if (section === "deadlines") return <div className="grid gap-6"><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Workflow className="h-5 w-5" />} title="Deadline Tracker" description="Use the invitation timeline, live remaining time, and automated reminder schedule to keep review turnaround under control." /></CardHeader><CardContent className="space-y-3">{acceptedInvitations.length ? acceptedInvitations.map((item)=><div key={String(item.invitation_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold text-slate-900">{String(item.title ?? item.manuscript_id)}</p><p className="mt-2 text-sm font-medium text-slate-900">Deadline: {deadlineCountdown(item.review_deadline)}</p><p className="mt-1 text-sm text-slate-500">Accepted on: {String(item.response_date ?? "Awaiting response date")}</p><p className="text-sm text-slate-500">Invitation sent: {String(item.invitation_date ?? "")}</p><p className="text-sm text-slate-500">Automatic email reminders are sent at 3 days, 2 days, and 1 day remaining.</p></div>) : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No accepted manuscripts are currently in your review queue.</div>}</CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<BookOpenText className="h-5 w-5" />} title="Assigned Manuscript Timeline" /></CardHeader><CardContent><Table rows={acceptedInvitations} /></CardContent></Card></div>
  if (section === "assigned") return <div className="grid gap-6"><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<BookOpenText className="h-5 w-5" />} title="Assigned Manuscripts" description="Author identities remain hidden. Review only the manuscript content, files, and editorial instructions." /></CardHeader><CardContent className="space-y-4">{acceptedInvitations.length ? acceptedInvitations.map((item)=><div key={String(item.invitation_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold text-slate-900">{String(item.title ?? item.manuscript_id)}</p><p className="mt-2 text-sm text-slate-500">Status: {String(item.status ?? "")}</p><div className="mt-3"><ManuscriptFileBundlePreview value={item.file_bundle} emptyMessage="No manuscript file bundle available yet." /></div></div>) : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No manuscripts have been assigned to you yet.</div>}</CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Workflow className="h-5 w-5" />} title="Accepted Review Queue" /></CardHeader><CardContent><Table rows={acceptedInvitations} columns={["title", "status", "invitation_date", "response_date", "file_bundle"]} /></CardContent></Card></div>
  if (["evaluation", "recommendation", "comments"].includes(section)) return <div className="grid gap-6">
    <Card className="border-white/70 bg-white/85 backdrop-blur">
      <CardHeader><CardTitle>Review Evaluation Form</CardTitle><CardDescription>Complete declarations, scoring, author comments, confidential editor notes, and ethical checks before submitting.</CardDescription></CardHeader>
      <CardContent>
        {/* Navigation Tabs inside the Evaluation Form Card */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 mb-6">
          {[
            { id: "info", label: "1. Manuscript & Decl" },
            { id: "general", label: "2. General Assessment" },
            { id: "quality", label: "3. Manuscript Quality" },
            { id: "strengths", label: "4. Strengths & Revisions" },
            { id: "score", label: "5. Score & Submit" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFormTab(tab.id)}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200",
                formTab === tab.id
                  ? "bg-jostum-600 text-white shadow-md shadow-jostum-600/20 font-semibold"
                  : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/90"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form className="space-y-6" onSubmit={async (e)=>{
          e.preventDefault()
          if (!reviewForm.manuscript_id) {
            toast.error("Select a manuscript before submitting your review.")
            return
          }
          if (!reviewForm.declaration_no_conflict || !reviewForm.declaration_confidentiality || !reviewForm.declaration_objective) {
            toast.error("Conflict of interest and confidentiality declarations are required before submitting a review.")
            return
          }

          // Validate overall scores are filled
          const requiredScores = [
            { val: reviewForm.score_originality, label: "Originality" },
            { val: reviewForm.score_technical_quality_10, label: "Technical Quality" },
            { val: reviewForm.score_methodology_10, label: "Methodology" },
            { val: reviewForm.score_literature_review_10, label: "Literature Review" },
            { val: reviewForm.score_experimental_design_10, label: "Experimental Design" },
            { val: reviewForm.score_results_10, label: "Results" },
            { val: reviewForm.score_discussion_10, label: "Discussion" },
            { val: reviewForm.score_conclusion_10, label: "Conclusion" },
            { val: reviewForm.score_language_10, label: "Language" },
            { val: reviewForm.score_contribution_10, label: "Overall Contribution" },
          ]
          const missingScores = requiredScores.filter(s => !s.val || Number(s.val) < 1 || Number(s.val) > 10)
          if (missingScores.length > 0) {
            toast.error(`Please provide overall scores (1-10) for: ${missingScores.map(m => m.label).join(", ")}`)
            return
          }

          setSaving(true)
          try {
            const submittedManuscriptId = reviewForm.manuscript_id
            const payload = new FormData()
            
            // Build the formatted comments_to_author report
            const formattedCommentsReport = buildCommentsToAuthor(reviewForm)
            
            // Populate all fields from the reviewForm state
            Object.entries(reviewForm).forEach(([key, value]) => {
              payload.append(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value))
            })
            
            // Explicitly overwrite/add core parameters
            payload.set("manuscript_id", String(Number(reviewForm.manuscript_id)))
            payload.set("comments_to_author", formattedCommentsReport)
            
            // Format strengths and weaknesses lists for standard columns
            const strengthsText = [reviewForm.strength_1, reviewForm.strength_2, reviewForm.strength_3].filter(Boolean).map((s, i) => `${i+1}. ${s}`).join("\n")
            const weaknessesText = [reviewForm.weakness_1, reviewForm.weakness_2, reviewForm.weakness_3].filter(Boolean).map((w, i) => `${i+1}. ${w}`).join("\n")
            
            payload.set("comments_strengths", strengthsText)
            payload.set("comments_weaknesses", weaknessesText)
            payload.set("comments_required_corrections", reviewForm.comments_major_revisions)
            payload.set("comments_suggestions", reviewForm.comments_minor_revisions)

            // Declarations mapping for PHP validation passing:
            payload.set("no_personal_conflict", "1")
            payload.set("no_institutional_conflict", "1")
            payload.set("no_financial_conflict", "1")
            payload.set("conflict_confirmed", "1")
            payload.set("confidentiality_agreed", "1")

            // Map standard 11 criteria scores for backend PHP validations (must be between 1 and 10)
            const mappedScores = {
              score_novelty: Math.max(1, Math.min(10, Number(reviewForm.score_originality || 5))),
              score_relevance: Math.max(1, Math.min(10, Number(reviewForm.score_experimental_design_10 || 5))),
              score_technical_quality: Math.max(1, Math.min(10, Number(reviewForm.score_technical_quality_10 || 5))),
              score_methodology: Math.max(1, Math.min(10, Number(reviewForm.score_methodology_10 || 5))),
              score_literature_review: Math.max(1, Math.min(10, Number(reviewForm.score_literature_review_10 || 5))),
              score_data_analysis: Math.max(1, Math.min(10, Number(reviewForm.score_results_10 || 5))),
              score_clarity: Math.max(1, Math.min(10, Number(reviewForm.score_discussion_10 || 5))),
              score_references_quality: Math.max(1, Math.min(10, Number(reviewForm.score_conclusion_10 || 5))),
              score_grammar_language: Math.max(1, Math.min(10, Number(reviewForm.score_language_10 || 5))),
              score_ethical_compliance: 10,
              score_contribution: Math.max(1, Math.min(10, Number(reviewForm.score_contribution_10 || 5))),
            }
            Object.entries(mappedScores).forEach(([key, val]) => {
              payload.set(key, String(val))
            })

            if (reviewScreenshot) payload.append("screenshot_attachment", reviewScreenshot)
            
            await submitReview(payload as unknown as Record<string, unknown>)
            window.localStorage.removeItem(reviewDraftKey(submittedManuscriptId))
            setReviewForm(createReviewForm())
            setReviewScreenshot(null)
            await onSaved()
            toast.success("Review submitted successfully.")
          } catch (error) {
            toast.error(errorText(error, "Unable to submit review."))
          } finally {
            setSaving(false)
          }
        }}>

          {/* TAB 1: Manuscript Info & Declaration */}
          {formTab === "info" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Accepted invitation manuscript</Label>
                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={reviewForm.manuscript_id} onChange={(e)=>setReviewForm((p)=>({...p,manuscript_id:e.target.value}))}>
                  <option value="">Select manuscript</option>
                  {acceptedInvitations.map((entry)=><option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>{String(entry.title ?? entry.manuscript_id)}</option>)}
                </select>
              </div>

              {selectedReviewManuscript ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">{String(selectedReviewManuscript.title ?? selectedReviewManuscript.manuscript_id)}</p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                    <p>Submission date: <span className="font-semibold text-slate-900">{String(selectedReviewManuscript.submission_date ?? "Not recorded")}</span></p>
                    <p>Review deadline: <span className="font-semibold text-slate-900">{deadlineCountdown(selectedReviewManuscript.review_deadline)}</span></p>
                    <p>Review model: <span className="font-semibold text-slate-900">{reviewModelLabels[String(selectedReviewManuscript.review_model ?? "single_blind")] ?? String(selectedReviewManuscript.review_model ?? "Single blind")}</span></p>
                    <p>Article type: <span className="font-semibold text-slate-900">{String(selectedReviewManuscript.article_type ?? "Not specified")}</span></p>
                  </div>
                  <div className="mt-3"><ManuscriptFileBundlePreview value={selectedReviewManuscript.file_bundle} emptyMessage="No manuscript file bundle available yet." /></div>
                  <div className="mt-3"><ManuscriptFileBundlePreview value={selectedReviewManuscript.previous_revision_files} emptyMessage="No previous revision files available." /></div>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2 border-t border-slate-100 pt-4">
                <div className="space-y-2">
                  <Label>Manuscript ID</Label>
                  <Input readOnly value={reviewForm.manuscript_id || ""} placeholder="Select manuscript above" />
                </div>
                <div className="space-y-2">
                  <Label>Title of Manuscript</Label>
                  <Input readOnly value={reviewForm.title_of_manuscript || ""} placeholder="Select manuscript above" />
                </div>
                <div className="space-y-2">
                  <Label>Date Received</Label>
                  <Input type="text" value={reviewForm.date_received || ""} onChange={(e)=>setReviewForm((p)=>({...p,date_received:e.target.value}))} />
                </div>
                <div className="space-y-2">
                  <Label>Date Reviewed</Label>
                  <Input type="text" value={reviewForm.date_reviewed} onChange={(e)=>setReviewForm((p)=>({...p,date_reviewed:e.target.value}))} />
                </div>
                <div className="space-y-2">
                  <Label>Reviewer Code</Label>
                  <Input value={reviewForm.reviewer_code} onChange={(e)=>setReviewForm((p)=>({...p,reviewer_code:e.target.value}))} />
                </div>
                <div className="space-y-2">
                  <Label>Review Round</Label>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={reviewForm.review_round} onChange={(e)=>setReviewForm((p)=>({...p,review_round:e.target.value}))}>
                    <option value="First Review">First Review</option>
                    <option value="Second Review">Second Review</option>
                    <option value="Third Review">Third Review</option>
                    <option value="Final Review">Final Review</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-6 space-y-4">
                <p className="font-bold text-slate-800 text-sm tracking-wide">SECTION A: REVIEWER DECLARATION</p>
                <p className="text-sm text-slate-600">I hereby declare that:</p>
                <div className="space-y-3">
                  {[
                    { key: "declaration_no_conflict", label: "I have no conflict of interest regarding this manuscript." },
                    { key: "declaration_confidentiality", label: "I agree to maintain confidentiality." },
                    { key: "declaration_objective", label: "The review is objective, unbiased, and based solely on scientific merit." }
                  ].map((item) => (
                    <label key={item.key} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 select-none cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={Boolean(reviewForm[item.key as keyof typeof reviewForm])}
                        onChange={(e)=>setReviewForm((p)=>({...p,[item.key]:e.target.checked}))}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2 mt-4">
                  <div className="space-y-2">
                    <Label>Reviewer Signature (Optional)</Label>
                    <Input value={reviewForm.reviewer_signature} onChange={(e)=>setReviewForm((p)=>({...p,reviewer_signature:e.target.value}))} placeholder="Type name to sign digitally" />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="text" value={reviewForm.declaration_date} onChange={(e)=>setReviewForm((p)=>({...p,declaration_date:e.target.value}))} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-slate-100">
                <Button type="button" onClick={() => setFormTab("general")}>Next Step</Button>
              </div>
            </div>
          )}

          {/* TAB 2: General Assessment */}
          {formTab === "general" && (
            <div className="space-y-4">
              <p className="font-bold text-slate-800 text-sm tracking-wide">SECTION B: GENERAL ASSESSMENT</p>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm text-left text-slate-500 border-collapse min-w-[700px]">
                  <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th scope="col" className="px-6 py-4 font-semibold text-slate-900">Evaluation Criterion</th>
                      <th scope="col" className="px-4 py-4 text-center font-semibold text-slate-900 w-28">Excellent (5)</th>
                      <th scope="col" className="px-4 py-4 text-center font-semibold text-slate-900 w-28">Good (4)</th>
                      <th scope="col" className="px-4 py-4 text-center font-semibold text-slate-900 w-28">Fair (3)</th>
                      <th scope="col" className="px-4 py-4 text-center font-semibold text-slate-900 w-28">Poor (2)</th>
                      <th scope="col" className="px-4 py-4 text-center font-semibold text-slate-900 w-28">Very Poor (1)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {[
                      { key: "originality_and_novelty_rating", label: "Originality and Novelty" },
                      { key: "scientific_significance_rating", label: "Scientific Significance" },
                      { key: "technical_quality_rating", label: "Technical Quality" },
                      { key: "research_design_rating", label: "Research Design" },
                      { key: "methodology_rating", label: "Methodology" },
                      { key: "experimental_design_rating", label: "Experimental Design" },
                      { key: "statistical_analysis_rating", label: "Statistical Analysis" },
                      { key: "data_analysis_rating", label: "Data Analysis" },
                      { key: "interpretation_rating", label: "Interpretation of Results" },
                      { key: "practical_relevance_rating", label: "Practical Relevance" },
                    ].map((item) => (
                      <tr key={item.key} className="bg-white hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">{item.label}</td>
                        {[5, 4, 3, 2, 1].map((val) => (
                          <td key={val} className="px-4 py-4 text-center">
                            <input
                              type="radio"
                              name={item.key}
                              value={String(val)}
                              checked={reviewForm[item.key as keyof typeof reviewForm] === String(val)}
                              onChange={(e)=>setReviewForm((p)=>({...p,[item.key]:e.target.value}))}
                              className="h-4 w-4 text-jostum-600 border-slate-300 focus:ring-jostum-500 cursor-pointer"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between pt-6 border-t border-slate-100 mt-6">
                <Button type="button" variant="outline" onClick={() => setFormTab("info")}>Previous</Button>
                <Button type="button" onClick={() => setFormTab("quality")}>Next Step</Button>
              </div>
            </div>
          )}

          {/* TAB 3: Manuscript Quality */}
          {formTab === "quality" && (
            <div className="space-y-4">
              <p className="font-bold text-slate-800 text-sm tracking-wide">SECTION C: MANUSCRIPT QUALITY</p>
              <div className="space-y-3">
                {[
                  {
                    id: "title",
                    label: "1. Title",
                    content: (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-slate-700">Rate the Title</Label>
                          <div className="flex flex-wrap gap-4">
                            {["Excellent", "Good", "Fair", "Poor"].map((opt) => (
                              <label key={opt} className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="radio"
                                  name="quality_title_rating"
                                  value={opt}
                                  checked={reviewForm.quality_title_rating === opt}
                                  onChange={(e)=>setReviewForm((p)=>({...p,quality_title_rating:e.target.value}))}
                                  className="h-4 w-4 text-jostum-600 border-slate-300 focus:ring-jostum-500"
                                />
                                <span className="text-sm text-slate-700">{opt}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700">Comments</Label>
                          <Textarea rows={3} value={reviewForm.quality_title_comments} onChange={(e)=>setReviewForm((p)=>({...p,quality_title_comments:e.target.value}))} placeholder="Enter comments here..." />
                        </div>
                      </div>
                    )
                  },
                  {
                    id: "abstract",
                    label: "2. Abstract",
                    content: (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-slate-700">Please assess whether the abstract adequately covers:</Label>
                          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                            {[
                              { key: "quality_abstract_background", label: "Background" },
                              { key: "quality_abstract_objective", label: "Objective" },
                              { key: "quality_abstract_methodology", label: "Methodology" },
                              { key: "quality_abstract_results", label: "Results" },
                              { key: "quality_abstract_conclusion", label: "Conclusion" },
                              { key: "quality_abstract_keywords", label: "Keywords appropriate" }
                            ].map((chk) => (
                              <label key={chk.key} className="flex items-center gap-2.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={Boolean(reviewForm[chk.key as keyof typeof reviewForm])}
                                  onChange={(e)=>setReviewForm((p)=>({...p,[chk.key]:e.target.checked}))}
                                  className="rounded border-slate-300 text-jostum-600 focus:ring-jostum-500"
                                />
                                <span className="text-sm text-slate-700">{chk.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700">Comments</Label>
                          <Textarea rows={3} value={reviewForm.quality_abstract_comments} onChange={(e)=>setReviewForm((p)=>({...p,quality_abstract_comments:e.target.value}))} placeholder="Enter comments here..." />
                        </div>
                      </div>
                    )
                  },
                  {
                    id: "introduction",
                    label: "3. Introduction",
                    content: (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-slate-700">Rate the following:</Label>
                          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-sm text-left text-slate-500 border-collapse">
                              <thead className="text-xs text-slate-700 bg-slate-50 border-b border-slate-200">
                                <tr>
                                  <th className="px-4 py-3 font-semibold text-slate-900">Item</th>
                                  <th className="px-4 py-3 text-center font-semibold text-slate-900 w-24">Yes</th>
                                  <th className="px-4 py-3 text-center font-semibold text-slate-900 w-24">No</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {[
                                  { key: "quality_intro_problem_clearly_stated", label: "Problem clearly stated" },
                                  { key: "quality_intro_objectives_defined", label: "Objectives clearly defined" },
                                  { key: "quality_intro_gap_identified", label: "Research gap identified" },
                                  { key: "quality_intro_contribution_stated", label: "Contribution clearly stated" },
                                  { key: "quality_intro_literature_introduced", label: "Literature adequately introduced" },
                                ].map((row) => (
                                  <tr key={row.key} className="bg-white hover:bg-slate-50/55">
                                    <td className="px-4 py-2.5 font-medium text-slate-900">{row.label}</td>
                                    {["Yes", "No"].map((val) => (
                                      <td key={val} className="px-4 py-2.5 text-center">
                                        <input
                                          type="radio"
                                          name={row.key}
                                          value={val}
                                          checked={reviewForm[row.key as keyof typeof reviewForm] === val}
                                          onChange={(e)=>setReviewForm((p)=>({...p,[row.key]:e.target.value}))}
                                          className="h-4 w-4 text-jostum-600 border-slate-300 focus:ring-jostum-500 cursor-pointer"
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700">Comments</Label>
                          <Textarea rows={3} value={reviewForm.quality_intro_comments} onChange={(e)=>setReviewForm((p)=>({...p,quality_intro_comments:e.target.value}))} placeholder="Enter comments here..." />
                        </div>
                      </div>
                    )
                  },
                  {
                    id: "literature",
                    label: "4. Literature Review",
                    content: (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-slate-700">Rate:</Label>
                          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-sm text-left text-slate-500 border-collapse">
                              <thead className="text-xs text-slate-700 bg-slate-50 border-b border-slate-200">
                                <tr>
                                  <th className="px-4 py-3 font-semibold text-slate-900">Criterion</th>
                                  {["Excellent", "Good", "Fair", "Poor"].map((opt) => (
                                    <th key={opt} className="px-4 py-3 text-center font-semibold text-slate-900 w-24">{opt}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {[
                                  { key: "quality_literature_coverage", label: "Coverage" },
                                  { key: "quality_literature_references", label: "Recent References" },
                                  { key: "quality_literature_analysis", label: "Critical Analysis" },
                                  { key: "quality_literature_gap", label: "Research Gap" },
                                ].map((row) => (
                                  <tr key={row.key} className="bg-white hover:bg-slate-50/50">
                                    <td className="px-4 py-2.5 font-medium text-slate-900">{row.label}</td>
                                    {["Excellent", "Good", "Fair", "Poor"].map((val) => (
                                      <td key={val} className="px-4 py-2.5 text-center">
                                        <input
                                          type="radio"
                                          name={row.key}
                                          value={val}
                                          checked={reviewForm[row.key as keyof typeof reviewForm] === val}
                                          onChange={(e)=>setReviewForm((p)=>({...p,[row.key]:e.target.value}))}
                                          className="h-4 w-4 text-jostum-600 border-slate-300 focus:ring-jostum-500 cursor-pointer"
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700">Comments</Label>
                          <Textarea rows={3} value={reviewForm.quality_literature_comments} onChange={(e)=>setReviewForm((p)=>({...p,quality_literature_comments:e.target.value}))} placeholder="Enter comments here..." />
                        </div>
                      </div>
                    )
                  },
                  {
                    id: "methodology",
                    label: "5. Methodology",
                    content: (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-slate-700">Please evaluate:</Label>
                          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-sm text-left text-slate-500 border-collapse">
                              <thead className="text-xs text-slate-700 bg-slate-50 border-b border-slate-200">
                                <tr>
                                  <th className="px-4 py-3 font-semibold text-slate-900">Criterion</th>
                                  {["Excellent", "Good", "Fair", "Poor"].map((opt) => (
                                    <th key={opt} className="px-4 py-3 text-center font-semibold text-slate-900 w-24">{opt}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {[
                                  { key: "quality_methodology_design", label: "Research Design" },
                                  { key: "quality_methodology_procedure", label: "Experimental Procedure" },
                                  { key: "quality_methodology_equipment", label: "Equipment Description" },
                                  { key: "quality_methodology_model", label: "Mathematical Model" },
                                  { key: "quality_methodology_algorithm", label: "Algorithm Description" },
                                  { key: "quality_methodology_reproducibility", label: "Reproducibility" },
                                ].map((row) => (
                                  <tr key={row.key} className="bg-white hover:bg-slate-50/50">
                                    <td className="px-4 py-2.5 font-medium text-slate-900">{row.label}</td>
                                    {["Excellent", "Good", "Fair", "Poor"].map((val) => (
                                      <td key={val} className="px-4 py-2.5 text-center">
                                        <input
                                          type="radio"
                                          name={row.key}
                                          value={val}
                                          checked={reviewForm[row.key as keyof typeof reviewForm] === val}
                                          onChange={(e)=>setReviewForm((p)=>({...p,[row.key]:e.target.value}))}
                                          className="h-4 w-4 text-jostum-600 border-slate-300 focus:ring-jostum-500 cursor-pointer"
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700">Comments</Label>
                          <Textarea rows={3} value={reviewForm.quality_methodology_comments} onChange={(e)=>setReviewForm((p)=>({...p,quality_methodology_comments:e.target.value}))} placeholder="Enter comments here..." />
                        </div>
                      </div>
                    )
                  },
                  {
                    id: "results",
                    label: "6. Results",
                    content: (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-slate-700">Evaluate:</Label>
                          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                            {[
                              { key: "quality_results_presented", label: "Clearly presented" },
                              { key: "quality_results_supported", label: "Supported by data" },
                              { key: "quality_results_figures", label: "Figures appropriate" },
                              { key: "quality_results_tables", label: "Tables appropriate" },
                              { key: "quality_results_statistical", label: "Statistical analysis adequate" },
                              { key: "quality_results_reproducible", label: "Results reproducible" }
                            ].map((chk) => (
                              <label key={chk.key} className="flex items-center gap-2.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={Boolean(reviewForm[chk.key as keyof typeof reviewForm])}
                                  onChange={(e)=>setReviewForm((p)=>({...p,[chk.key]:e.target.checked}))}
                                  className="rounded border-slate-300 text-jostum-600 focus:ring-jostum-500"
                                />
                                <span className="text-sm text-slate-700">{chk.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700">Comments</Label>
                          <Textarea rows={3} value={reviewForm.quality_results_comments} onChange={(e)=>setReviewForm((p)=>({...p,quality_results_comments:e.target.value}))} placeholder="Enter comments here..." />
                        </div>
                      </div>
                    )
                  },
                  {
                    id: "discussion",
                    label: "7. Discussion",
                    content: (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-slate-700">Please rate:</Label>
                          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-sm text-left text-slate-500 border-collapse">
                              <thead className="text-xs text-slate-700 bg-slate-50 border-b border-slate-200">
                                <tr>
                                  <th className="px-4 py-3 font-semibold text-slate-900">Criterion</th>
                                  {["Excellent", "Good", "Fair", "Poor"].map((opt) => (
                                    <th key={opt} className="px-4 py-3 text-center font-semibold text-slate-900 w-24">{opt}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {[
                                  { key: "quality_discussion_interpretation", label: "Interpretation" },
                                  { key: "quality_discussion_comparison", label: "Comparison with Literature" },
                                  { key: "quality_discussion_depth", label: "Scientific Depth" },
                                  { key: "quality_discussion_implication", label: "Practical Implication" },
                                ].map((row) => (
                                  <tr key={row.key} className="bg-white hover:bg-slate-50/50">
                                    <td className="px-4 py-2.5 font-medium text-slate-900">{row.label}</td>
                                    {["Excellent", "Good", "Fair", "Poor"].map((val) => (
                                      <td key={val} className="px-4 py-2.5 text-center">
                                        <input
                                          type="radio"
                                          name={row.key}
                                          value={val}
                                          checked={reviewForm[row.key as keyof typeof reviewForm] === val}
                                          onChange={(e)=>setReviewForm((p)=>({...p,[row.key]:e.target.value}))}
                                          className="h-4 w-4 text-jostum-600 border-slate-300 focus:ring-jostum-500 cursor-pointer"
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700">Comments</Label>
                          <Textarea rows={3} value={reviewForm.quality_discussion_comments} onChange={(e)=>setReviewForm((p)=>({...p,quality_discussion_comments:e.target.value}))} placeholder="Enter comments here..." />
                        </div>
                      </div>
                    )
                  },
                  {
                    id: "conclusion",
                    label: "8. Conclusion",
                    content: (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-slate-700">Evaluate:</Label>
                          <div className="grid gap-3 grid-cols-2 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                            {[
                              { key: "quality_conclusion_supported", label: "Supported by findings" },
                              { key: "quality_conclusion_not_overstated", label: "Not overstated" },
                              { key: "quality_conclusion_objectives", label: "Research objectives achieved" },
                              { key: "quality_conclusion_recommendations", label: "Recommendations appropriate" }
                            ].map((chk) => (
                              <label key={chk.key} className="flex items-center gap-2.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={Boolean(reviewForm[chk.key as keyof typeof reviewForm])}
                                  onChange={(e)=>setReviewForm((p)=>({...p,[chk.key]:e.target.checked}))}
                                  className="rounded border-slate-300 text-jostum-600 focus:ring-jostum-500"
                                />
                                <span className="text-sm text-slate-700">{chk.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700">Comments</Label>
                          <Textarea rows={3} value={reviewForm.quality_conclusion_comments} onChange={(e)=>setReviewForm((p)=>({...p,quality_conclusion_comments:e.target.value}))} placeholder="Enter comments here..." />
                        </div>
                      </div>
                    )
                  },
                  {
                    id: "references",
                    label: "9. References",
                    content: (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-slate-700">Please evaluate:</Label>
                          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-sm text-left text-slate-500 border-collapse">
                              <thead className="text-xs text-slate-700 bg-slate-50 border-b border-slate-200">
                                <tr>
                                  <th className="px-4 py-3 font-semibold text-slate-900">Criterion</th>
                                  {["Excellent", "Good", "Fair", "Poor"].map((opt) => (
                                    <th key={opt} className="px-4 py-3 text-center font-semibold text-slate-900 w-24">{opt}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {[
                                  { key: "quality_references_adequacy", label: "Adequacy" },
                                  { key: "quality_references_currency", label: "Currency" },
                                  { key: "quality_references_style", label: "Citation Style" },
                                  { key: "quality_references_completeness", label: "Completeness" },
                                ].map((row) => (
                                  <tr key={row.key} className="bg-white hover:bg-slate-50/50">
                                    <td className="px-4 py-2.5 font-medium text-slate-900">{row.label}</td>
                                    {["Excellent", "Good", "Fair", "Poor"].map((val) => (
                                      <td key={val} className="px-4 py-2.5 text-center">
                                        <input
                                          type="radio"
                                          name={row.key}
                                          value={val}
                                          checked={reviewForm[row.key as keyof typeof reviewForm] === val}
                                          onChange={(e)=>setReviewForm((p)=>({...p,[row.key]:e.target.value}))}
                                          className="h-4 w-4 text-jostum-600 border-slate-300 focus:ring-jostum-500 cursor-pointer"
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700">Comments</Label>
                          <Textarea rows={3} value={reviewForm.quality_references_comments} onChange={(e)=>setReviewForm((p)=>({...p,quality_references_comments:e.target.value}))} placeholder="Enter comments here..." />
                        </div>
                      </div>
                    )
                  },
                  {
                    id: "figures",
                    label: "10. Figures and Tables",
                    content: (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-slate-700">Evaluate:</Label>
                          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-sm text-left text-slate-500 border-collapse">
                              <thead className="text-xs text-slate-700 bg-slate-50 border-b border-slate-200">
                                <tr>
                                  <th className="px-4 py-3 font-semibold text-slate-900">Item</th>
                                  <th className="px-4 py-3 text-center font-semibold text-slate-900 w-24">Yes</th>
                                  <th className="px-4 py-3 text-center font-semibold text-slate-900 w-24">No</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {[
                                  { key: "quality_figures_high_quality", label: "High quality" },
                                  { key: "quality_figures_numbering", label: "Proper numbering" },
                                  { key: "quality_figures_captions", label: "Appropriate captions" },
                                  { key: "quality_figures_readable", label: "Readable" },
                                  { key: "quality_figures_necessary", label: "Necessary" },
                                ].map((row) => (
                                  <tr key={row.key} className="bg-white hover:bg-slate-50/50">
                                    <td className="px-4 py-2.5 font-medium text-slate-900">{row.label}</td>
                                    {["Yes", "No"].map((val) => (
                                      <td key={val} className="px-4 py-2.5 text-center">
                                        <input
                                          type="radio"
                                          name={row.key}
                                          value={val}
                                          checked={reviewForm[row.key as keyof typeof reviewForm] === val}
                                          onChange={(e)=>setReviewForm((p)=>({...p,[row.key]:e.target.value}))}
                                          className="h-4 w-4 text-jostum-600 border-slate-300 focus:ring-jostum-500 cursor-pointer"
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700">Comments</Label>
                          <Textarea rows={3} value={reviewForm.quality_figures_comments} onChange={(e)=>setReviewForm((p)=>({...p,quality_figures_comments:e.target.value}))} placeholder="Enter comments here..." />
                        </div>
                      </div>
                    )
                  },
                  {
                    id: "language",
                    label: "11. Language Assessment",
                    content: (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-slate-700">Please rate:</Label>
                          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-sm text-left text-slate-500 border-collapse">
                              <thead className="text-xs text-slate-700 bg-slate-50 border-b border-slate-200">
                                <tr>
                                  <th className="px-4 py-3 font-semibold text-slate-900">Criterion</th>
                                  {["Excellent", "Good", "Fair", "Poor"].map((opt) => (
                                    <th key={opt} className="px-4 py-3 text-center font-semibold text-slate-900 w-24">{opt}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {[
                                  { key: "quality_language_grammar", label: "Grammar" },
                                  { key: "quality_language_english", label: "English Quality" },
                                  { key: "quality_language_organization", label: "Organization" },
                                  { key: "quality_language_clarity", label: "Clarity" },
                                ].map((row) => (
                                  <tr key={row.key} className="bg-white hover:bg-slate-50/50">
                                    <td className="px-4 py-2.5 font-medium text-slate-900">{row.label}</td>
                                    {["Excellent", "Good", "Fair", "Poor"].map((val) => (
                                      <td key={val} className="px-4 py-2.5 text-center">
                                        <input
                                          type="radio"
                                          name={row.key}
                                          value={val}
                                          checked={reviewForm[row.key as keyof typeof reviewForm] === val}
                                          onChange={(e)=>setReviewForm((p)=>({...p,[row.key]:e.target.value}))}
                                          className="h-4 w-4 text-jostum-600 border-slate-300 focus:ring-jostum-500 cursor-pointer"
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700">Comments</Label>
                          <Textarea rows={3} value={reviewForm.quality_language_comments} onChange={(e)=>setReviewForm((p)=>({...p,quality_language_comments:e.target.value}))} placeholder="Enter comments here..." />
                        </div>
                      </div>
                    )
                  },
                  {
                    id: "ethics",
                    label: "12. Ethical Compliance",
                    content: (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-slate-700">Please indicate whether the manuscript complies with the following:</Label>
                          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-sm text-left text-slate-500 border-collapse">
                              <thead className="text-xs text-slate-700 bg-slate-50 border-b border-slate-200">
                                <tr>
                                  <th className="px-4 py-3 font-semibold text-slate-900">Item</th>
                                  {["Yes", "No", "N/A"].map((opt) => (
                                    <th key={opt} className="px-4 py-3 text-center font-semibold text-slate-900 w-20">{opt}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {[
                                  { key: "quality_ethical_no_plagiarism", label: "No plagiarism detected" },
                                  { key: "quality_ethical_citations", label: "Proper citations" },
                                  { key: "quality_ethical_approval", label: "Ethical approval obtained" },
                                  { key: "quality_ethical_conflict", label: "Conflict of interest declared" },
                                  { key: "quality_ethical_applicable", label: "Human/Animal ethics applicable" },
                                ].map((row) => (
                                  <tr key={row.key} className="bg-white hover:bg-slate-50/50">
                                    <td className="px-4 py-2.5 font-medium text-slate-900">{row.label}</td>
                                    {["Yes", "No", "N/A"].map((val) => (
                                      <td key={val} className="px-4 py-2.5 text-center">
                                        <input
                                          type="radio"
                                          name={row.key}
                                          value={val}
                                          checked={reviewForm[row.key as keyof typeof reviewForm] === val}
                                          onChange={(e)=>setReviewForm((p)=>({...p,[row.key]:e.target.value}))}
                                          className="h-4 w-4 text-jostum-600 border-slate-300 focus:ring-jostum-500 cursor-pointer"
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700">Comments</Label>
                          <Textarea rows={3} value={reviewForm.quality_ethical_comments} onChange={(e)=>setReviewForm((p)=>({...p,quality_ethical_comments:e.target.value}))} placeholder="Enter comments here..." />
                        </div>
                      </div>
                    )
                  }
                ].map((sec) => {
                  const isOpen = openSectionC === sec.id
                  return (
                    <div key={sec.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOpenSectionC(isOpen ? "" : sec.id)}
                        className="flex w-full items-center justify-between bg-slate-50/60 px-5 py-3 text-left font-medium text-slate-800 hover:bg-slate-100/50 transition-colors"
                      >
                        <span className="text-sm font-semibold text-slate-700">{sec.label}</span>
                        <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform duration-200", isOpen && "rotate-180")} />
                      </button>
                      {isOpen ? <div className="p-5 border-t border-slate-100 bg-white space-y-4">{sec.content}</div> : null}
                    </div>
                  )
                })}
              </div>

              <div className="flex justify-between pt-6 border-t border-slate-100 mt-6">
                <Button type="button" variant="outline" onClick={() => setFormTab("general")}>Previous</Button>
                <Button type="button" onClick={() => setFormTab("strengths")}>Next Step</Button>
              </div>
            </div>
          )}

          {/* TAB 4: Strengths & Revisions */}
          {formTab === "strengths" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="font-bold text-slate-800 text-sm tracking-wide">Major Strengths (Optional)</p>
                <div className="space-y-3">
                  {[
                    { key: "strength_1", label: "1." },
                    { key: "strength_2", label: "2." },
                    { key: "strength_3", label: "3." }
                  ].map((item) => (
                    <div key={item.key} className="flex gap-3 items-center">
                      <span className="text-sm font-semibold text-slate-500 w-4">{item.label}</span>
                      <Input
                        value={reviewForm[item.key as keyof typeof reviewForm] as string}
                        onChange={(e)=>setReviewForm((p)=>({...p,[item.key]:e.target.value}))}
                        placeholder={`Enter major strength ${item.label.replace('.', '')} (Optional)`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 mt-6">
                <p className="font-bold text-slate-800 text-sm tracking-wide">Major Weaknesses (Optional)</p>
                <div className="space-y-3">
                  {[
                    { key: "weakness_1", label: "1." },
                    { key: "weakness_2", label: "2." },
                    { key: "weakness_3", label: "3." }
                  ].map((item) => (
                    <div key={item.key} className="flex gap-3 items-center">
                      <span className="text-sm font-semibold text-slate-500 w-4">{item.label}</span>
                      <Input
                        value={reviewForm[item.key as keyof typeof reviewForm] as string}
                        onChange={(e)=>setReviewForm((p)=>({...p,[item.key]:e.target.value}))}
                        placeholder={`Enter major weakness ${item.label.replace('.', '')} (Optional)`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 mt-6 pt-6 border-t border-slate-200">
                <div className="space-y-2">
                  <Label>Detailed Comments for the Authors: Major Revisions Required (Optional)</Label>
                  <Textarea rows={6} value={reviewForm.comments_major_revisions} onChange={(e)=>setReviewForm((p)=>({...p,comments_major_revisions:e.target.value}))} placeholder="List major revisions here (Optional)..." />
                </div>
                <div className="space-y-2">
                  <Label>Detailed Comments for the Authors: Minor Revisions Required (Optional)</Label>
                  <Textarea rows={6} value={reviewForm.comments_minor_revisions} onChange={(e)=>setReviewForm((p)=>({...p,comments_minor_revisions:e.target.value}))} placeholder="List minor revisions here (Optional)..." />
                </div>
              </div>

              <div className="flex justify-between pt-6 border-t border-slate-100 mt-6">
                <Button type="button" variant="outline" onClick={() => setFormTab("quality")}>Previous</Button>
                <Button type="button" onClick={() => setFormTab("score")}>Next Step</Button>
              </div>
            </div>
          )}

          {/* TAB 5: Score & Submit */}
          {formTab === "score" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Confidential Comments to the Editor (Not visible to the authors)</Label>
                <Textarea rows={6} value={reviewForm.confidential_comments} onChange={(e)=>setReviewForm((p)=>({...p,confidential_comments:e.target.value}))} placeholder="Enter private comments for the editors here..." />
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-bold text-slate-800 text-sm tracking-wide">Overall Score (Out of 10 for each)</p>
                  <div className="rounded-xl bg-slate-100 px-4 py-2 border border-slate-200 text-sm font-semibold text-slate-900 shadow-sm">
                    Total Score: {totalReviewScore} / 100 ({reviewPercent}%)
                  </div>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { key: "score_originality", label: "Originality (1-10)" },
                    { key: "score_technical_quality_10", label: "Technical Quality (1-10)" },
                    { key: "score_methodology_10", label: "Methodology (1-10)" },
                    { key: "score_literature_review_10", label: "Literature Review (1-10)" },
                    { key: "score_experimental_design_10", label: "Experimental Design (1-10)" },
                    { key: "score_results_10", label: "Results (1-10)" },
                    { key: "score_discussion_10", label: "Discussion (1-10)" },
                    { key: "score_conclusion_10", label: "Conclusion (1-10)" },
                    { key: "score_language_10", label: "Language (1-10)" },
                    { key: "score_contribution_10", label: "Overall Contribution (1-10)" },
                  ].map((criteria) => (
                    <div key={criteria.key} className="space-y-2">
                      <Label>{criteria.label}</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        inputMode="numeric"
                        value={String(reviewForm[criteria.key as keyof typeof reviewForm] || "")}
                        onChange={(e) => {
                          const raw = e.target.value
                          if (raw === "") {
                            setReviewForm((p) => ({ ...p, [criteria.key]: "" }))
                            return
                          }
                          const capped = Math.max(1, Math.min(10, Number(raw)))
                          setReviewForm((p) => ({ ...p, [criteria.key]: String(capped) }))
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-200">
                <Label>Screenshot attachment (Optional)</Label>
                <Input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" onChange={(e)=>setReviewScreenshot(e.target.files?.[0] ?? null)} />
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-200">
                <Label>Recommendation Decision</Label>
                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium" value={reviewForm.recommendation} onChange={(e)=>setReviewForm((p)=>({...p,recommendation:e.target.value}))}>
                  {reviewerDecisionOptions.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>

              <div className="flex flex-wrap gap-3 pt-6 border-t border-slate-200 justify-end">
                <Button type="button" variant="outline" onClick={() => setFormTab("strengths")}>Previous</Button>
                <Button type="button" variant="outline" onClick={saveReviewDraft}>Save Draft</Button>
                <Button type="button" variant="outline" onClick={()=>setReviewPreviewOpen(true)}>Preview Evaluation</Button>
                <Button type="button" variant="outline" onClick={()=>void requestReviewExtension()}>Request Extension</Button>
                <Button type="button" variant="outline" onClick={()=>void declineSelectedReview()}>Decline Review</Button>
                <Button type="submit" disabled={saving}>{saving ? "Submitting..." : "Submit Review"}</Button>
              </div>
            </div>
          )}

          {reviewPreviewOpen ? createPortal(
            <div className="fixed inset-0 z-[160] bg-slate-950/50 p-4 flex items-center justify-center" onClick={()=>setReviewPreviewOpen(false)}>
              <div className="mx-auto max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(event)=>event.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">Evaluation Form Preview</p>
                    <p className="text-sm text-slate-500">
                      {String(selectedReviewManuscript?.title ?? "No manuscript selected")} | Score: {totalReviewScore}/100 ({reviewPercent}%)
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={()=>setReviewPreviewOpen(false)}>Close Preview</Button>
                </div>
                <div className="space-y-6 text-sm text-slate-700">
                  <div>
                    <p className="font-semibold text-slate-950 mb-1">Recommendation:</p>
                    <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-medium capitalize text-slate-900">
                      {String(reviewForm.recommendation).replaceAll("_", " ")}
                    </p>
                  </div>
                  
                  <div>
                    <p className="font-semibold text-slate-950 mb-2">Report Content (Visible to Authors & Editor):</p>
                    <pre className="whitespace-pre-wrap font-sans bg-slate-50 p-4 rounded-xl border border-slate-200 max-h-96 overflow-auto text-slate-800 leading-relaxed text-xs">
                      {buildCommentsToAuthor(reviewForm)}
                    </pre>
                  </div>

                  <div>
                    <p className="font-semibold text-slate-950 mb-2">Confidential Comments to Editor (Not visible to authors):</p>
                    <p className="whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border border-slate-200 text-slate-800 text-xs">
                      {reviewForm.confidential_comments || "None entered."}
                    </p>
                  </div>
                </div>
              </div>
            </div>, 
            document.body
          ) : null}
        </form>
      </CardContent>
    </Card>
    <Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Completed Reviews</CardTitle></CardHeader><CardContent><Table rows={reviews} /></CardContent></Card>
  </div>
  return <Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Assigned Manuscripts</CardTitle><CardDescription>Author identities remain hidden. Review only the manuscript content, files, and editorial instructions.</CardDescription></CardHeader><CardContent><Table rows={acceptedInvitations} /></CardContent></Card>
}

function EditorOnboardingCard({ onboarding, user, onSaved }: { onboarding?: NonNullable<WorkspacePayload["editor"]>["onboarding"]; user: AuthUser; onSaved: () => Promise<void> }) {
  const application = onboarding?.application ?? {}
  const [step, setStep] = React.useState(1)
  const [saving, setSaving] = React.useState(false)
  const [validationMessage, setValidationMessage] = React.useState("")
  const [uploadErrors, setUploadErrors] = React.useState({ cv_file: "", publication_list_file: "" })
  const [uploadProgress, setUploadProgress] = React.useState(0)
  const [files, setFiles] = React.useState<{ cv_file: File | null; publication_list_file: File | null }>({ cv_file: null, publication_list_file: null })
  const [form, setForm] = React.useState({
    title: String(application.title ?? ""),
    first_name: String(application.first_name ?? user.first_name ?? ""),
    last_name: String(application.last_name ?? user.last_name ?? ""),
    gender: String(application.gender ?? ""),
    nationality: String(application.nationality ?? ""),
    country: String(application.country ?? user.country ?? ""),
    institution: String(application.institution ?? user.institution ?? ""),
    faculty: String(application.faculty ?? ""),
    department: String(application.department ?? ""),
    academic_rank: String(application.academic_rank ?? ""),
    position: String(application.position ?? ""),
    email: String(application.email ?? user.email ?? ""),
    alt_email: String(application.alt_email ?? ""),
    phone: String(application.phone ?? user.phone ?? ""),
    whatsapp_number: String(application.whatsapp_number ?? ""),
    office_address: String(application.office_address ?? ""),
    orcid_id: String(application.orcid_id ?? user.orcid_id ?? ""),
    scopus_id: String(application.scopus_id ?? ""),
    researcher_id: String(application.researcher_id ?? ""),
    google_scholar_link: String(application.google_scholar_link ?? ""),
    publication_count: String(application.publication_count ?? "0"),
    publication_count_band: String(application.publication_count_band ?? ""),
    editorial_experience: String(Number(application.editorial_experience ?? 0)) === "1",
    journals_reviewed_band: String(application.journals_reviewed_band ?? ""),
    papers_reviewed_band: String(application.papers_reviewed_band ?? ""),
    manuscripts_per_year_band: String(application.manuscripts_per_year_band ?? ""),
    preferred_decision_timeline: String(application.preferred_decision_timeline ?? "14"),
    primary_editorial_area: String(application.primary_editorial_area ?? ""),
    research_keywords: String(application.research_keywords ?? ""),
    bio: String(application.bio ?? ""),
    editor_role: String(application.editor_role ?? "editorial_board"),
    responsibility_fair_decisions: String(Number(application.responsibility_fair_decisions ?? 0)) === "1",
    responsibility_confidentiality: String(Number(application.responsibility_confidentiality ?? 0)) === "1",
    responsibility_conflicts: String(Number(application.responsibility_conflicts ?? 0)) === "1",
    responsibility_integrity: String(Number(application.responsibility_integrity ?? 0)) === "1",
    responsibility_timeliness: String(Number(application.responsibility_timeliness ?? 0)) === "1",
    conflict_of_interest_declared: String(Number(application.conflict_of_interest_declared ?? 0)) === "1",
    final_declaration_agreed: String(Number(application.final_declaration_agreed ?? 0)) === "1",
  })
  const [qualifications, setQualifications] = React.useState(
    onboarding?.qualifications?.length
      ? onboarding.qualifications.map((entry) => ({
          degree: String(entry.degree ?? ""),
          field_of_study: String(entry.field_of_study ?? ""),
          institution: String(entry.institution ?? ""),
          graduation_year: String(entry.graduation_year ?? ""),
        }))
      : [{ degree: "", field_of_study: "", institution: "", graduation_year: "" }],
  )
  const [expertise, setExpertise] = React.useState(
    onboarding?.expertise?.length
      ? onboarding.expertise.map((entry) => ({
          research_area: String(entry.research_area ?? ""),
          keywords: String(entry.keywords ?? ""),
        }))
      : [{ research_area: "", keywords: "" }],
  )
  const [journalExperiences, setJournalExperiences] = React.useState(
    onboarding?.journal_experiences?.length
      ? onboarding.journal_experiences.map((entry) => ({
          journal_name: String(entry.journal_name ?? ""),
          publisher: String(entry.publisher ?? ""),
          role_title: String(entry.role_title ?? ""),
          years_of_service: String(entry.years_of_service ?? ""),
        }))
      : [{ journal_name: "", publisher: "", role_title: "", years_of_service: "" }],
  )
  const stepLabels = ["Personal", "Institution", "Contact", "Qualifications", "Expertise", "Experience", "Declaration"]
  const sectionOptions = onboarding?.section_options ?? []
  const currentCvPath = String(application.cv_file ?? "")
  const currentPublicationListPath = String(application.publication_list_file ?? "")
  const { countryOptions, countriesLoading, countryLookupFailed } = useCountryOptions()

  const validateStep = (currentStep: number) => {
    if (currentStep === 1) {
      return form.title && form.first_name && form.last_name && form.nationality && form.country ? "" : "Complete title, first name, last name, nationality, and country before continuing."
    }
    if (currentStep === 2) {
      return form.institution && form.faculty && form.department && form.academic_rank && form.position ? "" : "Institution, faculty, department, academic rank, and position are required."
    }
    if (currentStep === 3) {
      return form.email && form.phone && form.office_address ? "" : "Email, phone number, and office address are required before continuing."
    }
    if (currentStep === 4) {
      return qualifications.some((entry) => entry.degree.trim() && entry.field_of_study.trim() && entry.institution.trim() && entry.graduation_year.trim()) ? "" : "Add at least one academic qualification with degree, field, institution, and graduation year."
    }
    if (currentStep === 5) {
      return form.primary_editorial_area && form.research_keywords ? "" : "Select the primary editorial area and provide research keywords."
    }
    if (currentStep === 6) {
      if (!form.journals_reviewed_band || !form.papers_reviewed_band || !form.manuscripts_per_year_band || !form.preferred_decision_timeline) {
        return "Complete reviewing experience, annual handling capacity, and preferred decision timeline."
      }
      if (form.editorial_experience && !journalExperiences.some((entry) => entry.journal_name.trim())) {
        return "Add at least one prior journal editorial assignment or switch editorial experience to No."
      }
      return ""
    }
    if (currentStep === 7) {
      if (!form.bio.trim()) return "Provide a short academic biography before submitting the application."
      if (!files.cv_file && !currentCvPath) return "Upload your CV before submitting the application."
      if (!form.responsibility_fair_decisions || !form.responsibility_confidentiality || !form.responsibility_conflicts || !form.responsibility_integrity || !form.responsibility_timeliness) {
        return "All editorial responsibility declarations must be accepted."
      }
      if (!form.conflict_of_interest_declared || !form.final_declaration_agreed) {
        return "Conflict of interest and final declaration confirmations are required."
      }
      return ""
    }
    return ""
  }

  const handleFileAssign = (
    field: "cv_file" | "publication_list_file",
    file: File | null,
    allowedMimeTypes: string[],
    label: string,
  ) => {
    if (!file) {
      setFiles((prev) => ({ ...prev, [field]: null }))
      setUploadErrors((prev) => ({ ...prev, [field]: "" }))
      return
    }
    const error = validateUploadFile(file, allowedMimeTypes, label)
    if (error) {
      setFiles((prev) => ({ ...prev, [field]: null }))
      setUploadErrors((prev) => ({ ...prev, [field]: error }))
      return
    }
    setFiles((prev) => ({ ...prev, [field]: file }))
    setUploadErrors((prev) => ({ ...prev, [field]: "" }))
  }

  const submit = async () => {
    const error = validateStep(7)
    if (error) {
      setValidationMessage(error)
      return
    }
    setSaving(true)
    setUploadProgress(0)
    try {
      const payload = new FormData()
      Object.entries(form).forEach(([key, value]) => payload.append(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value)))
      payload.append("publication_count", form.publication_count || "0")
      payload.append("preferred_decision_timeline", form.preferred_decision_timeline || "14")
      payload.append("qualifications", JSON.stringify(qualifications))
      payload.append("expertise", JSON.stringify(expertise))
      payload.append("journal_experiences", JSON.stringify(journalExperiences))
      if (files.cv_file) payload.append("cv_file", files.cv_file)
      if (files.publication_list_file) payload.append("publication_list_file", files.publication_list_file)
      const response = await updateEditorProfile(payload as unknown as Record<string, unknown>, { onProgress: setUploadProgress })
      await onSaved()
      setValidationMessage("")
      toast.success(response.message)
    } catch (error) {
      toast.error(errorText(error, "Unable to save editor application."))
    } finally {
      setSaving(false)
      setTimeout(() => setUploadProgress(0), 500)
    }
  }

  return <Card className="border-white/70 bg-white/88 backdrop-blur"><CardHeader><CardHeading icon={<FileClock className="h-5 w-5" />} title="Editor Application Required" description="Complete the editorial board application before accessing manuscript handling, reviewer assignment, and decisions." /></CardHeader><CardContent className="space-y-6"><div className="grid gap-3 md:grid-cols-7">{stepLabels.map((label, index) => <button key={label} type="button" onClick={() => { setStep(index + 1); setValidationMessage("") }} className={cn("rounded-2xl border px-3 py-3 text-left text-sm font-medium", step === index + 1 ? "border-jostum-700 bg-jostum-50 text-jostum-800" : "border-slate-200 bg-white text-slate-600")}><p className="text-xs uppercase tracking-[0.16em]">{`Step ${index + 1}`}</p><p className="mt-2">{label}</p></button>)}</div><div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">This application follows the JASTI editorial board form. Editorial office-use fields such as approval status, assigned section, and editor ID remain under admin control and are not exposed here.</div>{validationMessage ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{validationMessage}</div> : null}{step === 1 ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><TitleSelectField value={form.title} onChange={(value)=>setForm((prev)=>({...prev,title:value}))} /><div className="space-y-2"><Label>First name</Label><Input value={form.first_name} onChange={(e)=>setForm((prev)=>({...prev,first_name:e.target.value}))} /></div><div className="space-y-2"><Label>Last name</Label><Input value={form.last_name} onChange={(e)=>setForm((prev)=>({...prev,last_name:e.target.value}))} /></div><div className="space-y-2"><Label>Gender</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.gender} onChange={(e)=>setForm((prev)=>({...prev,gender:e.target.value}))}><option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option></select></div><CountrySelectField label="Nationality" value={form.nationality} onChange={(value)=>setForm((prev)=>({...prev,nationality:value}))} countryOptions={countryOptions} countriesLoading={countriesLoading} countryLookupFailed={countryLookupFailed} placeholder="Select nationality" /><CountrySelectField label="Country of residence" value={form.country} onChange={(value)=>setForm((prev)=>({...prev,country:value}))} countryOptions={countryOptions} countriesLoading={countriesLoading} countryLookupFailed={countryLookupFailed} placeholder="Select a country" /></div> : null}{step === 2 ? <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Institution / Organization</Label><Input value={form.institution} onChange={(e)=>setForm((prev)=>({...prev,institution:e.target.value}))} /></div><div className="space-y-2"><Label>Faculty</Label><Input value={form.faculty} onChange={(e)=>setForm((prev)=>({...prev,faculty:e.target.value}))} /></div><div className="space-y-2"><Label>Department</Label><Input value={form.department} onChange={(e)=>setForm((prev)=>({...prev,department:e.target.value}))} /></div><div className="space-y-2"><Label>Current academic rank</Label><Input value={form.academic_rank} onChange={(e)=>setForm((prev)=>({...prev,academic_rank:e.target.value}))} /></div><div className="space-y-2"><Label>Current position / role</Label><Input value={form.position} onChange={(e)=>setForm((prev)=>({...prev,position:e.target.value}))} /></div><div className="space-y-2"><Label>Appointment type</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.editor_role} onChange={(e)=>setForm((prev)=>({...prev,editor_role:e.target.value}))}><option value="editorial_board">Editorial Board</option><option value="associate_editor">Associate Editor</option><option value="section_editor">Section Editor</option><option value="managing_editor">Managing Editor</option></select></div></div> : null}{step === 3 ? <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Institutional email</Label><Input type="email" value={form.email} onChange={(e)=>setForm((prev)=>({...prev,email:e.target.value}))} /></div><div className="space-y-2"><Label>Alternative email</Label><Input type="email" value={form.alt_email} onChange={(e)=>setForm((prev)=>({...prev,alt_email:e.target.value}))} /></div><div className="space-y-2"><Label>Phone number</Label><Input value={form.phone} onChange={(e)=>setForm((prev)=>({...prev,phone:e.target.value}))} /></div><div className="space-y-2"><Label>Whatsapp number</Label><Input value={form.whatsapp_number} onChange={(e)=>setForm((prev)=>({...prev,whatsapp_number:e.target.value}))} /></div><div className="space-y-2 md:col-span-2"><Label>Office address</Label><Textarea rows={5} value={form.office_address} onChange={(e)=>setForm((prev)=>({...prev,office_address:e.target.value}))} /></div></div> : null}{step === 4 ? <div className="space-y-4">{qualifications.map((entry, index) => <div key={index} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><Label>Degree</Label><Input value={entry.degree} onChange={(e)=>setQualifications((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, degree: e.target.value } : item))} /></div><div className="space-y-2"><Label>Field of study</Label><Input value={entry.field_of_study} onChange={(e)=>setQualifications((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, field_of_study: e.target.value } : item))} /></div><div className="space-y-2"><Label>Institution</Label><Input value={entry.institution} onChange={(e)=>setQualifications((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, institution: e.target.value } : item))} /></div><div className="space-y-2"><Label>Graduation year</Label><Input value={entry.graduation_year} onChange={(e)=>setQualifications((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, graduation_year: e.target.value } : item))} /></div></div>)}<Button type="button" variant="outline" onClick={() => setQualifications((prev) => [...prev, { degree: "", field_of_study: "", institution: "", graduation_year: "" }])}>Add qualification</Button></div> : null}{step === 5 ? <div className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Primary editorial area</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.primary_editorial_area} onChange={(e)=>setForm((prev)=>({...prev,primary_editorial_area:e.target.value}))}><option value="">Select area</option>{sectionOptions.map((entry)=><option key={String(entry.section_id ?? entry.section_name)} value={String(entry.section_name ?? "")}>{String(entry.section_name ?? "")}</option>)}</select></div><div className="space-y-2"><Label>Specific research keywords</Label><Input value={form.research_keywords} onChange={(e)=>setForm((prev)=>({...prev,research_keywords:e.target.value}))} placeholder="AI, data science, smart systems" /></div></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><Label>ORCID ID</Label><Input value={form.orcid_id} onChange={(e)=>setForm((prev)=>({...prev,orcid_id:e.target.value}))} /></div><div className="space-y-2"><Label>Scopus ID</Label><Input value={form.scopus_id} onChange={(e)=>setForm((prev)=>({...prev,scopus_id:e.target.value}))} /></div><div className="space-y-2"><Label>Researcher ID</Label><Input value={form.researcher_id} onChange={(e)=>setForm((prev)=>({...prev,researcher_id:e.target.value}))} /></div><div className="space-y-2"><Label>Google Scholar link</Label><Input value={form.google_scholar_link} onChange={(e)=>setForm((prev)=>({...prev,google_scholar_link:e.target.value}))} /></div></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Publication count</Label><Input value={form.publication_count} onChange={(e)=>setForm((prev)=>({...prev,publication_count:e.target.value}))} /></div><div className="space-y-2"><Label>Publication count band</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.publication_count_band} onChange={(e)=>setForm((prev)=>({...prev,publication_count_band:e.target.value}))}><option value="">Select range</option><option value="1-10">1-10</option><option value="11-25">11-25</option><option value="26-50">26-50</option><option value="51-100">51-100</option><option value="100+">100+</option></select></div></div><div className="space-y-4">{expertise.map((entry, index) => <div key={index} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2"><div className="space-y-2"><Label>Additional research area</Label><Input value={entry.research_area} onChange={(e)=>setExpertise((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, research_area: e.target.value } : item))} /></div><div className="space-y-2"><Label>Keywords</Label><Input value={entry.keywords} onChange={(e)=>setExpertise((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, keywords: e.target.value } : item))} /></div></div>)}<Button type="button" variant="outline" onClick={() => setExpertise((prev) => [...prev, { research_area: "", keywords: "" }])}>Add expertise row</Button></div></div> : null}{step === 6 ? <div className="space-y-4"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><Label>Reviewed for journals</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.journals_reviewed_band} onChange={(e)=>setForm((prev)=>({...prev,journals_reviewed_band:e.target.value}))}><option value="">Select band</option><option value="1-3">1-3</option><option value="4-10">4-10</option><option value="11-20">11-20</option><option value="20+">20+</option></select></div><div className="space-y-2"><Label>Papers reviewed</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.papers_reviewed_band} onChange={(e)=>setForm((prev)=>({...prev,papers_reviewed_band:e.target.value}))}><option value="">Select band</option><option value="1-10">1-10</option><option value="11-30">11-30</option><option value="31-60">31-60</option><option value="60+">60+</option></select></div><div className="space-y-2"><Label>Manuscripts per year</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.manuscripts_per_year_band} onChange={(e)=>setForm((prev)=>({...prev,manuscripts_per_year_band:e.target.value}))}><option value="">Select band</option><option value="1-5">1-5</option><option value="6-10">6-10</option><option value="11-20">11-20</option><option value="20+">20+</option></select></div><div className="space-y-2"><Label>Decision timeline</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.preferred_decision_timeline} onChange={(e)=>setForm((prev)=>({...prev,preferred_decision_timeline:e.target.value}))}><option value="7">7 days</option><option value="14">14 days</option><option value="21">21 days</option></select></div></div><label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.editorial_experience} onChange={(e)=>setForm((prev)=>({...prev,editorial_experience:e.target.checked}))} />I have served in a journal editorial role before</label>{form.editorial_experience ? <div className="space-y-4">{journalExperiences.map((entry, index) => <div key={index} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><Label>Journal name</Label><Input value={entry.journal_name} onChange={(e)=>setJournalExperiences((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, journal_name: e.target.value } : item))} /></div><div className="space-y-2"><Label>Publisher</Label><Input value={entry.publisher} onChange={(e)=>setJournalExperiences((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, publisher: e.target.value } : item))} /></div><div className="space-y-2"><Label>Role</Label><Input value={entry.role_title} onChange={(e)=>setJournalExperiences((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, role_title: e.target.value } : item))} /></div><div className="space-y-2"><Label>Years of service</Label><Input value={entry.years_of_service} onChange={(e)=>setJournalExperiences((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, years_of_service: e.target.value } : item))} /></div></div>)}<Button type="button" variant="outline" onClick={() => setJournalExperiences((prev) => [...prev, { journal_name: "", publisher: "", role_title: "", years_of_service: "" }])}>Add editorial assignment</Button></div> : null}</div> : null}{step === 7 ? <div className="space-y-5"><div className="space-y-2"><Label>Short academic biography</Label><Textarea rows={6} value={form.bio} onChange={(e)=>setForm((prev)=>({...prev,bio:e.target.value}))} /></div><div className="grid gap-6 lg:grid-cols-2"><div className="space-y-3"><FileDropzone label="Curriculum Vitae" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" helperText="Accepted: PDF, DOC, DOCX. Maximum 10MB." file={files.cv_file} error={uploadErrors.cv_file} progress={uploadProgress > 0 ? uploadProgress : undefined} progressLabel="Uploading editor files" onFileSelect={(file)=>handleFileAssign("cv_file", file, ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], "Curriculum Vitae")} onRemove={()=>handleFileAssign("cv_file", null, [], "Curriculum Vitae")} />{currentCvPath ? <a href={resolveApiAssetUrl(currentCvPath)} target="_blank" rel="noreferrer" className="text-xs font-medium text-jostum-700 underline underline-offset-4">View current CV</a> : null}</div><div className="space-y-3"><FileDropzone label="Publication list" accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" helperText="Optional: PDF, DOC, DOCX, or TXT. Maximum 10MB." file={files.publication_list_file} error={uploadErrors.publication_list_file} progress={uploadProgress > 0 ? uploadProgress : undefined} progressLabel="Uploading editor files" onFileSelect={(file)=>handleFileAssign("publication_list_file", file, ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"], "Publication list")} onRemove={()=>handleFileAssign("publication_list_file", null, [], "Publication list")} />{currentPublicationListPath ? <a href={resolveApiAssetUrl(currentPublicationListPath)} target="_blank" rel="noreferrer" className="text-xs font-medium text-jostum-700 underline underline-offset-4">View current publication list</a> : null}</div></div><div className="grid gap-3 md:grid-cols-2"><label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.responsibility_fair_decisions} onChange={(e)=>setForm((prev)=>({...prev,responsibility_fair_decisions:e.target.checked}))} />Make fair and unbiased editorial decisions</label><label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.responsibility_confidentiality} onChange={(e)=>setForm((prev)=>({...prev,responsibility_confidentiality:e.target.checked}))} />Maintain confidentiality throughout the editorial process</label><label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.responsibility_conflicts} onChange={(e)=>setForm((prev)=>({...prev,responsibility_conflicts:e.target.checked}))} />Avoid and disclose conflicts of interest</label><label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.responsibility_integrity} onChange={(e)=>setForm((prev)=>({...prev,responsibility_integrity:e.target.checked}))} />Uphold research integrity and publication ethics</label><label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.responsibility_timeliness} onChange={(e)=>setForm((prev)=>({...prev,responsibility_timeliness:e.target.checked}))} />Support timely and documented editorial decisions</label><label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.conflict_of_interest_declared} onChange={(e)=>setForm((prev)=>({...prev,conflict_of_interest_declared:e.target.checked}))} />I have declared any conflict of interest relevant to this application</label><label className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.final_declaration_agreed} onChange={(e)=>setForm((prev)=>({...prev,final_declaration_agreed:e.target.checked}))} />I certify that the information supplied is accurate and agree to serve within JASTI editorial standards if appointed.</label></div></div> : null}<div className="flex items-center justify-between gap-3"><Button type="button" variant="outline" disabled={step === 1} onClick={() => { setStep((current) => Math.max(1, current - 1)); setValidationMessage("") }}>Previous</Button><div className="flex items-center gap-3">{step < 7 ? <Button type="button" onClick={() => { const error = validateStep(step); if (error) { setValidationMessage(error); return } setValidationMessage(""); setStep((current) => Math.min(7, current + 1)) }}>Save & Continue</Button> : <Button type="button" onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Finish application"}</Button>}</div></div></CardContent></Card>
}

function EditorPanels({ section, workspace, onSaved }: { section: string; workspace: WorkspacePayload; onSaved: () => Promise<void> }) {
  const assignments = asArray(workspace.editor?.assignments)
  const unassigned = asArray(workspace.editor?.unassigned_manuscripts)
  const reviewers = asArray(workspace.editor?.reviewers)
  const decisions = asArray(workspace.editor?.decisions)
  const technicalScreenings = asArray(workspace.editor?.technical_screenings)
  const technicalApprovalQueue = technicalScreenings.filter((entry) => String(entry.technical_status ?? "") === "attended")
  const editorOverview = asRecord(workspace.editor?.overview)
  const activeAssignments = assignments.filter((entry) => ["submitted", "editor_screening", "under_review", "revision_required"].includes(String(entry.status)))
  const revisionQueue = assignments.filter((entry) => String(entry.status) === "revision_required")
  const reviewerAssignableAssignments = assignments.filter((entry) => String(entry.technical_status ?? "") === "approved" && Number(entry.reviewer_invitation_count ?? 0) < 2)
  const decisionEligibleAssignments = assignments.filter((entry) => Number(entry.completed_review_count ?? 0) >= 2 && Number(entry.has_editor_decision ?? 0) === 0)
  const [editorSearch, setEditorSearch] = React.useState("")
  const matchesEditorSearch = React.useCallback((entry: Record<string, unknown>) => {
    const q = editorSearch.trim().toLowerCase()
    if (!q) return true
    const fields = ["reference_number", "manuscript_id", "title", "status", "article_type"]
    return fields.some((field) => String(entry?.[field] ?? "").toLowerCase().includes(q))
  }, [editorSearch])
  const filterEditor = (list: Array<Record<string, unknown>>) => list.filter(matchesEditorSearch)
  const filteredAssignments = filterEditor(assignments)
  const filteredUnassigned = filterEditor(unassigned)
  const filteredActiveAssignments = filterEditor(activeAssignments)
  const filteredRevisionQueue = filterEditor(revisionQueue)
  const filteredDecisions = filterEditor(decisions)
  const [inviteForm, setInviteForm] = React.useState({ manuscript_id: "", reviewer_ids: [] as string[], specialization_filter: "", review_model: "single_blind", review_deadline: "" })
  const [decisionForm, setDecisionForm] = React.useState({ manuscript_id: "", decision_type: "major_revision", decision_letter: "", journal_suitability: "Good", scientific_merit: "Moderate", innovation_level: "Moderate", ethical_compliance: "Pass", language_quality: "Good", editorial_notes: "", decision_justification: "", transfer_journal: "", send_additional_review: false })
  const [reviewerDetailsModal, setReviewerDetailsModal] = React.useState<Record<string, unknown> | null>(null)
  const [previewReviewModal, setPreviewReviewModal] = React.useState(false)
  const [technicalReason, setTechnicalReason] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const specializationOptions = Array.from(new Set(reviewers.flatMap((entry) => {
    const raw = entry.specializations_json
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as string[]
      } catch {
        return []
      }
    }
    return []
  }))).filter(Boolean)
  const availableReviewers = reviewers.filter((entry) => String(entry.availability_status ?? "").toLowerCase() === "available")
  const filteredReviewers = inviteForm.specialization_filter
    ? availableReviewers.filter((entry) => {
        const raw = entry.specializations_json
        const values = typeof raw === "string" ? (() => { try { return JSON.parse(raw) as string[] } catch { return [] } })() : []
        return values.includes(inviteForm.specialization_filter) || String(entry.expertise_area ?? "").includes(inviteForm.specialization_filter)
      })
    : availableReviewers
  const selectedInviteManuscript = reviewerAssignableAssignments.find((entry) => String(entry.manuscript_id) === inviteForm.manuscript_id) ?? null
  const existingInviteCount = Number(selectedInviteManuscript?.reviewer_invitation_count ?? 0)
  const remainingReviewerSlots = Math.max(0, 3 - existingInviteCount)
  const minimumReviewerSelection = Math.max(1, 2 - existingInviteCount)
  const assignedInviteReviewerIds = String(selectedInviteManuscript?.assigned_reviewer_ids ?? "").split(",").map((id) => id.trim()).filter(Boolean)
  const selectedDecisionManuscript = decisionEligibleAssignments.find((entry) => String(entry.manuscript_id) === decisionForm.manuscript_id) ?? null
  const matchedReviewers = filteredReviewers
    .map((entry) => ({ ...entry, match_accuracy: reviewerMatchAccuracy(selectedInviteManuscript, entry) }))
    .filter((entry) => !assignedInviteReviewerIds.includes(String(entry.user_id)))
    .filter((entry) => !selectedInviteManuscript || Number(entry.match_accuracy) > 0)
    .sort((left, right) => Number(right.match_accuracy) - Number(left.match_accuracy))
  if (section === "decisions") return <div className="grid gap-6">
    <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Editor Evaluation and Decision</CardTitle><CardDescription>Review manuscript status, reviewer reports, integrity checks, revision history, and editorial assessment before deciding.</CardDescription></CardHeader><CardContent><form className="space-y-5" onSubmit={async (e)=>{e.preventDefault(); setSaving(true); try { await recordEditorDecision({ ...decisionForm, manuscript_id: Number(decisionForm.manuscript_id), send_additional_review: decisionForm.send_additional_review }); setDecisionForm({ manuscript_id: "", decision_type: "major_revision", decision_letter: "", journal_suitability: "Good", scientific_merit: "Moderate", innovation_level: "Moderate", ethical_compliance: "Pass", language_quality: "Good", editorial_notes: "", decision_justification: "", transfer_journal: "", send_additional_review: false }); await onSaved(); toast.success("Decision saved.") } catch (error) { toast.error(errorText(error, "Unable to save decision.")) } finally { setSaving(false) } }}>
      <div className="space-y-2"><Label>Manuscript</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={decisionForm.manuscript_id} onChange={(e)=>setDecisionForm((p)=>({...p,manuscript_id:e.target.value}))} disabled={decisionEligibleAssignments.length === 0}><option value="">{decisionEligibleAssignments.length ? "Select manuscript" : "No manuscript currently has 2 completed reviewer reports"}</option>{decisionEligibleAssignments.map((entry)=><option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>{String(entry.reference_number ?? entry.manuscript_id)} - {String(entry.title ?? entry.manuscript_id)} ({String(entry.completed_review_count)} reviews)</option>)}</select></div>
      {selectedDecisionManuscript ? <div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><p className="font-semibold text-slate-900">{String(selectedDecisionManuscript.title ?? "")}</p><p>Current status: {String(selectedDecisionManuscript.status ?? "")}</p><p>Similarity score: {String(selectedDecisionManuscript.plagiarism_score ?? "Not set")}</p><p>Assigned reviewers: {String(selectedDecisionManuscript.assigned_reviewers ?? "Not assigned")}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600"><p className="font-semibold text-slate-900">Integrity and production readiness</p><p>Plagiarism report: {String(selectedDecisionManuscript.plagiarism_scan_status ?? "Manual review")}</p><p>Ethics approval verification: Pending editorial confirmation</p><p>ORCID verification: Author profile record</p><p>Reference validation: Pending production check</p><p>Formatting, DOI, metadata, copyright: verify before acceptance</p></div></div> : null}
      {selectedDecisionManuscript ? <details open className="rounded-2xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-semibold text-slate-900">Reviewer Reports Summary</summary><div className="mt-3 space-y-3 text-sm text-slate-700"><p className="whitespace-pre-wrap">{String(selectedDecisionManuscript.reviewer_reports ?? "No report summary available.")}</p><p>Agreement analysis: compare recommendations and score percentages above before issuing decision.</p></div></details> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{[["journal_suitability","Journal Suitability",["Excellent","Good","Poor"]],["scientific_merit","Scientific Merit",["High","Moderate","Low"]],["innovation_level","Innovation Level",["High","Moderate","Low"]],["ethical_compliance","Ethical Compliance",["Pass","Concern"]],["language_quality","Language Quality",["Good","Needs Editing"]]].map(([key,label,options])=><div key={String(key)} className="space-y-2"><Label>{String(label)}</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={String(decisionForm[key as keyof typeof decisionForm])} onChange={(e)=>setDecisionForm((p)=>({...p,[String(key)]:e.target.value}))}>{(options as string[]).map((option)=><option key={option} value={option}>{option}</option>)}</select></div>)}</div>
      <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Editorial notes</Label><Textarea rows={5} value={decisionForm.editorial_notes} onChange={(e)=>setDecisionForm((p)=>({...p,editorial_notes:e.target.value}))} placeholder="Communication logs and editorial observations" /></div><div className="space-y-2"><Label>Decision justification</Label><Textarea rows={5} value={decisionForm.decision_justification} onChange={(e)=>setDecisionForm((p)=>({...p,decision_justification:e.target.value,decision_letter:p.decision_letter || `Dear Author,\\n\\nAfter editorial assessment and peer review, the decision is ${p.decision_type.replaceAll("_", " ")}.\\n\\nJustification: ${e.target.value}` }))} /></div></div>
      <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Final editorial decision</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={decisionForm.decision_type} onChange={(e)=>setDecisionForm((p)=>({...p,decision_type:e.target.value}))}><option value="accept">Accept</option><option value="minor_revision">Minor Revision</option><option value="major_revision">Major Revision</option><option value="reject">Reject</option></select></div><div className="space-y-2"><Label>Transfer to another journal</Label><Input value={decisionForm.transfer_journal} onChange={(e)=>setDecisionForm((p)=>({...p,transfer_journal:e.target.value}))} placeholder="Optional journal name" /></div></div>
      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={decisionForm.send_additional_review} onChange={(e)=>setDecisionForm((p)=>({...p,send_additional_review:e.target.checked}))} />Send for Additional Review</label>
      <div className="space-y-2"><Label>Editable decision letter</Label><Textarea rows={7} value={decisionForm.decision_letter} onChange={(e)=>setDecisionForm((p)=>({...p,decision_letter:e.target.value}))} /></div>
      <Button type="submit" disabled={saving || decisionEligibleAssignments.length === 0 || !decisionForm.manuscript_id}>{saving ? "Saving..." : "Save decision"}</Button>
    </form></CardContent></Card>
    <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Recorded decisions</CardTitle></CardHeader><CardContent><Table rows={filteredDecisions} /></CardContent></Card>
  </div>
  if (section === "selection") return <div className="grid gap-6">
    <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Technical Editor Output Approval</CardTitle><CardDescription>Approve the anonymized paper before assigning reviewers, or return it to the technical editor with reasons.</CardDescription></CardHeader><CardContent className="space-y-4">{technicalApprovalQueue.length ? technicalApprovalQueue.map((entry)=><div key={String(entry.screening_id ?? entry.manuscript_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p className="font-semibold text-slate-950">{String(entry.reference_number ?? entry.manuscript_id)} - {String(entry.title ?? "")}</p><p className="mt-1 text-sm text-slate-500">GQ: {String(entry.grammar_quality ?? "")}% | AI: {String(entry.ai_score ?? "")}% | Similarity: {String(entry.similarity_score ?? "")}%</p>{entry.anonymized_file_path ? <a className="mt-2 inline-flex text-sm font-semibold text-jostum-700 underline underline-offset-4" href={resolveApiAssetUrl(String(entry.anonymized_file_path))} target="_blank" rel="noreferrer">Preview/download anonymized file</a> : null}</div><div className="flex flex-wrap gap-2"><Button type="button" size="sm" onClick={async()=>{ setSaving(true); try { await decideTechnicalScreening({ manuscript_id: Number(entry.manuscript_id), decision: "approved" }); await onSaved(); toast.success("Technical file approved.") } catch (error) { toast.error(errorText(error, "Unable to approve technical file.")) } finally { setSaving(false) } }} disabled={saving}>Approve</Button></div></div><div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end"><div className="space-y-2"><Label>Rejection reason</Label><Textarea rows={3} value={technicalReason[String(entry.manuscript_id)] ?? ""} onChange={(e)=>setTechnicalReason((prev)=>({...prev,[String(entry.manuscript_id)]: e.target.value}))} /></div><Button type="button" variant="outline" disabled={saving} onClick={async()=>{ const reason = technicalReason[String(entry.manuscript_id)] ?? ""; if (!reason.trim()) { toast.error("Enter the rejection reason."); return } setSaving(true); try { await decideTechnicalScreening({ manuscript_id: Number(entry.manuscript_id), decision: "rejected", reason }); await onSaved(); toast.success("Returned to technical editor.") } catch (error) { toast.error(errorText(error, "Unable to reject technical file.")) } finally { setSaving(false) } }}>Reject</Button></div></div>) : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No technical editor files are waiting for approval.</div>}</CardContent></Card>
    <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
      <CardHeader><CardTitle>Reviewer Selection</CardTitle><CardDescription>Reviewer matches are ranked from manuscript title, abstract, and keywords against each reviewer specialization.</CardDescription></CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={async (e)=>{e.preventDefault(); if (inviteForm.reviewer_ids.length < minimumReviewerSelection || inviteForm.reviewer_ids.length > remainingReviewerSlots) { toast.error(`Select ${minimumReviewerSelection} to ${remainingReviewerSlots} reviewer${remainingReviewerSlots === 1 ? "" : "s"} for this manuscript.`); return } setSaving(true); try { await inviteReviewer({ manuscript_id: Number(inviteForm.manuscript_id), reviewer_ids: inviteForm.reviewer_ids.map(Number), review_model: inviteForm.review_model, review_deadline: inviteForm.review_deadline }); setInviteForm({ manuscript_id: "", reviewer_ids: [], specialization_filter: "", review_model: "single_blind", review_deadline: "" }); await onSaved(); toast.success("Reviewer invitations sent.") } catch (error) { toast.error(errorText(error, "Unable to invite reviewer.")) } finally { setSaving(false) } }}>
          <div className="space-y-2"><Label>Manuscript</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={inviteForm.manuscript_id} onChange={(e)=>setInviteForm((p)=>({...p,manuscript_id:e.target.value, reviewer_ids: []}))} disabled={reviewerAssignableAssignments.length === 0}><option value="">{reviewerAssignableAssignments.length ? "Select manuscript" : "No unpublished manuscripts need reviewer assignment"}</option>{reviewerAssignableAssignments.map((entry)=><option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>{String(entry.reference_number ?? entry.manuscript_id)} - {String(entry.title ?? entry.manuscript_id)} ({String(entry.reviewer_invitation_count ?? 0)}/3 invited)</option>)}</select></div>
          {selectedInviteManuscript ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><p className="font-semibold text-slate-900">{String(selectedInviteManuscript.title ?? "")}</p><p className="mt-2">Assigned reviewers: {String(selectedInviteManuscript.assigned_reviewers ?? "None yet")}</p><p>Status: {String(selectedInviteManuscript.status ?? "")} | Similarity score: {String(selectedInviteManuscript.plagiarism_score ?? "Not set")}</p><p className="mt-2 font-medium text-slate-900">Select {minimumReviewerSelection} to {remainingReviewerSlots} more reviewer{remainingReviewerSlots === 1 ? "" : "s"}. Manuscripts disappear from this list after 2 reviewer invitations.</p></div> : null}
          <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Review model</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={inviteForm.review_model} onChange={(e)=>setInviteForm((p)=>({...p,review_model:e.target.value}))}><option value="single_blind">Single blind</option><option value="double_blind">Double blind</option><option value="open_review">Open review</option></select></div><div className="space-y-2"><Label>Review deadline</Label><Input type="datetime-local" value={inviteForm.review_deadline} onChange={(e)=>setInviteForm((p)=>({...p,review_deadline:e.target.value}))} /></div></div>
          <div className="space-y-2"><Label>Filter by specialization</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={inviteForm.specialization_filter} onChange={(e)=>setInviteForm((p)=>({...p,specialization_filter:e.target.value}))}><option value="">All specialization areas</option>{specializationOptions.map((option)=><option key={option} value={option}>{option}</option>)}</select></div>
          <div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-3"><Label>Select reviewers</Label><span className="text-xs font-semibold text-slate-500">{inviteForm.reviewer_ids.length}/{remainingReviewerSlots || 3} selected</span></div><div className="max-h-80 space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-white p-3">{matchedReviewers.length ? matchedReviewers.map((entry)=><div key={String(entry.user_id)} className="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={inviteForm.reviewer_ids.includes(String(entry.user_id))} disabled={!inviteForm.reviewer_ids.includes(String(entry.user_id)) && inviteForm.reviewer_ids.length >= remainingReviewerSlots} onChange={(e)=>setInviteForm((prev)=>({...prev,reviewer_ids:e.target.checked ? [...prev.reviewer_ids, String(entry.user_id)] : prev.reviewer_ids.filter((id)=>id!==String(entry.user_id))}))} /><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{String(entry.first_name ?? "")} {String(entry.last_name ?? "")} ({String(entry.match_accuracy)}% Accuracy)</p><p className="text-slate-500">Availability: {String(entry.availability_status ?? "available")}</p></div><Button type="button" size="sm" variant="outline" onClick={()=>setReviewerDetailsModal(entry)}>View</Button></div>) : <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Select a manuscript to see available reviewer matches.</div>}</div></div>
          {reviewerDetailsModal ? createPortal(<div className="fixed inset-0 z-[160] bg-slate-950/50 p-4" onClick={()=>setReviewerDetailsModal(null)}><div className="mx-auto mt-12 max-h-[80vh] max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl" onClick={(event)=>event.stopPropagation()}><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-lg font-semibold text-slate-950">{String(reviewerDetailsModal.first_name ?? "")} {String(reviewerDetailsModal.last_name ?? "")}</p><p className="text-sm text-slate-500">{String(reviewerDetailsModal.match_accuracy ?? 0)}% Accuracy | Availability: {String(reviewerDetailsModal.availability_status ?? "available")}</p></div><Button type="button" variant="outline" onClick={()=>setReviewerDetailsModal(null)}>Close</Button></div><div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2"><p><span className="font-semibold text-slate-950">Email:</span> {String(reviewerDetailsModal.email ?? "")}</p><p><span className="font-semibold text-slate-950">ORCID:</span> {String(reviewerDetailsModal.orcid_id ?? "Not provided")}</p><p className="md:col-span-2"><span className="font-semibold text-slate-950">Specialization:</span> {String(reviewerDetailsModal.expertise_area ?? "")}</p><p><span className="font-semibold text-slate-950">Completed reviews:</span> {String(reviewerDetailsModal.completed_reviews ?? reviewerDetailsModal.total_reviews ?? 0)}</p><p><span className="font-semibold text-slate-950">Pending reviews:</span> {String(reviewerDetailsModal.pending_reviews ?? 0)}</p><p><span className="font-semibold text-slate-950">Active reviews:</span> {String(reviewerDetailsModal.active_reviews ?? 0)}</p><p><span className="font-semibold text-slate-950">Acceptance percentage:</span> {String(reviewerDetailsModal.acceptance_percentage ?? "0")}%</p><p><span className="font-semibold text-slate-950">Average completion hours:</span> {String(reviewerDetailsModal.average_completion_hours ?? "Not available")}</p><p><span className="font-semibold text-slate-950">Average quality rating:</span> {String(reviewerDetailsModal.average_quality_rating ?? "Not rated")}</p></div></div></div>, document.body) : null}
          <Button type="submit" disabled={saving || inviteForm.reviewer_ids.length < minimumReviewerSelection || inviteForm.reviewer_ids.length > remainingReviewerSlots || reviewerAssignableAssignments.length === 0 || !inviteForm.manuscript_id}>{saving ? "Inviting..." : "Assign selected reviewers"}</Button>
        </form>
      </CardContent>
    </Card>
    <Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Reviewer database</CardTitle></CardHeader><CardContent><Table rows={matchedReviewers.length ? matchedReviewers : filteredReviewers} /></CardContent></Card>
  </div>
  if (section === "decisions") return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Editorial Decision Module</CardTitle><CardDescription>Review at least 2 completed reviewer reports before recording an editorial decision.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={async (e)=>{e.preventDefault(); setSaving(true); try { await recordEditorDecision({ manuscript_id: Number(decisionForm.manuscript_id), decision_type: decisionForm.decision_type, decision_letter: decisionForm.decision_letter }); setDecisionForm({ manuscript_id: "", decision_type: "major_revision", decision_letter: "" }); await onSaved(); toast.success("Decision saved.") } catch (error) { toast.error(errorText(error, "Unable to save decision.")) } finally { setSaving(false) } }}><div className="space-y-2"><Label>Manuscript</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={decisionForm.manuscript_id} onChange={(e)=>setDecisionForm((p)=>({...p,manuscript_id:e.target.value}))} disabled={decisionEligibleAssignments.length === 0}><option value="">{decisionEligibleAssignments.length ? "Select manuscript" : "No manuscript currently has 2 completed reviewer reports"}</option>{decisionEligibleAssignments.map((entry)=><option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>{String(entry.reference_number ?? entry.manuscript_id)} - {String(entry.title ?? entry.manuscript_id)} ({String(entry.completed_review_count)} reviews)</option>)}</select></div>{decisionForm.manuscript_id ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><p className="mb-2 font-semibold text-slate-900">Reviewer reports visible to editor</p><p className="whitespace-pre-wrap">{String(decisionEligibleAssignments.find((entry)=>String(entry.manuscript_id)===decisionForm.manuscript_id)?.reviewer_reports ?? "No reviewer report summary is available.")}</p></div> : null}<div className="space-y-2"><Label>Decision</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={decisionForm.decision_type} onChange={(e)=>setDecisionForm((p)=>({...p,decision_type:e.target.value}))}><option value="accept">Accept</option><option value="minor_revision">Minor revision</option><option value="major_revision">Major revision</option><option value="reject">Reject</option></select></div><div className="space-y-2"><Label>Decision letter</Label><Textarea rows={7} value={decisionForm.decision_letter} onChange={(e)=>setDecisionForm((p)=>({...p,decision_letter:e.target.value}))} /></div><Button type="submit" disabled={saving || decisionEligibleAssignments.length === 0 || !decisionForm.manuscript_id}>{saving ? "Saving..." : "Save decision"}</Button></form></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Recorded decisions</CardTitle></CardHeader><CardContent><Table rows={filteredDecisions} /></CardContent></Card></div>
  if (section === "selection") return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Reviewer Selection</CardTitle><CardDescription>Assign each manuscript to a minimum of 2 and maximum of 3 peer reviewers.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={async (e)=>{e.preventDefault(); if (inviteForm.reviewer_ids.length < 2 || inviteForm.reviewer_ids.length > 3) { toast.error("Select 2 to 3 reviewers for peer review."); return } setSaving(true); try { await inviteReviewer({ manuscript_id: Number(inviteForm.manuscript_id), reviewer_ids: inviteForm.reviewer_ids.map(Number), review_model: inviteForm.review_model, review_deadline: inviteForm.review_deadline }); setInviteForm({ manuscript_id: "", reviewer_ids: [], specialization_filter: "", review_model: "single_blind", review_deadline: "" }); await onSaved(); toast.success("Reviewer invitations sent.") } catch (error) { toast.error(errorText(error, "Unable to invite reviewer.")) } finally { setSaving(false) } }}><div className="space-y-2"><Label>Manuscript</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={inviteForm.manuscript_id} onChange={(e)=>setInviteForm((p)=>({...p,manuscript_id:e.target.value}))} disabled={reviewerAssignableAssignments.length === 0}><option value="">{reviewerAssignableAssignments.length ? "Select manuscript" : "All assigned manuscripts already have 3 reviewers"}</option>{reviewerAssignableAssignments.map((entry)=><option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>{String(entry.reference_number ?? entry.manuscript_id)} - {String(entry.title ?? entry.manuscript_id)} ({String(entry.reviewer_invitation_count ?? 0)}/3 invited)</option>)}</select></div>{reviewerAssignableAssignments.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Reviewer selection is available until a manuscript has 3 reviewer invitations.</div> : null}<div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Review model</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={inviteForm.review_model} onChange={(e)=>setInviteForm((p)=>({...p,review_model:e.target.value}))}><option value="single_blind">Single blind</option><option value="double_blind">Double blind</option><option value="open_review">Open review</option></select></div><div className="space-y-2"><Label>Review deadline</Label><Input type="datetime-local" value={inviteForm.review_deadline} onChange={(e)=>setInviteForm((p)=>({...p,review_deadline:e.target.value}))} /></div></div><div className="space-y-2"><Label>Filter by specialization</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={inviteForm.specialization_filter} onChange={(e)=>setInviteForm((p)=>({...p,specialization_filter:e.target.value}))}><option value="">All specialization areas</option>{specializationOptions.map((option)=><option key={option} value={option}>{option}</option>)}</select></div><div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-3"><Label>Select reviewers</Label><span className="text-xs font-semibold text-slate-500">{inviteForm.reviewer_ids.length}/3 selected</span></div><div className="max-h-72 space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-white p-3">{filteredReviewers.map((entry)=><label key={String(entry.user_id)} className="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700"><input type="checkbox" checked={inviteForm.reviewer_ids.includes(String(entry.user_id))} disabled={!inviteForm.reviewer_ids.includes(String(entry.user_id)) && inviteForm.reviewer_ids.length >= 3} onChange={(e)=>setInviteForm((prev)=>({...prev,reviewer_ids:e.target.checked ? [...prev.reviewer_ids, String(entry.user_id)] : prev.reviewer_ids.filter((id)=>id!==String(entry.user_id))}))} /><span><span className="font-semibold text-slate-900">{String(entry.first_name ?? "")} {String(entry.last_name ?? "")}</span><br /><span className="text-slate-500">{String(entry.expertise_area ?? "")}</span></span></label>)}</div></div><Button type="submit" disabled={saving || inviteForm.reviewer_ids.length < 2 || inviteForm.reviewer_ids.length > 3 || reviewerAssignableAssignments.length === 0 || !inviteForm.manuscript_id}>{saving ? "Inviting..." : "Assign selected reviewers"}</Button></form></CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Reviewer database</CardTitle></CardHeader><CardContent><Table rows={filteredReviewers} /></CardContent></Card></div>
  if (section === "assignments") return <div className="grid gap-6"><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<FileText className="h-5 w-5" />} title="Manuscript Assignment Panel" description="Claim new submissions that have not yet been picked up by an editor." /></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-900">Filter by ref #, ID, or title</p><Input className="max-w-xs" value={editorSearch} onChange={(e)=>setEditorSearch(e.target.value)} placeholder="JASTI-000000001" /></div>{filteredUnassigned.length ? filteredUnassigned.map((item)=><div key={String(item.manuscript_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold text-slate-900">{String(item.title ?? item.manuscript_id)}</p><p className="text-sm text-slate-500">Ref: {String(item.reference_number ?? item.manuscript_id)} | Scope: {String(item.scope_area ?? "Not specified")} | Type: {String(item.article_type ?? "")} | Plagiarism: {String(item.plagiarism_score ?? 0)}</p></div><Button size="sm" onClick={async ()=>{try { await claimAssignment({ manuscript_id: Number(item.manuscript_id) }); await onSaved(); toast.success("Manuscript assigned.") } catch (error) { toast.error(errorText(error, "Unable to assign manuscript.")) }}}>Claim assignment</Button></div><div className="mt-3"><ManuscriptFileBundlePreview value={item.file_bundle} emptyMessage="No manuscript file bundle available yet." /></div></div>) : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No unassigned manuscripts.</div>}</CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Workflow className="h-5 w-5" />} title="Current Assignments" /></CardHeader><CardContent><Table rows={filteredAssignments} columns={["reference_number", "title", "scope_area", "status", "article_type", "assigned_date", "file_bundle"]} /></CardContent></Card></div>;  if (section === "screening") return <div className="grid gap-6"><ManualPlagiarismScorePanel entries={filteredActiveAssignments} title="Manual Plagiarism Score" description="Set or revise the manuscript similarity score after editorial screening." emptyMessage="No assigned manuscripts are currently available for plagiarism scoring." onSaved={onSaved} /><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<ShieldCheck className="h-5 w-5" />} title="Initial Screening" description="Check scope, formatting, ethics, and plagiarism indicators before assigning reviewers." /></CardHeader><CardContent className="space-y-4">{activeAssignments.length ? filteredActiveAssignments.map((item)=><div key={String(item.assignment_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold text-slate-900">{String(item.title ?? item.manuscript_id)}</p><div className="mt-3 grid gap-2 text-sm text-slate-500 md:grid-cols-2"><p>Scope area: {String(item.scope_area ?? "Not specified")}</p><p>Plagiarism score: {item.plagiarism_score === null || item.plagiarism_score === undefined || item.plagiarism_score === "" ? "Not set" : `${Number(item.plagiarism_score).toFixed(2)}%`}</p><p>Submission date: {String(item.submission_date ?? "")}</p><p>Workflow status: {String(item.status ?? "")}</p></div><div className="mt-3"><ManuscriptFileBundlePreview value={item.file_bundle} emptyMessage="No manuscript file bundle available yet." /></div></div>) : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No manuscripts currently require editorial screening.</div>}</CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<BookOpenText className="h-5 w-5" />} title="Screening Queue" /></CardHeader><CardContent><Table rows={filteredActiveAssignments} columns={["reference_number", "title", "scope_area", "status", "plagiarism_score", "submission_date", "file_bundle"]} /></CardContent></Card></div>
  if (section === "selection") return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Reviewer Selection</CardTitle><CardDescription>Filter reviewers by specialization and assign one, two, or more reviewers to manuscripts that have not yet entered reviewer invitation workflow.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={async (e)=>{e.preventDefault(); setSaving(true); try { await inviteReviewer({ manuscript_id: Number(inviteForm.manuscript_id), reviewer_ids: inviteForm.reviewer_ids.map(Number) }); setInviteForm({ manuscript_id: "", reviewer_ids: [], specialization_filter: "" }); await onSaved(); toast.success("Reviewer invitations sent.") } catch (error) { toast.error(errorText(error, "Unable to invite reviewer.")) } finally { setSaving(false) } }}><div className="space-y-2"><Label>Manuscript</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={inviteForm.manuscript_id} onChange={(e)=>setInviteForm((p)=>({...p,manuscript_id:e.target.value}))} disabled={reviewerAssignableAssignments.length === 0}><option value="">{reviewerAssignableAssignments.length ? "Select manuscript" : "All assigned manuscripts already have reviewers"}</option>{reviewerAssignableAssignments.map((entry)=><option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>{String(entry.reference_number ?? entry.manuscript_id)} — {String(entry.title ?? entry.manuscript_id)}</option>)}</select></div>{reviewerAssignableAssignments.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">A manuscript disappears from reviewer selection after reviewer invitations have been sent.</div> : null}<div className="space-y-2"><Label>Filter by specialization</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={inviteForm.specialization_filter} onChange={(e)=>setInviteForm((p)=>({...p,specialization_filter:e.target.value}))}><option value="">All specialization areas</option>{specializationOptions.map((option)=><option key={option} value={option}>{option}</option>)}</select></div><div className="space-y-2"><Label>Select reviewer(s)</Label><div className="max-h-72 space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-white p-3">{filteredReviewers.map((entry)=><label key={String(entry.user_id)} className="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700"><input type="checkbox" checked={inviteForm.reviewer_ids.includes(String(entry.user_id))} onChange={(e)=>setInviteForm((prev)=>({...prev,reviewer_ids:e.target.checked ? [...prev.reviewer_ids, String(entry.user_id)] : prev.reviewer_ids.filter((id)=>id!==String(entry.user_id))}))} /><span><span className="font-semibold text-slate-900">{String(entry.first_name ?? "")} {String(entry.last_name ?? "")}</span><br /><span className="text-slate-500">{String(entry.expertise_area ?? "")}</span></span></label>)}</div></div><Button type="submit" disabled={saving || inviteForm.reviewer_ids.length === 0 || reviewerAssignableAssignments.length === 0 || !inviteForm.manuscript_id}>{saving ? "Inviting..." : "Assign selected reviewers"}</Button></form></CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Reviewer database</CardTitle></CardHeader><CardContent><Table rows={filteredReviewers} /></CardContent></Card></div>
  if (section === "monitoring") return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<BarChart3 className="h-5 w-5" />} title="Review Monitoring" description="Track manuscripts in review and reviewer readiness for the next invitation cycle." /></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Active assignments</p><p className="mt-2 text-3xl font-semibold text-slate-950">{activeAssignments.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Reviewer pool</p><p className="mt-2 text-3xl font-semibold text-slate-950">{reviewers.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2"><p className="text-sm font-semibold text-slate-900">Available reviewers</p><p className="mt-2 text-sm text-slate-500">{reviewers.filter((entry)=>String(entry.availability_status)==="available").length} available, {reviewers.filter((entry)=>String(entry.availability_status)==="busy").length} busy.</p></div></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Workflow className="h-5 w-5" />} title="Assignments Under Review" /></CardHeader><CardContent><Table rows={filteredActiveAssignments} /></CardContent></Card></div>
  if (section === "revision") return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Upload className="h-5 w-5" />} title="Revision Management" description="Watch the manuscripts currently in revision and compare them with existing editorial decisions." /></CardHeader><CardContent className="space-y-4">{revisionQueue.length ? filteredRevisionQueue.map((item)=><div key={String(item.assignment_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold text-slate-900">{String(item.title ?? item.manuscript_id)}</p><p className="mt-2 text-sm text-slate-500">Status: {String(item.status ?? "")}</p><p className="text-sm text-slate-500">Assigned on: {String(item.assigned_date ?? "")}</p><div className="mt-3"><ManuscriptFileBundlePreview value={item.file_bundle} emptyMessage="No manuscript file bundle available yet." /></div></div>) : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No manuscripts are currently in the revision queue.</div>}</CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<FileClock className="h-5 w-5" />} title="Decision History for Revisions" /></CardHeader><CardContent><Table rows={filteredDecisions} /></CardContent></Card></div>
  if (section === "analytics") return <div className="grid gap-6 xl:grid-cols-3">{[
    ["Average review time", editorOverview.average_review_time_days ?? 0, "days"],
    ["Acceptance rate", editorOverview.acceptance_rate ?? 0, "%"],
    ["Reviewer responsiveness", editorOverview.reviewer_responsiveness ?? 0, "%"],
    ["Manuscript backlog", editorOverview.manuscript_backlog ?? assignments.length, ""],
    ["Publication pipeline", editorOverview.publication_pipeline ?? 0, ""],
    ["Available reviewers", reviewers.filter((entry)=>String(entry.availability_status)==="available").length, ""],
  ].map(([label, value, suffix])=><Card key={String(label)} className="border-white/70 bg-white/85 backdrop-blur"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{String(label)}</p><p className="mt-2 text-3xl font-semibold text-slate-950">{String(value)}{String(suffix)}</p></CardContent></Card>)}</div>
  return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Editorial Decision Module</CardTitle><CardDescription>Issue editorial recommendations only after reviewer reports have been submitted.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={async (e)=>{e.preventDefault(); setSaving(true); try { await recordEditorDecision({ manuscript_id: Number(decisionForm.manuscript_id), decision_type: decisionForm.decision_type, decision_letter: decisionForm.decision_letter }); setDecisionForm({ manuscript_id: "", decision_type: "major_revision", decision_letter: "" }); await onSaved(); toast.success("Decision saved.") } catch (error) { toast.error(errorText(error, "Unable to save decision.")) } finally { setSaving(false) } }}><div className="space-y-2"><Label>Manuscript</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={decisionForm.manuscript_id} onChange={(e)=>setDecisionForm((p)=>({...p,manuscript_id:e.target.value}))} disabled={decisionEligibleAssignments.length === 0}><option value="">{decisionEligibleAssignments.length ? "Select manuscript" : "No manuscript currently has completed reviewer reports"}</option>{decisionEligibleAssignments.map((entry)=><option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>{String(entry.reference_number ?? entry.manuscript_id)} — {String(entry.title ?? entry.manuscript_id)} ({String(entry.completed_review_count)} review{Number(entry.completed_review_count) === 1 ? "" : "s"})</option>)}</select></div>{decisionEligibleAssignments.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Editorial decisions become available only after at least one reviewer report has been submitted.</div> : null}<div className="space-y-2"><Label>Decision</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={decisionForm.decision_type} onChange={(e)=>setDecisionForm((p)=>({...p,decision_type:e.target.value}))}><option value="accept">Accept</option><option value="minor_revision">Minor revision</option><option value="major_revision">Major revision</option><option value="reject">Reject</option></select></div><div className="space-y-2"><Label>Decision letter</Label><Textarea rows={7} value={decisionForm.decision_letter} onChange={(e)=>setDecisionForm((p)=>({...p,decision_letter:e.target.value}))} /></div><Button type="submit" disabled={saving || decisionEligibleAssignments.length === 0 || !decisionForm.manuscript_id}>{saving ? "Saving..." : "Save decision"}</Button></form></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Recorded decisions</CardTitle></CardHeader><CardContent><Table rows={filteredDecisions} /></CardContent></Card></div>
}

function TechnicalEditorPanels({ section, workspace, settings, onSaved }: { section: string; workspace: WorkspacePayload; settings: JournalSettings; onSaved: () => Promise<void> }) {
  const screenings = asArray(workspace.editor?.technical_screenings)
  const [statusFilter, setStatusFilter] = React.useState("pending")
  const [page, setPage] = React.useState(1)
  const [savingId, setSavingId] = React.useState<number | null>(null)
  const [forms, setForms] = React.useState<Record<string, { grammar_quality: string; ai_score: string; similarity_score: string; file: File | null }>>({})
  const defaultScreeningForm = React.useMemo(() => ({
    grammar_quality: String(numericSetting(settings.default_gq_percent, 0)),
    ai_score: String(numericSetting(settings.default_ai_score_percent, 0)),
    similarity_score: String(numericSetting(settings.default_similarity_percent, 0)),
    file: null as File | null,
  }), [settings.default_ai_score_percent, settings.default_gq_percent, settings.default_similarity_percent])
  const filtered = screenings.filter((entry) => statusFilter === "all" || String(entry.technical_status ?? "pending") === statusFilter)
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10))
  const pageRows = filtered.slice((Math.min(page, pageCount) - 1) * 10, Math.min(page, pageCount) * 10)
  const productionRows = screenings.filter((entry) => ["accepted", "production"].includes(String(entry.status ?? "").toLowerCase()) && (Number(entry.publication_payment_confirmed ?? 0) === 1 || String(entry.publication_payment_confirmed ?? "") === "1") && String(entry.publication_pdf_path ?? "").trim() === "")
  const [productionFiles, setProductionFiles] = React.useState<Record<string, File | null>>({})
  const [productionSavingId, setProductionSavingId] = React.useState<number | null>(null)
  React.useEffect(() => setPage(1), [statusFilter])
  const updateForm = (manuscriptId: string, patch: Partial<{ grammar_quality: string; ai_score: string; similarity_score: string; file: File | null }>) => {
    setForms((prev) => ({ ...prev, [manuscriptId]: { ...defaultScreeningForm, ...(prev[manuscriptId] ?? {}), ...patch } }))
  }
  const submit = async (entry: Record<string, unknown>) => {
    const manuscriptId = String(entry.manuscript_id)
    const form = forms[manuscriptId] ?? defaultScreeningForm
    if (!form.file) {
      toast.error("Upload the anonymized DOC/DOCX file.")
      return
    }
    setSavingId(Number(entry.manuscript_id))
    try {
      const payload = new FormData()
      payload.append("action", "submit_screening")
      payload.append("manuscript_id", manuscriptId)
      payload.append("grammar_quality", form.grammar_quality)
      payload.append("ai_score", form.ai_score)
      payload.append("similarity_score", form.similarity_score)
      payload.append("anonymized_file", form.file)
      const response = await submitTechnicalScreening(payload as unknown as Record<string, unknown>)
      setForms((prev) => ({ ...prev, [manuscriptId]: defaultScreeningForm }))
      await onSaved()
      toast.success(response.message)
    } catch (error) {
      toast.error(errorText(error, "Unable to submit technical screening."))
    } finally {
      setSavingId(null)
    }
  }
  const submitProductionPdf = async (entry: Record<string, unknown>) => {
    const manuscriptId = String(entry.manuscript_id)
    const file = productionFiles[manuscriptId]
    if (!file) {
      toast.error("Upload the approved PDF file.")
      return
    }
    setProductionSavingId(Number(entry.manuscript_id))
    try {
      const payload = new FormData()
      payload.append("manuscript_id", manuscriptId)
      payload.append("publication_pdf", file)
      const response = await uploadProductionPdf(payload)
      setProductionFiles((prev) => ({ ...prev, [manuscriptId]: null }))
      await onSaved()
      toast.success(response.message)
    } catch (error) {
      toast.error(errorText(error, "Unable to upload final publication PDF."))
    } finally {
      setProductionSavingId(null)
    }
  }
  if (section === "communication") return <MessagesCard workspace={workspace} user={workspace.user} onSaved={onSaved} />
  return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between"><CardHeading icon={<ShieldCheck className="h-5 w-5" />} title="Technical Screening Queue" description="Paid manuscripts can be downloaded and attended. Completed items move under the attended filter." /><select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}><option value="pending">Pending</option><option value="attended">Attended</option><option value="rejected">Rejected by editor</option><option value="approved">Approved by editor</option><option value="all">All</option></select></CardHeader><CardContent className="space-y-4">{pageRows.length ? pageRows.map((entry) => { const manuscriptId = String(entry.manuscript_id); const paid = Number(entry.submission_payment_confirmed ?? 0) === 1 || String(entry.submission_payment_confirmed ?? "") === "1"; const form = forms[manuscriptId] ?? defaultScreeningForm; return <div key={String(entry.screening_id ?? entry.manuscript_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p className="font-semibold text-slate-950">{String(entry.title ?? entry.manuscript_id)}</p><p className="mt-1 text-sm text-slate-500">Ref: {String(entry.reference_number ?? entry.manuscript_id)} | Status: {String(entry.technical_status ?? "pending")} | Payment: {paid ? "Confirmed" : "Required"}</p>{entry.editor_rejection_reason ? <p className="mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">Editor rejection: {String(entry.editor_rejection_reason)}</p> : null}</div>{paid ? <ManuscriptFileBundlePreview value={entry.file_bundle} emptyMessage="No source file found." /> : <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Author must complete the configured submission payment before file access.</div>}</div>{paid && ["pending", "rejected"].includes(String(entry.technical_status ?? "pending")) ? <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_120px_120px_120px_auto] lg:items-end"><FileDropzone label="Anonymized paper" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" helperText="Upload DOC or DOCX without author names and affiliations." file={form.file} onFileSelect={(file)=>updateForm(manuscriptId, { file })} onRemove={()=>updateForm(manuscriptId, { file: null })} /><div className="space-y-2"><Label>GQ %</Label><Input type="number" min="0" max="100" value={form.grammar_quality} onChange={(e)=>updateForm(manuscriptId, { grammar_quality: e.target.value })} /></div><div className="space-y-2"><Label>AI %</Label><Input type="number" min="0" max="100" value={form.ai_score} onChange={(e)=>updateForm(manuscriptId, { ai_score: e.target.value })} /></div><div className="space-y-2"><Label>Similarity %</Label><Input type="number" min="0" max="100" value={form.similarity_score} onChange={(e)=>updateForm(manuscriptId, { similarity_score: e.target.value })} /></div><Button type="button" disabled={savingId === Number(entry.manuscript_id)} onClick={()=>void submit(entry)}>{savingId === Number(entry.manuscript_id) ? "Submitting..." : "Submit"}</Button></div> : null}</div> }) : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No submissions in this filter.</div>}<div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4"><Button type="button" variant="outline" disabled={page <= 1} onClick={()=>setPage((current)=>Math.max(1, current - 1))}>Previous</Button><span className="text-sm text-slate-500">Page {Math.min(page, pageCount)} of {pageCount}</span><Button type="button" variant="outline" disabled={page >= pageCount} onClick={()=>setPage((current)=>Math.min(pageCount, current + 1))}>Next</Button></div></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Upload className="h-5 w-5" />} title="Final Publication PDF" description="After author publication payment, upload the approved PDF so the Editor-in-Chief can publish." /></CardHeader><CardContent className="space-y-4">{productionRows.length ? productionRows.map((entry) => { const manuscriptId = String(entry.manuscript_id); return <div key={`production-${manuscriptId}`} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p className="font-semibold text-slate-950">{String(entry.title ?? entry.manuscript_id)}</p><p className="mt-1 text-sm text-slate-500">Ref: {String(entry.reference_number ?? entry.manuscript_id)} | Status: {String(entry.status ?? "")} | Publication payment confirmed</p></div><ManuscriptFileBundlePreview value={entry.file_bundle} emptyMessage="No files available." /></div><div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end"><FileDropzone label="Approved publication PDF" accept=".pdf,application/pdf" helperText="Upload final approved PDF only." file={productionFiles[manuscriptId] ?? null} onFileSelect={(file)=>setProductionFiles((prev)=>({ ...prev, [manuscriptId]: file }))} onRemove={()=>setProductionFiles((prev)=>({ ...prev, [manuscriptId]: null }))} /><Button type="button" disabled={productionSavingId === Number(entry.manuscript_id)} onClick={()=>void submitProductionPdf(entry)}>{productionSavingId === Number(entry.manuscript_id) ? "Uploading..." : "Mark ready"}</Button></div></div> }) : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No paid accepted manuscripts are waiting for final PDF upload.</div>}</CardContent></Card></div>
}

function EicPanels({ section, workspace, onSaved }: { section: string; workspace: WorkspacePayload; onSaved: () => Promise<void> }) {
  const overview = asRecord(workspace.editor_in_chief?.overview)
  const editorDecisions = asArray(workspace.editor_in_chief?.editor_decisions)
  const finalDecisions = asArray(workspace.editor_in_chief?.final_decisions)
  const publishedArticles = asArray((workspace.editor_in_chief as Record<string, unknown> | undefined)?.published_articles)
  const issues = asArray((workspace.editor_in_chief as Record<string, unknown> | undefined)?.issues)
  const users = asArray(workspace.editor_in_chief?.users)
  const paymentQueue = asArray((workspace.editor_in_chief as Record<string, unknown> | undefined)?.payments)
  const copyrightQueue = asArray((workspace.editor_in_chief as Record<string, unknown> | undefined)?.copyright_forms)
  const receiptReviewQueue = paymentQueue.filter((entry) => String(entry.proof_file_path ?? "").trim() !== "" && String(entry.payment_status ?? "") !== "reviewed")
  const authors = users.filter((entry) => Array.isArray(entry.roles) && entry.roles.includes("author"))
  const editors = users.filter((entry) => Array.isArray(entry.roles) && (entry.roles.includes("editor_in_chief") || hasEditorWorkspaceRole(entry.roles)))
  const reviewers = users.filter((entry) => Array.isArray(entry.roles) && entry.roles.includes("reviewer"))
  const [eicSearch, setEicSearch] = React.useState("")
  const allManuscripts = asArray(workspace.editor_in_chief?.manuscripts || workspace.admin?.manuscripts)
  const [manageArticlesSearch, setManageArticlesSearch] = React.useState("")
  const matchesEicSearch = React.useCallback((entry: Record<string, unknown>) => {
    const q = eicSearch.trim().toLowerCase()
    if (!q) return true
    const fields = ["reference_number", "manuscript_id", "title", "decision_type", "final_decision", "status", "author_name", "volume", "issue_number", "publication_year", "publication_date", "user_id", "first_name", "last_name", "email", "institution", "country", "roles"]
    return fields.some((field) => String(entry?.[field] ?? "").toLowerCase().includes(q))
  }, [eicSearch])
  const matchesManageSearch = React.useCallback((entry: Record<string, unknown>) => {
    const q = manageArticlesSearch.trim().toLowerCase()
    if (!q) return true
    const fields = ["reference_number", "manuscript_id", "title", "status", "author_name", "publication_date", "article_type", "scope_area", "volume", "issue_number"]
    return fields.some((field) => String(entry?.[field] ?? "").toLowerCase().includes(q))
  }, [manageArticlesSearch])
  const filterEic = (list: Array<Record<string, unknown>>) => list.filter(matchesEicSearch)
  const filterManageArticles = (list: Array<Record<string, unknown>>) => list.filter(matchesManageSearch)
  const filteredEditorDecisions = filterEic(editorDecisions)
  const filteredFinalDecisions = filterEic(finalDecisions)
  const filteredPublishedArticles = filterEic(publishedArticles)
  const filteredAllManuscripts = filterManageArticles(allManuscripts)
  const publishReadyDecisions = finalDecisions.filter((entry) => String(entry.final_decision ?? "").toLowerCase() === "accepted")
  const filteredPublishReadyDecisions = filterEic(publishReadyDecisions)
  const filteredPaymentQueue = filterEic(paymentQueue)
  const filteredCopyrightQueue = filterEic(copyrightQueue)
  const filteredUsers = filterEic(users)
  const filteredAuthors = filterEic(authors)
  const filteredEditors = filterEic(editors)
  const filteredReviewers = filterEic(reviewers)
  const filteredReceiptReviewQueue = filterEic(receiptReviewQueue)
  const [form, setForm] = React.useState({ manuscript_id: "", final_decision: "accepted", remarks: "" })
  const [saving, setSaving] = React.useState(false)
  const [publishingId, setPublishingId] = React.useState<number | null>(null)
  const [sendingReminderId, setSendingReminderId] = React.useState<number | null>(null)
  const [archivingId, setArchivingId] = React.useState<number | null>(null)
  const [publishModal, setPublishModal] = React.useState<{ manuscript_id: number; title: string } | null>(null)
  const [publishForm, setPublishForm] = React.useState({ total_pages: "" })
  const [isCalculatingPublishPages, setIsCalculatingPublishPages] = React.useState(false)
  const [publishPagesNote, setPublishPagesNote] = React.useState("")
  const [publishPagesTone, setPublishPagesTone] = React.useState<"muted" | "success" | "warning">("muted")
  const [issueForm, setIssueForm] = React.useState({
    volume: "",
    issue_number: "",
    publication_year: "",
    publication_date: "",
    status: "upcoming",
  })
  const [issueSaving, setIssueSaving] = React.useState(false)
  const [issueDeletingId, setIssueDeletingId] = React.useState<number | null>(null)
  const [issueEditingId, setIssueEditingId] = React.useState<number | null>(null)
  const [issueEditModal, setIssueEditModal] = React.useState<{ issue_id: number; label: string } | null>(null)
  const [issueEditStatus, setIssueEditStatus] = React.useState("upcoming")
  const [deletingId, setDeletingId] = React.useState<number | null>(null)
  const selectedPublishEntry = React.useMemo(
    () => publishModal ? filteredPublishReadyDecisions.find((entry) => Number(entry.manuscript_id) === publishModal.manuscript_id) ?? null : null,
    [filteredPublishReadyDecisions, publishModal],
  )
  const openPublishModal = (entry: Record<string, unknown>) => {
    setPublishModal({
      manuscript_id: Number(entry.manuscript_id),
      title: String(entry.title ?? entry.manuscript_id),
    })
    setPublishForm({ total_pages: "" })
    setPublishPagesNote("")
    setPublishPagesTone("muted")
  }
  const closePublishModal = () => {
    if (publishingId !== null) return
    setPublishModal(null)
    setPublishForm({ total_pages: "" })
    setPublishPagesNote("")
    setPublishPagesTone("muted")
    setIsCalculatingPublishPages(false)
  }
  const publishSelectedManuscript = async (manuscriptId: number, totalPages: string) => {
    setPublishingId(manuscriptId)
    try {
      await publishManuscript({ manuscript_id: manuscriptId, page_numbers: totalPages })
      await onSaved()
      setPublishModal(null)
      setPublishForm({ total_pages: "" })
      toast.success("Manuscript published successfully.")
    } catch (error) {
      toast.error(errorText(error, "Unable to publish manuscript."))
    } finally {
      setPublishingId(null)
    }
  }
  const handleDeletePublication = async (entry: Record<string, unknown>) => {
    const manuscriptId = Number(entry.manuscript_id ?? 0)
    const articleId = Number(entry.article_id ?? 0)
    setDeletingId(manuscriptId || (articleId || null))
    try {
      const payload: Record<string, unknown> = {}
      if (articleId) payload.article_id = articleId
      else if (manuscriptId) payload.manuscript_id = manuscriptId
      await deletePublication(payload)
      await onSaved()
      toast.success("Publication and all related records were deleted successfully.")
    } catch (error) {
      toast.error(errorText(error, "Unable to delete publication."))
    } finally {
      setDeletingId(null)
    }
  }

  const handleEditPublication = async (entry: Record<string, unknown>, form: PublicationEditForm) => {
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        publication_date: form.publication_date,
        reference_number: form.reference_number,
      }
      if (entry.article_id) payload.article_id = Number(entry.article_id)
      else if (entry.manuscript_id) payload.manuscript_id = Number(entry.manuscript_id)
      await updatePublication(payload)
      await onSaved()
      toast.success("Publication updated.")
    } catch (error) {
      toast.error(errorText(error, "Unable to update publication."))
    }
  }
  const archivePublishedManuscript = async (manuscriptId: number) => {
    setArchivingId(manuscriptId)
    try {
      await archivePublication({ manuscript_id: manuscriptId })
      await onSaved()
      toast.success("Publication archived. It stays preserved internally and is removed from public article pages.")
    } catch (error) {
      toast.error(errorText(error, "Unable to archive publication."))
    } finally {
      setArchivingId(null)
    }
  }
  React.useEffect(() => {
    let cancelled = false

    const updateTotalPages = (nextValue: string) => {
      setPublishForm((prev) => (prev.total_pages === nextValue ? prev : { ...prev, total_pages: nextValue }))
    }

    const clearState = () => {
      setIsCalculatingPublishPages(false)
      setPublishPagesNote("")
      setPublishPagesTone("muted")
      updateTotalPages("")
    }

    if (!publishModal || !selectedPublishEntry) {
      clearState()
      return
    }

    setIsCalculatingPublishPages(true)
    setPublishPagesTone("muted")
    setPublishPagesNote("Generating total pages...")
    updateTotalPages("")

    void (async () => {
      try {
        const manuscriptFile = resolvePaymentManuscriptEntry(selectedPublishEntry.file_bundle)
        const fallbackPageCount = countPagesFromPageNumbers(selectedPublishEntry.page_numbers)

        if (!manuscriptFile) {
          if (fallbackPageCount > 0) {
            if (!cancelled) {
              updateTotalPages(String(fallbackPageCount))
              setPublishPagesTone("success")
              setPublishPagesNote(`Total pages generated from recorded article data: ${fallbackPageCount}.`)
            }
            return
          }

          if (!cancelled) {
            setPublishPagesTone("warning")
            setPublishPagesNote("No manuscript file was found, so total pages could not be generated yet.")
          }
          return
        }

        if (manuscriptFile.extension !== "pdf") {
          if (!cancelled) {
            setPublishPagesTone("warning")
            setPublishPagesNote("Selected manuscript is not PDF.")
          }
          return
        }

        const totalPages = await countPdfPagesFromUrl(manuscriptFile.url)
        if (totalPages <= 0) {
          throw new Error("Unable to determine the PDF page count.")
        }

        if (!cancelled) {
          updateTotalPages(String(totalPages))
          setPublishPagesTone("success")
          setPublishPagesNote(`Total pages generated: ${totalPages}.`)
        }
      } catch (error) {
        const fallbackPageCount = countPagesFromPageNumbers(selectedPublishEntry.page_numbers)
        if (!cancelled && fallbackPageCount > 0) {
          updateTotalPages(String(fallbackPageCount))
          setPublishPagesTone("success")
          setPublishPagesNote(`Total pages generated from recorded article data: ${fallbackPageCount}.`)
          return
        }

        if (!cancelled) {
          const message = error instanceof Error && error.message ? error.message : "Unable to calculate total pages right now."
          setPublishPagesTone("warning")
          setPublishPagesNote(message)
        }
      } finally {
        if (!cancelled) {
          setIsCalculatingPublishPages(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [publishModal, selectedPublishEntry])
  const sendPaymentReminderForManuscript = async (manuscriptId: number) => {
    setSendingReminderId(manuscriptId)
    try {
      const response = await sendPaymentReminder({ manuscript_id: manuscriptId })
      toast.success(response.message)
      await onSaved()
    } catch (error) {
      toast.error(errorText(error, "Unable to send payment reminder."))
    } finally {
      setSendingReminderId(null)
    }
  }
  const createIssue = async (e: React.FormEvent) => {
    e.preventDefault()
    setIssueSaving(true)
    try {
      await manageIssues({
        action: "create",
        volume: Number(issueForm.volume),
        issue_number: Number(issueForm.issue_number),
        publication_year: Number(issueForm.publication_year),
        publication_date: issueForm.publication_date,
        status: issueForm.status,
      })
      setIssueForm({ volume: "", issue_number: "", publication_year: "", publication_date: "", status: "upcoming" })
      await onSaved()
      toast.success("Issue created successfully.")
    } catch (error) {
      toast.error(errorText(error, "Unable to create issue."))
    } finally {
      setIssueSaving(false)
    }
  }
  const deleteIssue = async (issueId: number) => {
    setIssueDeletingId(issueId)
    try {
      await manageIssues({ action: "delete", issue_id: issueId })
      await onSaved()
      toast.success("Issue deleted successfully.")
    } catch (error) {
      toast.error(errorText(error, "Unable to delete issue."))
    } finally {
      setIssueDeletingId(null)
    }
  }
  const openIssueEditModal = (issue: Record<string, unknown>) => {
    setIssueEditModal({
      issue_id: Number(issue.issue_id),
      label: `Volume ${String(issue.volume ?? "")}, Issue ${String(issue.issue_number ?? "")}`,
    })
    setIssueEditStatus(String(issue.status ?? "upcoming"))
  }
  const closeIssueEditModal = () => {
    if (issueEditingId !== null) return
    setIssueEditModal(null)
    setIssueEditStatus("upcoming")
  }
  const editIssueStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!issueEditModal) return
    setIssueEditingId(issueEditModal.issue_id)
    try {
      await manageIssues({ action: "edit", issue_id: issueEditModal.issue_id, status: issueEditStatus })
      await onSaved()
      setIssueEditModal(null)
      setIssueEditStatus("upcoming")
      toast.success("Issue updated successfully.")
    } catch (error) {
      toast.error(errorText(error, "Unable to update issue."))
    } finally {
      setIssueEditingId(null)
    }
  }
  if (section === "final-decisions") {
    return (
      <>
        <div className="grid gap-6">
          <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
            <CardHeader>
              <CardTitle>Final Decision Authority</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault()
                  setSaving(true)
                  try {
                    const isAcceptedDecision = form.final_decision === "accepted"
                    const response = await recordFinalDecision({
                      manuscript_id: Number(form.manuscript_id),
                      final_decision: form.final_decision,
                      remarks: form.remarks,
                    })
                    setForm({ manuscript_id: "", final_decision: "accepted", remarks: "" })
                    await onSaved()
                    toast.success(isAcceptedDecision && response.email_message ? response.email_message : response.message)
                  } catch (error) {
                    toast.error(errorText(error, "Unable to save final decision."))
                  } finally {
                    setSaving(false)
                  }
                }}
              >
                <div className="space-y-2">
                  <Label>Editor recommendation</Label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    value={form.manuscript_id}
                    onChange={(e) => setForm((p) => ({ ...p, manuscript_id: e.target.value }))}
                  >
                    <option value="">Select manuscript</option>
                    {editorDecisions.map((entry) => (
                      <option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>
                        {String(entry.reference_number ?? entry.manuscript_id)} — {String(entry.title ?? entry.manuscript_id)} | {String(entry.decision_type ?? "")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Final decision</Label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    value={form.final_decision}
                    onChange={(e) => setForm((p) => ({ ...p, final_decision: e.target.value }))}
                  >
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Remarks</Label>
                  <Textarea rows={7} value={form.remarks} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} />
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save final decision"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
            <CardHeader>
              <CardHeading
                icon={<Workflow className="h-5 w-5" />}
                title="Publish Accepted Manuscripts"
                description="Publication stays locked until author payment is recorded. Use the reminder action to nudge unpaid authors."
              />
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredPublishReadyDecisions.length ? (
                filteredPublishReadyDecisions.map((entry) => {
                  const manuscriptId = Number(entry.manuscript_id)
                  const alreadyPublished = String(entry.status ?? "").toLowerCase() === "published"
                  const archived = Number(entry.archived ?? 0) === 1 || String(entry.archived ?? "") === "1"
                  const paymentCompleted = Number(entry.payment_completed ?? 0) === 1 || String(entry.payment_completed ?? "") === "1"
                  const paymentStatus = String(entry.payment_status ?? "").trim() || "awaiting_payment"

                  return (
                    <div key={String(entry.final_decision_id ?? entry.manuscript_id)} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{String(entry.title ?? entry.manuscript_id)}</p>
                          <p className="text-sm text-slate-500">
                            Ref: {String(entry.reference_number ?? entry.manuscript_id)} | Final decision: {String(entry.final_decision ?? "")} | Approved: {String(entry.approval_date ?? "")}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">Payment status: {paymentStatus.replaceAll("_", " ")}</p>
                          {alreadyPublished ? <p className="mt-1 text-sm font-medium text-emerald-700">{archived ? "published, archived" : "published"}</p> : null}
                          {!alreadyPublished && !paymentCompleted ? (
                            <p className="mt-1 text-sm font-medium text-amber-700">Awaiting author payment before publication.</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => openPublishModal(entry)}
                            disabled={alreadyPublished || archived || !paymentCompleted || publishingId === manuscriptId}
                          >
                            {alreadyPublished ? "Published" : publishingId === manuscriptId ? "Publishing..." : "Publish manuscript"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => { await archivePublishedManuscript(manuscriptId) }}
                            disabled={!alreadyPublished || archived || archivingId === manuscriptId}
                          >
                            {archived ? "Archived" : archivingId === manuscriptId ? "Archiving..." : "Archive publication"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await sendPaymentReminderForManuscript(manuscriptId)
                            }}
                            disabled={alreadyPublished || paymentCompleted || sendingReminderId === manuscriptId}
                          >
                            {paymentCompleted ? "Payment complete" : sendingReminderId === manuscriptId ? "Sending..." : "Send payment reminder"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No accepted final decisions are waiting for publication.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Final decisions</CardTitle>
              <Input className="max-w-xs" placeholder="Search ref #, ID, title" value={eicSearch} onChange={(e) => setEicSearch(e.target.value)} />
            </CardHeader>
            <CardContent>
              <Table rows={filteredFinalDecisions} />
            </CardContent>
          </Card>
        </div>

        {publishModal ? (
          <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/50 p-4">
            <div className="w-full max-w-xl rounded-3xl border border-white/70 bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="display-modal text-slate-950">Publish Manuscript</h3>
                  <p className="mt-2 text-sm text-slate-600">{publishModal.title}</p>
                </div>
                <button
                  type="button"
                  onClick={closePublishModal}
                  className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  disabled={publishingId !== null}
                >
                  Close
                </button>
              </div>
              <form
                className="mt-6 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!publishForm.total_pages.trim()) {
                    toast.error("Total pages have not been generated yet.")
                    return
                  }
                  await publishSelectedManuscript(publishModal.manuscript_id, publishForm.total_pages.trim())
                }}
              >
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  {issues.length
                    ? `Publishing will use the latest issue on record: Vol. ${String(issues[0]?.volume ?? "")}, Issue ${String(issues[0]?.issue_number ?? "")} (${String(issues[0]?.publication_year ?? "")})`
                    : "No issue exists yet. Create one first from Manage Issues before publishing."}
                </div>
                <div className="space-y-2">
                  <Label>Total pages</Label>
                  <Input
                    value={publishForm.total_pages}
                    readOnly
                    aria-busy={isCalculatingPublishPages}
                    placeholder={isCalculatingPublishPages ? "Generating total pages..." : "Generated automatically"}
                  />
                  <p className="text-xs text-slate-500">Total pages are generated automatically from the selected manuscript PDF.</p>
                  {publishPagesNote ? (
                    <p
                      className={cn(
                        "rounded-2xl border px-3 py-2 text-sm",
                        publishPagesTone === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : publishPagesTone === "warning"
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-slate-200 bg-slate-50 text-slate-600",
                      )}
                    >
                      {publishPagesNote}
                    </p>
                  ) : null}
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={closePublishModal} disabled={publishingId !== null}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={publishingId !== null || issues.length === 0 || isCalculatingPublishPages || !publishForm.total_pages}
                  >
                    {publishingId !== null ? "Publishing..." : "Publish manuscript"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </>
    )
  }
  if (section === "overview") return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<BookMarked className="h-5 w-5" />} title="Journal Overview Panel" /></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{Object.entries(overview).map(([key, value]) => <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{key.replaceAll("_", " ")}</p><p className="mt-2 text-3xl font-semibold text-slate-950">{String(value)}</p></div>)}</CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader className="flex flex-wrap items-center justify-between gap-3"><CardHeading icon={<FileClock className="h-5 w-5" />} title="Editor Decision Feed" /><Input className="max-w-xs" placeholder="Search ref #, ID, title" value={eicSearch} onChange={(e)=>setEicSearch(e.target.value)} /></CardHeader><CardContent><Table rows={filteredEditorDecisions} /></CardContent></Card></div>

  if (section === "published-articles") {
    return (
      <div className="grid gap-6">
        <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <CardHeading icon={<BookMarked className="h-5 w-5" />} title="Published Articles" description="List of published articles" />
            <Input className="max-w-xs" placeholder="Search author, title, ref #" value={eicSearch} onChange={(e) => setEicSearch(e.target.value)} />
          </CardHeader>
          <CardContent>
            <PublicationRecordsTable
              rows={filteredPublishedArticles}
              search={eicSearch}
              onSearchChange={(v) => setEicSearch(v)}
              deletingId={deletingId}
              onDelete={handleDeletePublication}
              onEdit={handleEditPublication}
              emptyMessage="No published articles are available."
            />
          </CardContent>
        </Card>
      </div>
    )
  }
  if (section === "manage-all-articles") {
    return <AdminManageAllArticlesPanel workspace={workspace} onSaved={onSaved} filterType="all" />
  }
  if (section === "view-submitted-articles") {
    return <AdminManageAllArticlesPanel workspace={workspace} onSaved={onSaved} filterType="unpaid_submitted" />
  }
  if (section === "board") return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader className="flex flex-wrap items-center justify-between gap-3"><CardHeading icon={<Users className="h-5 w-5" />} title="Editorial Board Management" description="Track authors, reviewers, and editors in separate rosters so each workflow group is easier to manage." /><Input className="max-w-xs" placeholder="Search ID, name, email, role" value={eicSearch} onChange={(e)=>setEicSearch(e.target.value)} /></CardHeader><CardContent className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Authors</p><p className="mt-2 text-3xl font-semibold text-slate-950">{authors.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Reviewers</p><p className="mt-2 text-3xl font-semibold text-slate-950">{reviewers.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Editors</p><p className="mt-2 text-3xl font-semibold text-slate-950">{editors.length}</p></div></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<BookOpenText className="h-5 w-5" />} title="Author Roster" description="Registered authors and corresponding-author accounts." /></CardHeader><CardContent><Table rows={filteredAuthors} columns={["user_id", "first_name", "last_name", "email", "institution", "country", "roles", "status"]} /></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Microscope className="h-5 w-5" />} title="Reviewer Roster" description="Peer reviewers currently available in the journal workspace." /></CardHeader><CardContent><Table rows={filteredReviewers} columns={["user_id", "first_name", "last_name", "email", "institution", "country", "roles", "status"]} /></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<FileClock className="h-5 w-5" />} title="Editor Roster" description="Editorial board members, section editors, managing editors, and the Editor-in-Chief." /></CardHeader><CardContent><Table rows={filteredEditors} columns={["user_id", "first_name", "last_name", "email", "institution", "country", "roles", "status"]} /></CardContent></Card></div>
  if (section === "ethics") return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<ShieldCheck className="h-5 w-5" />} title="Ethics and Compliance" description="Review the queue of decisions, payment records, and copyright submissions that need executive oversight." /></CardHeader><CardContent className="grid gap-4 grid-cols-1 md:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Payment queue</p><p className="mt-2 text-3xl font-semibold text-slate-950">{paymentQueue.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Receipt review queue</p><p className="mt-2 text-3xl font-semibold text-slate-950">{receiptReviewQueue.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Copyright queue</p><p className="mt-2 text-3xl font-semibold text-slate-950">{copyrightQueue.length}</p></div><div className="min-w-0 md:col-span-3"><Table rows={filteredEditorDecisions} /></div></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Workflow className="h-5 w-5" />} title="Submission Compliance Queues" /></CardHeader><CardContent className="grid gap-6"><div className="min-w-0"><p className="mb-3 text-sm font-semibold text-slate-900">Receipt review actions</p><div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 max-h-[22rem] overflow-y-auto">{receiptReviewQueue.length ? filteredReceiptReviewQueue.map((entry)=><div key={String(entry.payment_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3"><div><p className="font-semibold text-slate-900">{String(entry.title ?? entry.manuscript_id)}</p><p className="text-sm text-slate-500">Author: {String(entry.author_name ?? "")} | Ref: {String(entry.payment_reference ?? "")}</p><div className="mt-2"><PaymentStatusBadge status={paymentLifecycleStatus(entry)} /></div></div><div className="flex flex-wrap gap-2"><Button size="sm" onClick={async ()=>{ try { await reviewPaymentReceipt({ payment_id: Number(entry.payment_id), action: "review" }); await onSaved(); toast.success("Payment receipt marked as reviewed.") } catch (error) { toast.error(errorText(error, "Unable to review receipt.")) } }}>Mark reviewed</Button><Button size="sm" variant="outline" onClick={async ()=>{ try { await reviewPaymentReceipt({ payment_id: Number(entry.payment_id), action: "reject" }); await onSaved(); toast.success("Payment receipt rejected.") } catch (error) { toast.error(errorText(error, "Unable to reject receipt.")) } }}>Reject</Button></div></div></div>) : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No payment receipts are waiting for review.</div>}</div></div><div className="min-w-0"><p className="mb-3 text-sm font-semibold text-slate-900">Payments</p><Table rows={filteredPaymentQueue} /></div><div className="min-w-0"><p className="mb-3 text-sm font-semibold text-slate-900">Copyright forms</p><Table rows={filteredCopyrightQueue} /></div></CardContent></Card></div>
  if (section === "applications") return <ApplicationsReview onSaved={onSaved} />
  if (section === "impact") return <div className="grid gap-6 xl:grid-cols-3"><Card className="border-white/70 bg-white/85 backdrop-blur"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Editor decisions</p><p className="mt-2 text-3xl font-semibold text-slate-950">{filteredEditorDecisions.length}</p></CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Final decisions</p><p className="mt-2 text-3xl font-semibold text-slate-950">{filteredFinalDecisions.length}</p></CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Published readiness</p><p className="mt-2 text-3xl font-semibold text-slate-950">{String(overview.published ?? 0)}</p></CardContent></Card></div>
  if (section === "reports") return <ReportsPanel />
  if (section === "manage-issues") return <><div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<BookMarked className="h-5 w-5" />} title="Manage Issues" description="Create issue records that publication will use automatically." /></CardHeader><CardContent><form className="space-y-4" onSubmit={createIssue}><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Volume</Label><Input value={issueForm.volume} onChange={(e)=>setIssueForm((prev)=>({...prev, volume: e.target.value}))} placeholder="1" /></div><div className="space-y-2"><Label>Issue number</Label><Input value={issueForm.issue_number} onChange={(e)=>setIssueForm((prev)=>({...prev, issue_number: e.target.value}))} placeholder="1" /></div></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Publication year</Label><Input value={issueForm.publication_year} onChange={(e)=>setIssueForm((prev)=>({...prev, publication_year: e.target.value}))} placeholder="2026" /></div><div className="space-y-2"><Label>Publication date</Label><Input type="date" value={issueForm.publication_date} onChange={(e)=>setIssueForm((prev)=>({...prev, publication_date: e.target.value}))} /></div></div><div className="space-y-2"><Label>Status</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={issueForm.status} onChange={(e)=>setIssueForm((prev)=>({...prev, status: e.target.value}))}><option value="upcoming">Upcoming</option><option value="published">Published</option></select></div><Button type="submit" disabled={issueSaving}>{issueSaving ? "Saving..." : "Create issue"}</Button></form></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader className="flex flex-wrap items-center justify-between gap-3"><CardHeading icon={<BookMarked className="h-5 w-5" />} title="Issue Registry" description="The latest issue in this list will be used during publication." /><Input className="max-w-xs" placeholder="Search volume, issue, year" value={eicSearch} onChange={(e)=>setEicSearch(e.target.value)} /></CardHeader><CardContent><div className="space-y-3">{filterEic(issues).length ? filterEic(issues).map((issue)=>{ const issueId = Number(issue.issue_id); return <div key={String(issue.issue_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold text-slate-900">Volume {String(issue.volume ?? "")}, Issue {String(issue.issue_number ?? "")}</p><p className="text-sm text-slate-500">Year: {String(issue.publication_year ?? "")} | Date: {String(issue.publication_date ?? "")} | Status: {String(issue.status ?? "")}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>openIssueEditModal(issue)} disabled={issueEditingId === issueId || issueDeletingId === issueId}>Edit</Button><Button size="sm" variant="outline" onClick={async ()=>{ await deleteIssue(issueId) }} disabled={issueDeletingId === issueId || issueEditingId === issueId}>{issueDeletingId === issueId ? "Deleting..." : "Delete"}</Button></div></div></div>}) : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No issues have been created yet.</div>}</div></CardContent></Card></div>{issueEditModal ? <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-lg rounded-3xl border border-white/70 bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h3 className="display-modal text-slate-950">Edit Issue Status</h3><p className="mt-2 text-sm text-slate-600">{issueEditModal.label}</p></div><button type="button" onClick={closeIssueEditModal} className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50" disabled={issueEditingId !== null}>Close</button></div><form className="mt-6 space-y-4" onSubmit={editIssueStatus}><div className="space-y-2"><Label>Status</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={issueEditStatus} onChange={(e)=>setIssueEditStatus(e.target.value)}><option value="upcoming">Upcoming</option><option value="published">Published</option></select></div><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={closeIssueEditModal} disabled={issueEditingId !== null}>Cancel</Button><Button type="submit" disabled={issueEditingId !== null}>{issueEditingId !== null ? "Saving..." : "Save changes"}</Button></div></form></div></div> : null}</>
  if (section === "scheduling") {
    return (
      <>
        <div className="grid gap-6">
          <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <CardHeading
                icon={<BookMarked className="h-5 w-5" />}
                title="Publication Scheduling"
                description="Accepted manuscripts stay here until payment is complete and publication can proceed."
              />
              <Input className="max-w-xs" placeholder="Search ref #, ID, title" value={eicSearch} onChange={(e) => setEicSearch(e.target.value)} />
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredPublishReadyDecisions.length ? (
                filteredPublishReadyDecisions.map((entry) => {
                  const manuscriptId = Number(entry.manuscript_id)
                  const alreadyPublished = String(entry.status ?? "").toLowerCase() === "published"
                  const archived = Number(entry.archived ?? 0) === 1 || String(entry.archived ?? "") === "1"
                  const paymentCompleted = Number(entry.payment_completed ?? 0) === 1 || String(entry.payment_completed ?? "") === "1"
                  const paymentStatus = String(entry.payment_status ?? "").trim() || "awaiting_payment"

                  return (
                    <div key={String(entry.final_decision_id ?? entry.manuscript_id)} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{String(entry.title ?? entry.manuscript_id)}</p>
                          <p className="text-sm text-slate-500">
                            Ref: {String(entry.reference_number ?? entry.manuscript_id)} | Approved: {String(entry.approval_date ?? "")}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">{String(entry.remarks ?? "Ready for publication scheduling and release.")}</p>
                          <p className="mt-1 text-sm text-slate-500">Payment status: {paymentStatus.replaceAll("_", " ")}</p>
                          {alreadyPublished ? <p className="mt-1 text-sm font-medium text-emerald-700">{archived ? "published, archived" : "published"}</p> : null}
                          {!alreadyPublished && !paymentCompleted ? (
                            <p className="mt-1 text-sm font-medium text-amber-700">Awaiting author payment before publication.</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => openPublishModal(entry)}
                            disabled={alreadyPublished || archived || !paymentCompleted || publishingId === manuscriptId}
                          >
                            {alreadyPublished ? "Published" : publishingId === manuscriptId ? "Publishing..." : "Publish now"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => { await archivePublishedManuscript(manuscriptId) }}
                            disabled={!alreadyPublished || archived || archivingId === manuscriptId}
                          >
                            {archived ? "Archived" : archivingId === manuscriptId ? "Archiving..." : "Archive publication"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await sendPaymentReminderForManuscript(manuscriptId)
                            }}
                            disabled={alreadyPublished || paymentCompleted || sendingReminderId === manuscriptId}
                          >
                            {paymentCompleted ? "Payment complete" : sendingReminderId === manuscriptId ? "Sending..." : "Send payment reminder"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No accepted manuscripts are currently ready to publish.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
            <CardHeader>
              <CardHeading icon={<Workflow className="h-5 w-5" />} title="Decision Pipeline" />
            </CardHeader>
            <CardContent>
              <Table rows={filteredEditorDecisions} />
            </CardContent>
          </Card>
        </div>

        {publishModal ? (
          <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/50 p-4">
            <div className="w-full max-w-xl rounded-3xl border border-white/70 bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="display-modal text-slate-950">Publish Manuscript</h3>
                  <p className="mt-2 text-sm text-slate-600">{publishModal.title}</p>
                </div>
                <button
                  type="button"
                  onClick={closePublishModal}
                  className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  disabled={publishingId !== null}
                >
                  Close
                </button>
              </div>
              <form
                className="mt-6 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!publishForm.total_pages.trim()) {
                    toast.error("Total pages have not been generated yet.")
                    return
                  }
                  await publishSelectedManuscript(publishModal.manuscript_id, publishForm.total_pages.trim())
                }}
              >
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  {issues.length
                    ? `Publishing will use the latest issue on record: Vol. ${String(issues[0]?.volume ?? "")}, Issue ${String(issues[0]?.issue_number ?? "")} (${String(issues[0]?.publication_year ?? "")})`
                    : "No issue exists yet. Create one first from Manage Issues before publishing."}
                </div>
                <div className="space-y-2">
                  <Label>Total pages</Label>
                  <Input
                    value={publishForm.total_pages}
                    readOnly
                    aria-busy={isCalculatingPublishPages}
                    placeholder={isCalculatingPublishPages ? "Generating total pages..." : "Generated automatically"}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={closePublishModal} disabled={publishingId !== null}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={publishingId !== null || issues.length === 0 || isCalculatingPublishPages || !publishForm.total_pages}
                  >
                    {publishingId !== null ? "Publishing..." : "Publish manuscript"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </>
    )
  }
  if (section === "monitoring") return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Globe2 className="h-5 w-5" />} title="System Monitoring" description="Watch user distribution and manuscript flow from the Editor-in-Chief control center." /></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Users in workspace</p><p className="mt-2 text-3xl font-semibold text-slate-950">{users.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Accepted manuscripts</p><p className="mt-2 text-3xl font-semibold text-slate-950">{String(overview.accepted ?? 0)}</p></div><div className="min-w-0 md:col-span-2"><Table rows={filteredUsers} /></div></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader className="flex flex-wrap items-center justify-between gap-3"><CardHeading icon={<FileClock className="h-5 w-5" />} title="Recent Executive Decisions" /><Input className="max-w-xs" placeholder="Search ref #, ID, title" value={eicSearch} onChange={(e)=>setEicSearch(e.target.value)} /></CardHeader><CardContent><Table rows={filteredFinalDecisions} /></CardContent></Card></div>
  return <Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>{section.replaceAll("-"," ")}</CardTitle></CardHeader><CardContent><Table rows={filteredEditorDecisions} /></CardContent></Card>
}
function AdminUsersPanel({ workspace, onSaved }: { workspace: WorkspacePayload; onSaved: () => Promise<void> }) {
  const users = asArray(workspace.admin?.users)
  const [form, setForm] = React.useState({ user_id: "", role: "reviewer", status: "active", skip_onboarding: true })
  const [saving, setSaving] = React.useState(false)
  const [showCreateModal, setShowCreateModal] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [createForm, setCreateForm] = React.useState({ first_name: "", last_name: "", email: "", password: "", institution: "", country: "", phone: "", orcid_id: "", role: "author", status: "active", expertise_area: "", skip_onboarding: true })
  const [editingUser, setEditingUser] = React.useState<Record<string, unknown> | null>(null)
  const [editSaving, setEditSaving] = React.useState(false)
  const [editForm, setEditForm] = React.useState({ user_id: "", first_name: "", last_name: "", email: "", institution: "", country: "", phone: "", orcid_id: "", status: "active" })
  const { countryOptions, countriesLoading, countryLookupFailed } = useCountryOptions()
  const [createdCredentials, setCreatedCredentials] = React.useState<{ first_name: string; last_name: string; email: string; password: string; role: string } | null>(null)

  const generateRandomPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    let pass = ""
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return pass
  }

  const verifiedUsers = users.filter((entry) => String(entry.email_verification_status ?? "") === "verified").length
  const unverifiedUsers = users.length - verifiedUsers

  const openEdit = (entry: Record<string, unknown>) => {
    setEditingUser(entry)
    setEditForm({
      user_id: String(entry.user_id ?? ""),
      first_name: String(entry.first_name ?? ""),
      last_name: String(entry.last_name ?? ""),
      email: String(entry.email ?? ""),
      institution: String(entry.institution ?? ""),
      country: String(entry.country ?? ""),
      phone: String(entry.phone ?? ""),
      orcid_id: String(entry.orcid_id ?? ""),
      status: String(entry.status ?? "active"),
    })
  }

  const verificationBadge = (entry: Record<string, unknown>) => {
    const status = String(entry.email_verification_status ?? "unverified")
    const sentAt = String(entry.email_verification_sent_at ?? "")
    if (status === "verified") {
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Verified</Badge>
    }
    return (
      <div className="space-y-1">
        <Badge variant="outline" className="bg-amber-100 text-amber-700 hover:bg-amber-100">Unverified</Badge>
        {sentAt ? <p className="text-xs text-slate-500">Sent {sentAt}</p> : null}
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-6">
        <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
          <CardHeader>
            <CardHeading icon={<Users className="h-5 w-5" />} title="Verification overview" description="Monitor which registered users have completed email confirmation before they sign in to protected workspaces." />
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total users</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{users.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Verified</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-700">{verifiedUsers}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Unverified</p>
              <p className="mt-2 text-3xl font-semibold text-amber-700">{unverifiedUsers}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>User & Role Management</CardTitle>
                <CardDescription>Update access levels, activation status, create new user accounts, and review verification state.</CardDescription>
              </div>
              <Button type="button" onClick={() => setShowCreateModal(true)}>Add new user</Button>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault()
                setSaving(true)
                try {
                  await updateUserAccess({
                    user_id: Number(form.user_id),
                    role: form.role,
                    status: form.status,
                    skip_onboarding: form.skip_onboarding
                  })
                  await onSaved()
                  toast.success("User access updated.")
                } catch (error) {
                  toast.error(errorText(error, "Unable to update user access."))
                } finally {
                  setSaving(false)
                }
              }}
            >
              <div className="space-y-2">
                <Label>User</Label>
                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.user_id} onChange={(e) => setForm((p) => ({ ...p, user_id: e.target.value }))}>
                  <option value="">Select user</option>
                  {users.map((entry) => <option key={String(entry.user_id)} value={String(entry.user_id)}>{String(entry.first_name ?? "")} {String(entry.last_name ?? "")} ({String(entry.email ?? "")})</option>)}
                </select>
              </div>

              {form.user_id ? (() => {
                const selectedUser = users.find((u) => String(u.user_id) === form.user_id);
                if (!selectedUser) return null;
                const rolesArray = asArray(selectedUser.roles);
                return (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Allocated Roles (Click X to Remove)</Label>
                    <div className="flex flex-wrap gap-2">
                      {rolesArray.map((roleNameStr) => {
                        const roleName = String(roleNameStr);
                        return (
                          <span
                            key={roleName}
                            className="inline-flex items-center gap-1.5 rounded-full bg-jostum-50 px-3 py-1 text-xs font-semibold text-jostum-850 border border-jostum-150"
                          >
                            {roleName}
                            <button
                              type="button"
                              onClick={async () => {
                                if (rolesArray.length <= 1) {
                                  toast.error("Cannot remove the only remaining role. A user must have at least one role.");
                                  return;
                                }
                                if (!window.confirm(`Are you sure you want to remove the '${roleName}' role from this user?`)) {
                                  return;
                                }
                                setSaving(true);
                                try {
                                  await updateUserAccess({
                                    user_id: Number(form.user_id),
                                    role: roleName,
                                    action: "remove_role"
                                  });
                                  await onSaved();
                                  toast.success(`Role '${roleName}' removed successfully.`);
                                } catch (err) {
                                  toast.error(errorText(err, "Unable to remove role."));
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              className="ml-1 rounded-full p-0.5 hover:bg-jostum-100 text-jostum-600 hover:text-jostum-850 focus:outline-none"
                              title={`Remove ${roleName} role`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })() : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Assign role</Label>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
                    {userRoleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {["reviewer", "editor", "managing_editor", "section_editor", "technical_editor", "advisory_board", "editor_in_chief"].includes(form.role) ? (
                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.skip_onboarding}
                    onChange={(e) => setForm((p) => ({ ...p, skip_onboarding: e.target.checked }))}
                  />
                  <span>
                    <span className="font-semibold text-slate-900">Pre-approve/Skip Onboarding for this role</span>
                    <br />
                    Bypasses CV submission and onboarding qualifications so the user can immediately perform duties.
                  </span>
                </label>
              ) : null}

              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Update user role"}</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
          <CardHeader>
            <CardTitle>Current users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="min-w-0 max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[58rem] table-fixed text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="max-w-[10rem] break-words px-4 py-3 text-left font-semibold uppercase tracking-[0.08em] text-slate-600">Name</th>
                    <th className="max-w-[14rem] break-words px-4 py-3 text-left font-semibold uppercase tracking-[0.08em] text-slate-600">Email</th>
                    <th className="max-w-[12rem] break-words px-4 py-3 text-left font-semibold uppercase tracking-[0.08em] text-slate-600">Roles</th>
                    <th className="max-w-[8rem] break-words px-4 py-3 text-left font-semibold uppercase tracking-[0.08em] text-slate-600">Status</th>
                    <th className="max-w-[10rem] break-words px-4 py-3 text-left font-semibold uppercase tracking-[0.08em] text-slate-600">Verification</th>
                    <th className="w-[10rem] px-4 py-3 text-left font-semibold uppercase tracking-[0.08em] text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((entry) => (
                    <tr key={String(entry.user_id)} className="border-t border-slate-200 align-top">
                      <td className="max-w-[10rem] break-words px-4 py-3 text-slate-700">{String(entry.first_name ?? "")} {String(entry.last_name ?? "")}</td>
                      <td className="max-w-[14rem] break-words px-4 py-3 text-slate-700">{String(entry.email ?? "")}</td>
                      <td className="max-w-[12rem] break-words px-4 py-3 text-slate-700">{Array.isArray(entry.roles) ? entry.roles.join(", ") : String(entry.roles ?? "")}</td>
                      <td className="max-w-[8rem] break-words px-4 py-3 text-slate-700">{String(entry.status ?? "")}</td>
                      <td className="max-w-[10rem] break-words px-4 py-3 text-slate-700">{verificationBadge(entry)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          {String(entry.email_verification_status ?? "") !== "verified" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  await resendVerificationEmail({ email: String(entry.email ?? "") })
                                  await onSaved()
                                  toast.success("Verification email resent.")
                                } catch (error) {
                                  toast.error(errorText(error, "Unable to resend verification email."))
                                }
                              }}
                            >
                              Resend
                            </Button>
                          ) : null}
                          <Button type="button" size="sm" variant="outline" onClick={() => openEdit(entry)}>Edit</Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            className="h-8 w-8 rounded-full"
                            title="Delete user"
                            onClick={async () => {
                              if (!window.confirm(`Delete ${String(entry.first_name ?? "")} ${String(entry.last_name ?? "")}?`)) return
                              try {
                                await deleteAdminUser(Number(entry.user_id))
                                await onSaved()
                                toast.success("User deleted.")
                              } catch (error) {
                                toast.error(errorText(error, "Unable to delete user."))
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {showCreateModal ? (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/70 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="display-modal text-slate-950">Create New User</h3>
                <p className="mt-2 text-sm text-slate-600">Add any publishing account, from author and reviewer through the editorial chain to administrator, from one modal form.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreatedCredentials(null);
                  setShowCreateModal(false);
                }}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {createdCredentials ? (
              <div className="mt-6 space-y-5">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 text-emerald-800">
                  <h4 className="font-semibold text-emerald-900 flex items-center gap-2">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    User Account Created Successfully!
                  </h4>
                  <p className="mt-1 text-sm">
                    A confirmation email has been dispatched to <strong>{createdCredentials.email}</strong>.
                    You can copy the account details below to share directly with the user.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Copyable credentials</Label>
                  <div className="relative rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm whitespace-pre-wrap select-all">
                    {`Dear ${createdCredentials.first_name} ${createdCredentials.last_name},\n\nYour JASTI account has been successfully created.\n\nLogin URL: ${window.location.origin}/login\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nRole: ${createdCredentials.role}\n\nBest regards,\nJASTI Editorial Office`}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const text = `Dear ${createdCredentials.first_name} ${createdCredentials.last_name},\n\nYour JASTI account has been successfully created.\n\nLogin URL: ${window.location.origin}/login\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nRole: ${createdCredentials.role}\n\nBest regards,\nJASTI Editorial Office`;
                      navigator.clipboard.writeText(text);
                      toast.success("Credentials copied to clipboard!");
                    }}
                  >
                    Copy Credentials
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setCreatedCredentials(null);
                      setShowCreateModal(false);
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form
                className="mt-6 grid gap-4 md:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setCreating(true);
                  try {
                    await createAdminUser(createForm);
                    toast.success("User created successfully.");
                    setCreatedCredentials({
                      first_name: createForm.first_name,
                      last_name: createForm.last_name,
                      email: createForm.email,
                      password: createForm.password,
                      role: createForm.role,
                    });
                    setCreateForm({
                      first_name: "",
                      last_name: "",
                      email: "",
                      password: "",
                      institution: "",
                      country: "",
                      phone: "",
                      orcid_id: "",
                      role: "author",
                      status: "active",
                      expertise_area: "",
                      skip_onboarding: true,
                    });
                    await onSaved();
                  } catch (error) {
                    toast.error(errorText(error, "Unable to create user."));
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                <div className="space-y-2">
                  <Label>First name</Label>
                  <Input value={createForm.first_name} onChange={(e) => setCreateForm((p) => ({ ...p, first_name: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Last name</Label>
                  <Input value={createForm.last_name} onChange={(e) => setCreateForm((p) => ({ ...p, last_name: e.target.value }))} required />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Email</Label>
                  <Input type="email" value={createForm.email} onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Password</Label>
                    <button
                      type="button"
                      onClick={() => setCreateForm((p) => ({ ...p, password: generateRandomPassword() }))}
                      className="text-xs font-semibold text-jostum-600 hover:underline"
                    >
                      Generate Password
                    </button>
                  </div>
                  <Input
                    type="text"
                    minLength={8}
                    value={createForm.password}
                    onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                    required
                    placeholder="Min 8 characters or click generate"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    value={createForm.role}
                    onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value }))}
                  >
                    {userRoleOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    value={createForm.status}
                    onChange={(e) => setCreateForm((p) => ({ ...p, status: e.target.value }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="space-y-2 select-none">
                  <Label>Onboarding status</Label>
                  <label className="flex h-10 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm cursor-pointer hover:bg-slate-50 transition">
                    <input
                      type="checkbox"
                      checked={createForm.skip_onboarding}
                      onChange={(e) => setCreateForm((p) => ({ ...p, skip_onboarding: e.target.checked }))}
                      className="rounded border-slate-300 text-jostum-600 focus:ring-jostum-500 h-4 w-4"
                    />
                    <span className="text-slate-700">Pre-approve/Skip Onboarding</span>
                  </label>
                </div>
                <div className="space-y-2">
                  <Label>Institution</Label>
                  <Input value={createForm.institution} onChange={(e) => setCreateForm((p) => ({ ...p, institution: e.target.value }))} />
                </div>
                <CountrySelectField
                  label="Country"
                  value={createForm.country}
                  onChange={(value) => setCreateForm((p) => ({ ...p, country: value }))}
                  countryOptions={countryOptions}
                  countriesLoading={countriesLoading}
                  countryLookupFailed={countryLookupFailed}
                />
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={createForm.phone} onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>ORCID</Label>
                  <Input value={createForm.orcid_id} onChange={(e) => setCreateForm((p) => ({ ...p, orcid_id: e.target.value }))} />
                </div>
                {createForm.role === "reviewer" ? (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Expertise area</Label>
                    <Textarea rows={4} value={createForm.expertise_area} onChange={(e) => setCreateForm((p) => ({ ...p, expertise_area: e.target.value }))} />
                  </div>
                ) : null}
                <div className="md:col-span-2 flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCreatedCredentials(null);
                      setShowCreateModal(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating}>{creating ? "Creating..." : "Create user"}</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {editingUser ? (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/70 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="display-modal text-slate-950">Edit User</h3>
                <p className="mt-2 text-sm text-slate-600">Update basic user information directly from current users.</p>
              </div>
              <button type="button" onClick={() => setEditingUser(null)} className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50">Close</button>
            </div>
            <form
              className="mt-6 grid gap-4 md:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setEditSaving(true);
                try {
                  await editAdminUser({ ...editForm, user_id: Number(editForm.user_id) });
                  await onSaved();
                  toast.success("User updated.");
                  setEditingUser(null);
                } catch (error) {
                  toast.error(errorText(error, "Unable to edit user."));
                } finally {
                  setEditSaving(false);
                }
              }}
            >
              <div className="space-y-2">
                <Label>First name</Label>
                <Input value={editForm.first_name} onChange={(e) => setEditForm((p) => ({ ...p, first_name: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Last name</Label>
                <Input value={editForm.last_name} onChange={(e) => setEditForm((p) => ({ ...p, last_name: e.target.value }))} required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Email</Label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Institution</Label>
                <Input value={editForm.institution} onChange={(e) => setEditForm((p) => ({ ...p, institution: e.target.value }))} />
              </div>
              <CountrySelectField
                label="Country"
                value={editForm.country}
                onChange={(value) => setEditForm((p) => ({ ...p, country: value }))}
                countryOptions={countryOptions}
                countriesLoading={countriesLoading}
                countryLookupFailed={countryLookupFailed}
              />
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>ORCID</Label>
                <Input value={editForm.orcid_id} onChange={(e) => setEditForm((p) => ({ ...p, orcid_id: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={editForm.status}
                  onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="md:col-span-2 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
                <Button type="submit" disabled={editSaving}>{editSaving ? "Saving..." : "Save user"}</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
function SettingsPanel({ settings, onRefresh }: { settings: JournalSettings; onRefresh: () => Promise<void> }) {
  const serializeCalls = React.useCallback((entries: JournalSettings["call_for_papers"]) => entries.map((entry) => [entry.title, entry.deadline, entry.summary].join(" | ")).join("\n"), [])
  const serializeTrending = React.useCallback((entries: JournalSettings["trending_research"]) => entries.map((entry) => [entry.title, entry.area, entry.summary].join(" | ")).join("\n"), [])
  const lines = (items: string[]) => items.join("\n")
  const parseLines = (raw: string) => raw.split("\n").map((line) => line.trim()).filter(Boolean)
  const parseCalls = (raw: string) => raw.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [title = "", deadline = "", ...rest] = line.split("|").map((value) => value.trim()); return { title, deadline, summary: rest.join(" | ") } }).filter((entry) => entry.title)
  const parseTrending = (raw: string) => raw.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [title = "", area = "", ...rest] = line.split("|").map((value) => value.trim()); return { title, area, summary: rest.join(" | ") } }).filter((entry) => entry.title)
  const buildForm = React.useCallback(() => ({
    journal_name: settings.journal_name,
    journal_acronym: settings.journal_acronym,
    homepage_tagline: settings.homepage_tagline,
    homepage_intro: settings.homepage_intro,
    home_topbar_text: settings.home_topbar_text,
    featured_articles_title: settings.featured_articles_title,
    featured_articles_description: settings.featured_articles_description,
    research_pathways_title: settings.research_pathways_title,
    call_for_papers_title: settings.call_for_papers_title,
    call_for_papers_description: settings.call_for_papers_description,
    call_for_papers_cta_title: settings.call_for_papers_cta_title,
    call_for_papers_cta_body: settings.call_for_papers_cta_body,
    callForPapersNotesText: lines(settings.call_for_papers_notes),
    trending_research_title: settings.trending_research_title,
    trending_research_description: settings.trending_research_description,
    publishing_overview_title: settings.publishing_overview_title,
    publishing_overview_description: settings.publishing_overview_description,
    workflow_snapshot_title: settings.workflow_snapshot_title,
    workflow_snapshot_description: settings.workflow_snapshot_description,
    discover_open_access_title: settings.discover_open_access_title,
    discover_open_access_body: settings.discover_open_access_body,
    discoverOpenAccessPointsText: lines(settings.discover_open_access_points),
    publish_with_us_title: settings.publish_with_us_title,
    publish_with_us_body: settings.publish_with_us_body,
    publishWithUsPointsText: lines(settings.publish_with_us_points),
    track_research_title: settings.track_research_title,
    track_research_body: settings.track_research_body,
    callForPapersText: serializeCalls(settings.call_for_papers),
    trendingResearchText: serializeTrending(settings.trending_research),
    aimsText: lines(settings.aims),
    scopeText: lines(settings.scope),
    objectivesText: lines(settings.objectives),
    reviewSpecializationsText: lines(settings.review_specializations),
    footer_summary: settings.footer_summary,
    footer_bottom_text: settings.footer_bottom_text,
    footer_bottom_tagline: settings.footer_bottom_tagline,
    whatsapp_number: settings.whatsapp_number,
    default_gq_percent: settings.default_gq_percent,
    default_ai_score_percent: settings.default_ai_score_percent,
    default_similarity_percent: settings.default_similarity_percent,
    submission_fee_ngn: settings.submission_fee_ngn,
    publication_fee_ngn: settings.publication_fee_ngn,
  }), [settings, serializeCalls, serializeTrending])
  const [form, setForm] = React.useState(buildForm)
  const [saving, setSaving] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [settingsUploadProgress, setSettingsUploadProgress] = React.useState(0)
  const [logoFile, setLogoFile] = React.useState<File | null>(null)
  const [logoError, setLogoError] = React.useState("")
  const [logoUploadProgress, setLogoUploadProgress] = React.useState(0)
  const [mediaFiles, setMediaFiles] = React.useState<{ discover: File | null; publish: File | null; track: File | null }>({ discover: null, publish: null, track: null })
  const [mediaErrors, setMediaErrors] = React.useState<{ discover: string; publish: string; track: string }>({ discover: "", publish: "", track: "" })

  React.useEffect(() => {
    setForm(buildForm())
    setMediaFiles({ discover: null, publish: null, track: null })
    setMediaErrors({ discover: "", publish: "", track: "" })
  }, [buildForm])

  const assignMedia = (key: "discover" | "publish" | "track", file: File | null) => {
    if (!file) {
      setMediaFiles((prev) => ({ ...prev, [key]: null }))
      setMediaErrors((prev) => ({ ...prev, [key]: "" }))
      return
    }
    const error = validateUploadFile(file, ["image/png", "image/jpeg", "image/webp"], "Section image", 5 * 1024 * 1024)
    if (error) {
      setMediaFiles((prev) => ({ ...prev, [key]: null }))
      setMediaErrors((prev) => ({ ...prev, [key]: error }))
      return
    }
    setMediaFiles((prev) => ({ ...prev, [key]: file }))
    setMediaErrors((prev) => ({ ...prev, [key]: "" }))
  }

  return <Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Settings2 className="h-5 w-5" />} title="System Settings" description="Admin can manage journal branding, public page content, and public media from one settings workspace." /></CardHeader><CardContent className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><div className="space-y-6 rounded-3xl border border-slate-200 bg-slate-50 p-5"><div className="space-y-4"><div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">{logoFile ? <img src={URL.createObjectURL(logoFile)} alt={settings.journal_name} className="h-full w-full object-cover" /> : settings.logo_path ? <img src={resolveApiAssetUrl(settings.logo_path)} alt={settings.journal_name} className="h-full w-full object-cover" /> : <span className="display-acronym text-3xl text-jostum-700">{settings.journal_acronym}</span>}</div><div><p className="font-semibold text-slate-900">{settings.journal_name}</p><p className="text-sm text-slate-500">{settings.journal_acronym}</p></div><FileDropzone label="Journal logo" accept="image/png,image/jpeg,image/webp" helperText="Accepted: PNG, JPG, WEBP. Maximum 5MB." file={logoFile} error={logoError} progress={logoUploadProgress} progressLabel="Uploading journal logo" onFileSelect={(file)=>{ if (!file) { setLogoFile(null); setLogoError(""); return } const error = validateUploadFile(file, ["image/png", "image/jpeg", "image/webp"], "Journal logo", 5 * 1024 * 1024); if (error) { setLogoFile(null); setLogoError(error); return } setLogoFile(file); setLogoError("") }} onRemove={()=>{ setLogoFile(null); setLogoError(""); setLogoUploadProgress(0) }} /><Button type="button" disabled={uploading || !logoFile} onClick={async ()=>{ if (!logoFile) return; setUploading(true); setLogoUploadProgress(0); try { await uploadJournalLogo(logoFile, { onProgress: setLogoUploadProgress }); await onRefresh(); setLogoFile(null); setLogoError(""); toast.success("Journal logo updated.") } catch (error) { toast.error(errorText(error, "Unable to upload logo.")) } finally { setUploading(false); setTimeout(() => setLogoUploadProgress(0), 500) } }}>{uploading ? "Uploading..." : "Update logo"}</Button></div><div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm font-semibold text-slate-900">Public page media uploads</p><p className="text-xs leading-6 text-slate-500">Homepage and public feature images are upload-only. URL textboxes have been removed.</p><div className="space-y-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Discover Open Access</p><div className="h-28 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">{mediaFiles.discover ? <img src={URL.createObjectURL(mediaFiles.discover)} alt="Discover Open Access" className="h-full w-full object-cover" /> : settings.discover_open_access_image ? <img src={resolveApiAssetUrl(settings.discover_open_access_image)} alt="Discover Open Access" className="h-full w-full object-cover" /> : null}</div><FileDropzone label="Discover Open Access image" accept="image/png,image/jpeg,image/webp" helperText="Accepted: PNG, JPG, WEBP. Maximum 5MB." file={mediaFiles.discover} error={mediaErrors.discover} onFileSelect={(file)=>assignMedia("discover", file)} onRemove={()=>assignMedia("discover", null)} /></div><div className="space-y-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Publish with Us</p><div className="h-28 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">{mediaFiles.publish ? <img src={URL.createObjectURL(mediaFiles.publish)} alt="Publish with Us" className="h-full w-full object-cover" /> : settings.publish_with_us_image ? <img src={resolveApiAssetUrl(settings.publish_with_us_image)} alt="Publish with Us" className="h-full w-full object-cover" /> : null}</div><FileDropzone label="Publish with Us image" accept="image/png,image/jpeg,image/webp" helperText="Accepted: PNG, JPG, WEBP. Maximum 5MB." file={mediaFiles.publish} error={mediaErrors.publish} onFileSelect={(file)=>assignMedia("publish", file)} onRemove={()=>assignMedia("publish", null)} /></div><div className="space-y-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Track Your Research</p><div className="h-28 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">{mediaFiles.track ? <img src={URL.createObjectURL(mediaFiles.track)} alt="Track Your Research" className="h-full w-full object-cover" /> : settings.track_research_image ? <img src={resolveApiAssetUrl(settings.track_research_image)} alt="Track Your Research" className="h-full w-full object-cover" /> : null}</div><FileDropzone label="Track Your Research image" accept="image/png,image/jpeg,image/webp" helperText="Accepted: PNG, JPG, WEBP. Maximum 5MB." file={mediaFiles.track} error={mediaErrors.track} onFileSelect={(file)=>assignMedia("track", file)} onRemove={()=>assignMedia("track", null)} /></div></div></div><form className="space-y-5" onSubmit={async (e)=>{ e.preventDefault(); setSaving(true); setSettingsUploadProgress(0); try { const payload = new FormData(); payload.append("journal_name", form.journal_name); payload.append("journal_acronym", form.journal_acronym); payload.append("homepage_tagline", form.homepage_tagline); payload.append("homepage_intro", form.homepage_intro); payload.append("home_topbar_text", form.home_topbar_text); payload.append("featured_articles_title", form.featured_articles_title); payload.append("featured_articles_description", form.featured_articles_description); payload.append("research_pathways_title", form.research_pathways_title); payload.append("call_for_papers_title", form.call_for_papers_title); payload.append("call_for_papers_description", form.call_for_papers_description); payload.append("call_for_papers_cta_title", form.call_for_papers_cta_title); payload.append("call_for_papers_cta_body", form.call_for_papers_cta_body); payload.append("call_for_papers_notes", JSON.stringify(parseLines(form.callForPapersNotesText))); payload.append("trending_research_title", form.trending_research_title); payload.append("trending_research_description", form.trending_research_description); payload.append("publishing_overview_title", form.publishing_overview_title); payload.append("publishing_overview_description", form.publishing_overview_description); payload.append("workflow_snapshot_title", form.workflow_snapshot_title); payload.append("workflow_snapshot_description", form.workflow_snapshot_description); payload.append("discover_open_access_title", form.discover_open_access_title); payload.append("discover_open_access_body", form.discover_open_access_body); payload.append("discover_open_access_points", JSON.stringify(parseLines(form.discoverOpenAccessPointsText))); payload.append("publish_with_us_title", form.publish_with_us_title); payload.append("publish_with_us_body", form.publish_with_us_body); payload.append("publish_with_us_points", JSON.stringify(parseLines(form.publishWithUsPointsText))); payload.append("track_research_title", form.track_research_title); payload.append("track_research_body", form.track_research_body); payload.append("call_for_papers", JSON.stringify(parseCalls(form.callForPapersText))); payload.append("trending_research", JSON.stringify(parseTrending(form.trendingResearchText))); payload.append("aims", JSON.stringify(parseLines(form.aimsText))); payload.append("scope", JSON.stringify(parseLines(form.scopeText))); payload.append("objectives", JSON.stringify(parseLines(form.objectivesText))); payload.append("review_specializations", JSON.stringify(parseLines(form.reviewSpecializationsText))); payload.append("footer_summary", form.footer_summary); payload.append("footer_bottom_text", form.footer_bottom_text); payload.append("footer_bottom_tagline", form.footer_bottom_tagline); payload.append("whatsapp_number", form.whatsapp_number); payload.append("default_gq_percent", form.default_gq_percent); payload.append("default_ai_score_percent", form.default_ai_score_percent); payload.append("default_similarity_percent", form.default_similarity_percent); payload.append("submission_fee_ngn", form.submission_fee_ngn); payload.append("publication_fee_ngn", form.publication_fee_ngn); if (mediaFiles.discover) payload.append("discover_open_access_image", mediaFiles.discover); if (mediaFiles.publish) payload.append("publish_with_us_image", mediaFiles.publish); if (mediaFiles.track) payload.append("track_research_image", mediaFiles.track); await updateAdminSettings(payload, { onProgress: setSettingsUploadProgress }); await onRefresh(); setMediaFiles({ discover: null, publish: null, track: null }); setMediaErrors({ discover: "", publish: "", track: "" }); toast.success("System settings updated.") } catch (error) { toast.error(errorText(error, "Unable to update settings.")) } finally { setSaving(false); setTimeout(() => setSettingsUploadProgress(0), 500) } }}><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Journal name</Label><Input value={form.journal_name} onChange={(e)=>setForm((p)=>({...p, journal_name: e.target.value}))} /></div><div className="space-y-2"><Label>Journal acronym</Label><Input value={form.journal_acronym} onChange={(e)=>setForm((p)=>({...p, journal_acronym: e.target.value}))} /></div></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-900">Workflow fees and score defaults</p><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5"><div className="space-y-2"><Label>Submission fee (NGN)</Label><Input type="number" min="0" value={form.submission_fee_ngn} onChange={(e)=>setForm((p)=>({...p, submission_fee_ngn: e.target.value}))} /></div><div className="space-y-2"><Label>Publication fee (NGN)</Label><Input type="number" min="0" value={form.publication_fee_ngn} onChange={(e)=>setForm((p)=>({...p, publication_fee_ngn: e.target.value}))} /></div><div className="space-y-2"><Label>Default GQ %</Label><Input type="number" min="0" max="100" value={form.default_gq_percent} onChange={(e)=>setForm((p)=>({...p, default_gq_percent: e.target.value}))} /></div><div className="space-y-2"><Label>Default AI Score %</Label><Input type="number" min="0" max="100" value={form.default_ai_score_percent} onChange={(e)=>setForm((p)=>({...p, default_ai_score_percent: e.target.value}))} /></div><div className="space-y-2"><Label>Default Similarity %</Label><Input type="number" min="0" max="100" value={form.default_similarity_percent} onChange={(e)=>setForm((p)=>({...p, default_similarity_percent: e.target.value}))} /></div></div></div><div className="space-y-2"><Label>Top bar text</Label><Input value={form.home_topbar_text} onChange={(e)=>setForm((p)=>({...p, home_topbar_text: e.target.value}))} /></div><div className="space-y-2"><Label>Homepage WhatsApp number</Label><Input value={form.whatsapp_number} onChange={(e)=>setForm((p)=>({...p, whatsapp_number: e.target.value}))} placeholder="+2348012345678" /><p className="text-xs text-slate-500">Shown as a WhatsApp contact button on the homepage.</p></div><div className="space-y-2"><Label>Homepage tagline</Label><Textarea rows={3} value={form.homepage_tagline} onChange={(e)=>setForm((p)=>({...p, homepage_tagline: e.target.value}))} /></div><div className="space-y-2"><Label>Homepage introduction</Label><Textarea rows={4} value={form.homepage_intro} onChange={(e)=>setForm((p)=>({...p, homepage_intro: e.target.value}))} /></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Featured Articles title</Label><Input value={form.featured_articles_title} onChange={(e)=>setForm((p)=>({...p, featured_articles_title: e.target.value}))} /></div><div className="space-y-2"><Label>Featured Articles description</Label><Input value={form.featured_articles_description} onChange={(e)=>setForm((p)=>({...p, featured_articles_description: e.target.value}))} /></div></div><div className="space-y-2"><Label>Research pathways title</Label><Input value={form.research_pathways_title} onChange={(e)=>setForm((p)=>({...p, research_pathways_title: e.target.value}))} /></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Call for Papers section title</Label><Input value={form.call_for_papers_title} onChange={(e)=>setForm((p)=>({...p, call_for_papers_title: e.target.value}))} /></div><div className="space-y-2"><Label>Trending Research section title</Label><Input value={form.trending_research_title} onChange={(e)=>setForm((p)=>({...p, trending_research_title: e.target.value}))} /></div></div><div className="space-y-2"><Label>Call for Papers section description</Label><Textarea rows={3} value={form.call_for_papers_description} onChange={(e)=>setForm((p)=>({...p, call_for_papers_description: e.target.value}))} /></div><div className="space-y-2"><Label>Trending Research section description</Label><Textarea rows={3} value={form.trending_research_description} onChange={(e)=>setForm((p)=>({...p, trending_research_description: e.target.value}))} /></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Publishing overview title</Label><Input value={form.publishing_overview_title} onChange={(e)=>setForm((p)=>({...p, publishing_overview_title: e.target.value}))} /></div><div className="space-y-2"><Label>Workflow snapshot title</Label><Input value={form.workflow_snapshot_title} onChange={(e)=>setForm((p)=>({...p, workflow_snapshot_title: e.target.value}))} /></div></div><div className="space-y-2"><Label>Publishing overview description</Label><Textarea rows={3} value={form.publishing_overview_description} onChange={(e)=>setForm((p)=>({...p, publishing_overview_description: e.target.value}))} /></div><div className="space-y-2"><Label>Workflow snapshot description</Label><Textarea rows={3} value={form.workflow_snapshot_description} onChange={(e)=>setForm((p)=>({...p, workflow_snapshot_description: e.target.value}))} /></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Discover Open Access title</Label><Input value={form.discover_open_access_title} onChange={(e)=>setForm((p)=>({...p, discover_open_access_title: e.target.value}))} /></div><div className="space-y-2"><Label>Publish with Us title</Label><Input value={form.publish_with_us_title} onChange={(e)=>setForm((p)=>({...p, publish_with_us_title: e.target.value}))} /></div></div><div className="space-y-2"><Label>Discover Open Access body</Label><Textarea rows={4} value={form.discover_open_access_body} onChange={(e)=>setForm((p)=>({...p, discover_open_access_body: e.target.value}))} /></div><div className="space-y-2"><Label>Discover Open Access detail points</Label><Textarea rows={4} value={form.discoverOpenAccessPointsText} onChange={(e)=>setForm((p)=>({...p, discoverOpenAccessPointsText: e.target.value}))} /><p className="text-xs text-slate-500">One point per line.</p></div><div className="space-y-2"><Label>Publish with Us body</Label><Textarea rows={4} value={form.publish_with_us_body} onChange={(e)=>setForm((p)=>({...p, publish_with_us_body: e.target.value}))} /></div><div className="space-y-2"><Label>Publish with Us detail points</Label><Textarea rows={4} value={form.publishWithUsPointsText} onChange={(e)=>setForm((p)=>({...p, publishWithUsPointsText: e.target.value}))} /><p className="text-xs text-slate-500">One point per line.</p></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Track Your Research title</Label><Input value={form.track_research_title} onChange={(e)=>setForm((p)=>({...p, track_research_title: e.target.value}))} /></div><div className="space-y-2"><Label>Track Your Research body</Label><Textarea rows={3} value={form.track_research_body} onChange={(e)=>setForm((p)=>({...p, track_research_body: e.target.value}))} /></div></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Call for Papers CTA title</Label><Input value={form.call_for_papers_cta_title} onChange={(e)=>setForm((p)=>({...p, call_for_papers_cta_title: e.target.value}))} /></div><div className="space-y-2"><Label>Call for Papers CTA body</Label><Textarea rows={3} value={form.call_for_papers_cta_body} onChange={(e)=>setForm((p)=>({...p, call_for_papers_cta_body: e.target.value}))} /></div></div><div className="space-y-2"><Label>Call for Papers notes</Label><Textarea rows={4} value={form.callForPapersNotesText} onChange={(e)=>setForm((p)=>({...p, callForPapersNotesText: e.target.value}))} /><p className="text-xs text-slate-500">One note per line.</p></div><div className="space-y-2"><Label>Reviewer specialization areas</Label><Textarea rows={6} value={form.reviewSpecializationsText} onChange={(e)=>setForm((p)=>({...p, reviewSpecializationsText: e.target.value}))} /><p className="text-xs text-slate-500">One specialization area per line. Reviewers will be able to select more than one area during onboarding.</p></div><div className="space-y-2"><Label>Call for Papers entries</Label><Textarea rows={6} value={form.callForPapersText} onChange={(e)=>setForm((p)=>({...p, callForPapersText: e.target.value}))} /><p className="text-xs text-slate-500">Format each line as: Title | YYYY-MM-DD | Summary</p></div><div className="space-y-2"><Label>Trending Research entries</Label><Textarea rows={6} value={form.trendingResearchText} onChange={(e)=>setForm((p)=>({...p, trendingResearchText: e.target.value}))} /><p className="text-xs text-slate-500">Format each line as: Title | Area | Summary</p></div><div className="space-y-2"><Label>Aims</Label><Textarea rows={5} value={form.aimsText} onChange={(e)=>setForm((p)=>({...p, aimsText: e.target.value}))} /></div><div className="space-y-2"><Label>Scope</Label><Textarea rows={6} value={form.scopeText} onChange={(e)=>setForm((p)=>({...p, scopeText: e.target.value}))} /></div><div className="space-y-2"><Label>Objectives</Label><Textarea rows={5} value={form.objectivesText} onChange={(e)=>setForm((p)=>({...p, objectivesText: e.target.value}))} /></div><div className="space-y-2"><Label>Footer summary</Label><Textarea rows={3} value={form.footer_summary} onChange={(e)=>setForm((p)=>({...p, footer_summary: e.target.value}))} /></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Footer bottom text</Label><Input value={form.footer_bottom_text} onChange={(e)=>setForm((p)=>({...p, footer_bottom_text: e.target.value}))} /></div><div className="space-y-2"><Label>Footer bottom tagline</Label><Input value={form.footer_bottom_tagline} onChange={(e)=>setForm((p)=>({...p, footer_bottom_tagline: e.target.value}))} /></div></div>{settingsUploadProgress > 0 ? <div className="space-y-2"><div className="flex items-center justify-between text-xs text-slate-500"><span>Uploading settings media</span><span>{settingsUploadProgress}%</span></div><div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-jostum-700 transition-all" style={{ width: `${Math.min(settingsUploadProgress, 100)}%` }} /></div></div> : null}<Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save settings"}</Button></form></CardContent></Card>
}
function AdminManageAllArticlesPanel({
  workspace,
  onSaved,
  filterType = "all",
}: {
  workspace: WorkspacePayload
  onSaved: () => Promise<void>
  filterType?: "all" | "unpaid_submitted"
}) {
  const rawManuscripts = asArray(workspace.editor_in_chief?.manuscripts || workspace.admin?.manuscripts)
  const manuscripts = React.useMemo(() => {
    if (filterType === "unpaid_submitted") {
      return rawManuscripts.filter((entry) => {
        const isSubmitted = String(entry.status ?? "").toLowerCase() === "submitted"
        const isPaid = Number(entry.submission_payment_confirmed ?? 0) === 1 || String(entry.submission_payment_confirmed ?? "") === "1" || Boolean(entry.submission_payment_confirmed)
        return isSubmitted && !isPaid
      })
    }
    return rawManuscripts
  }, [rawManuscripts, filterType])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [deletingManuscript, setDeletingManuscript] = React.useState<Record<string, unknown> | null>(null)
  const [editingManuscript, setEditingManuscript] = React.useState<Record<string, unknown> | null>(null)
  const [archivingId, setArchivingId] = React.useState<number | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const [editForm, setEditForm] = React.useState({
    title: "",
    reference_number: "",
    publication_date: "",
  })

  const openEdit = (entry: Record<string, unknown>) => {
    setEditingManuscript(entry)
    setEditForm({
      title: String(entry.title ?? ""),
      reference_number: String(entry.reference_number ?? ""),
      publication_date: String(entry.publication_date ?? "").slice(0, 10),
    })
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingManuscript) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        title: editForm.title,
        reference_number: editForm.reference_number,
        publication_date: editForm.publication_date,
      }
      if (editingManuscript.article_id) {
        payload.article_id = Number(editingManuscript.article_id)
      } else {
        payload.manuscript_id = Number(editingManuscript.manuscript_id)
      }
      await updatePublication(payload as any)
      await onSaved()
      toast.success("Manuscript updated successfully.")
      setEditingManuscript(null)
    } catch (error) {
      toast.error(errorText(error, "Unable to update manuscript."))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingManuscript) return
    setDeleting(true)
    try {
      const payload: Record<string, unknown> = {}
      if (deletingManuscript.article_id) {
        payload.article_id = Number(deletingManuscript.article_id)
      } else {
        payload.manuscript_id = Number(deletingManuscript.manuscript_id)
      }
      await deletePublication(payload)
      await onSaved()
      toast.success("Manuscript deleted successfully.")
      setDeletingManuscript(null)
    } catch (error) {
      toast.error(errorText(error, "Unable to delete manuscript."))
    } finally {
      setDeleting(false)
    }
  }

  const handleArchive = async (entry: Record<string, unknown>) => {
    const manuscriptId = Number(entry.manuscript_id)
    setArchivingId(manuscriptId)
    try {
      await archivePublication({ manuscript_id: manuscriptId })
      await onSaved()
      toast.success("Publication archived successfully.")
    } catch (error) {
      toast.error(errorText(error, "Unable to archive publication."))
    } finally {
      setArchivingId(null)
    }
  }

  const normalize = (value: unknown) => String(value ?? "").toLowerCase()
  
  const filteredManuscripts = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return manuscripts
    return manuscripts.filter((entry) => {
      return (
        normalize(entry.reference_number).includes(q) ||
        normalize(entry.manuscript_id).includes(q) ||
        normalize(entry.title).includes(q) ||
        normalize(entry.author_name).includes(q) ||
        normalize(entry.author_email).includes(q) ||
        normalize(entry.status).includes(q)
      )
    })
  }, [manuscripts, searchQuery])

  return (
    <>
      <div className="grid gap-6">
        <Card className="border-white/70 bg-white/85 backdrop-blur">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{filterType === "unpaid_submitted" ? "View Submitted Article" : "Manage All Articles"}</CardTitle>
              <CardDescription>
                {filterType === "unpaid_submitted"
                  ? "View newly submitted articles that do not pay a fee."
                  : "View, search, edit, archive, and delete manuscripts or publications."}
              </CardDescription>
            </div>
            <div className="flex w-full sm:w-auto items-center gap-3">
              <Input
                className="max-w-xs"
                placeholder="Search author, title, email, ref #"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="min-w-0 overflow-hidden rounded-[1.4rem] border border-white/80 bg-white/92 shadow-[0_18px_38px_rgba(15,23,42,0.07)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[75rem] table-fixed text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="w-16 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">S No</th>
                      <th className="w-48 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">Author Name</th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">Title</th>
                      <th className="w-64 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">Submitted Manuscript</th>
                      <th className="w-36 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">Submission Date</th>
                      <th className="w-24 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">Status</th>
                      <th className="w-40 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredManuscripts.length ? (
                      filteredManuscripts.map((entry, index) => {
                        const manuscriptId = Number(entry.manuscript_id)
                        const isPublished = String(entry.status ?? "").toLowerCase() === "published"
                        const isArchived = Number(entry.archived ?? 0) === 1 || String(entry.archived ?? "") === "1"
                        
                        return (
                          <tr key={String(entry.article_id ?? entry.manuscript_id)} className="border-t border-slate-200/80 align-top odd:bg-white even:bg-slate-50/45">
                            <td className="px-4 py-3 text-slate-700">{index + 1}</td>
                            <td className="px-4 py-3 text-slate-700 font-medium break-words">{String(entry.author_name ?? "Unknown")}</td>
                            <td className="px-4 py-3 text-slate-900 font-semibold break-words">{String(entry.title ?? entry.manuscript_id)}</td>
                            <td className="px-4 py-3">
                              <ManuscriptFileBundlePreview value={entry.file_bundle} compact emptyMessage="No files" />
                            </td>
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                              {entry.submission_date ? String(entry.submission_date).slice(0, 10) : "—"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Badge className={cn(
                                "capitalize",
                                isPublished ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                              )}>
                                {String(entry.status ?? "submitted").replaceAll("_", " ")}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 rounded-full"
                                  title="Edit manuscript"
                                  onClick={() => openEdit(entry)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 rounded-full text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                                  title="Delete manuscript"
                                  onClick={() => setDeletingManuscript(entry)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                                {isPublished ? (
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    className={cn(
                                      "h-8 w-8 rounded-full",
                                      isArchived ? "bg-slate-100 text-slate-400 border-slate-200" : "text-slate-600 hover:border-slate-300"
                                    )}
                                    title={isArchived ? "Archived" : "Archive publication"}
                                    disabled={isArchived || archivingId === manuscriptId}
                                    onClick={() => handleArchive(entry)}
                                  >
                                    <Archive className="h-3.5 w-3.5" />
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                          {filterType === "unpaid_submitted" ? "No newly submitted unpaid manuscripts found." : "No manuscripts found."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {editingManuscript ? (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/70 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-950">Edit Manuscript</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {String(editingManuscript.author_name ?? "Unknown Author")} — Status: {String(editingManuscript.status ?? "")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingManuscript(null)}
                className="rounded-full border border-slate-200 p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                disabled={saving}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={handleEditSubmit}>
              <div className="space-y-2">
                <Label>Title</Label>
                <Textarea
                  value={editForm.title}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                  required
                  rows={3}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Reference Number</Label>
                  <Input
                    value={editForm.reference_number}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, reference_number: event.target.value }))}
                    required
                  />
                </div>
                {String(editingManuscript.status ?? "").toLowerCase() === "published" ? (
                  <div className="space-y-2">
                    <Label>Date of Publication</Label>
                    <Input
                      type="date"
                      value={editForm.publication_date}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, publication_date: event.target.value }))}
                      required
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button type="button" variant="outline" onClick={() => setEditingManuscript(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deletingManuscript ? (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-950">Delete Manuscript</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Are you sure you want to delete the manuscript: <strong>{String(deletingManuscript.title ?? deletingManuscript.manuscript_id)}</strong>?
                </p>
                <p className="mt-2 text-xs text-red-600">
                  This action is permanent and will delete the manuscript record, reviews, payments, files, and all other related records.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button type="button" variant="outline" onClick={() => setDeletingManuscript(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button type="button" className="bg-red-600 hover:bg-red-700 text-white border-transparent" onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? "Deleting..." : "Confirm Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
function AdminOverviewPanel({ workspace, onSaved }: { workspace: WorkspacePayload; onSaved: () => Promise<void> }) {
  const users = asArray(workspace.admin?.users)
  const journals = asArray(workspace.admin?.journals)
  const issues = asArray(workspace.admin?.issues)
  const manuscripts = asArray(workspace.admin?.manuscripts)
  const [archivingId, setArchivingId] = React.useState<number | null>(null)
  const [manuscriptSearch, setManuscriptSearch] = React.useState("")
  const normalize = (value: unknown) => String(value ?? "").toLowerCase()
  const filteredManuscripts = manuscriptSearch.trim() === ""
    ? manuscripts
    : manuscripts.filter((entry) => {
        const q = manuscriptSearch.toLowerCase()
        return normalize(entry.reference_number).includes(q)
          || normalize(entry.manuscript_id).includes(q)
          || normalize(entry.title).includes(q)
          || normalize(entry.scope_area).includes(q)
          || normalize(entry.article_type).includes(q)
      })
  const messages = asArray(workspace.messages)
  const publishedManuscripts = filteredManuscripts.filter((entry) => String(entry.status ?? "").toLowerCase() === "published")
  const archiveAdminPublication = async (manuscriptId: number) => {
    setArchivingId(manuscriptId)
    try {
      await archivePublication({ manuscript_id: manuscriptId })
      await onSaved()
      toast.success("Publication archived. Published records remain preserved and cannot be deleted from this action.")
    } catch (error) {
      toast.error(errorText(error, "Unable to archive publication."))
    } finally {
      setArchivingId(null)
    }
  }
  const [deletingIdAdmin, setDeletingIdAdmin] = React.useState<number | null>(null)
  const handleDeletePublicationAdmin = async (entry: Record<string, unknown>) => {
    const manuscriptId = Number(entry.manuscript_id ?? 0)
    const articleId = Number(entry.article_id ?? 0)
    setDeletingIdAdmin(manuscriptId || (articleId || null))
    try {
      const payload: Record<string, unknown> = {}
      if (articleId) payload.article_id = articleId
      else if (manuscriptId) payload.manuscript_id = manuscriptId
      await deletePublication(payload)
      await onSaved()
      toast.success("Publication and related records deleted.")
    } catch (error) {
      toast.error(errorText(error, "Unable to delete publication."))
    } finally {
      setDeletingIdAdmin(null)
    }
  }

  const handleEditPublicationAdmin = async (entry: Record<string, unknown>, form: PublicationEditForm) => {
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        publication_date: form.publication_date,
        reference_number: form.reference_number,
      }
      if (entry.article_id) payload.article_id = Number(entry.article_id)
      else if (entry.manuscript_id) payload.manuscript_id = Number(entry.manuscript_id)
      await updatePublication(payload)
      await onSaved()
      toast.success("Publication updated.")
    } catch (error) {
      toast.error(errorText(error, "Unable to update publication."))
    }
  }
  return <div className="grid gap-6"><div className="grid gap-4 md:grid-cols-2">{[{ label: "Users", value: users.length }, { label: "Journals", value: journals.length }, { label: "Issues", value: issues.length }, { label: "Messages", value: messages.length }].map((item) => <Card key={item.label} className="border-white/70 bg-white/85 backdrop-blur"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</p><p className="mt-2 text-3xl font-semibold text-slate-950">{item.value}</p></CardContent></Card>)}</div><ManualPlagiarismScorePanel entries={filteredManuscripts} title="Manual Plagiarism Score" description="Administrators can record or correct manuscript scores across the journal workspace." emptyMessage="No manuscripts are available for plagiarism score updates yet." onSaved={onSaved} /><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<BookMarked className="h-5 w-5" />} title="Publication Archive Control" description="Published articles can be archived by administrators, but published records are preserved and not deleted." /></CardHeader><CardContent className="space-y-3">{publishedManuscripts.length ? publishedManuscripts.slice(0, 5).map((entry)=>{ const manuscriptId = Number(entry.manuscript_id); const archived = Number(entry.archived ?? 0) === 1 || String(entry.archived ?? "") === "1"; return <div key={String(entry.manuscript_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-900">{String(entry.title ?? entry.manuscript_id)}</p><p className="text-sm text-slate-500">Ref: {String(entry.reference_number ?? entry.manuscript_id)} | {archived ? `Archived: ${String(entry.archived_at ?? "")}` : "Public"}</p></div><Button size="sm" variant="outline" disabled={archived || archivingId === manuscriptId} onClick={async()=>archiveAdminPublication(manuscriptId)}>{archived ? "Archived" : archivingId === manuscriptId ? "Archiving..." : "Archive publication"}</Button></div></div> }) : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No published manuscripts are available for archiving.</div>}<Table rows={publishedManuscripts} columns={["reference_number", "title", "status", "archived", "archived_at"]} /></CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><CardHeading icon={<Users className="h-5 w-5" />} title="Recent Platform Users" /><Input className="max-w-xs" placeholder="Search ref #, ID, or title" value={manuscriptSearch} onChange={(e)=>setManuscriptSearch(e.target.value)} /></CardHeader><CardContent><Table rows={filteredManuscripts} /></CardContent></Card></div>
}
function AdminInfrastructurePanel() {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [integrationSettings, setIntegrationSettings] = React.useState<AdminIntegrationsSettings>({ provider: "copyleaks", enabled: false, api_email: "", api_key: "", sandbox: true, require_completion: true, configured: false, api_key_configured: false, webhook_secret: "", webhook_url_template: "", new_results_webhook_url: "" })
  const [recentScans, setRecentScans] = React.useState<Array<Record<string, unknown>>>([])
  const [form, setForm] = React.useState({ plagiarism_enabled: false, plagiarism_api_email: "", plagiarism_api_key: "", plagiarism_sandbox: true, plagiarism_require_completion: true })

  const loadIntegrations = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await getAdminIntegrations()
      setIntegrationSettings(response.settings)
      setRecentScans(response.recent_scans)
      setForm({
        plagiarism_enabled: response.settings.enabled,
        plagiarism_api_email: response.settings.api_email,
        plagiarism_api_key: "",
        plagiarism_sandbox: response.settings.sandbox,
        plagiarism_require_completion: response.settings.require_completion,
      })
    } catch (error) {
      toast.error(errorText(error, "Unable to load integration settings."))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadIntegrations()
  }, [loadIntegrations])

  if (loading) {
    return <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Settings2 className="h-5 w-5" />} title="Infrastructure and Integrations" description="Loading plagiarism provider settings and scan activity." /></CardHeader><CardContent><div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading integration settings...</div></CardContent></Card>
  }

  return <div className="grid gap-6">
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="border-white/70 bg-white/85 backdrop-blur">
        <CardContent className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Provider</p>
          <p className="mt-3 text-2xl font-semibold text-slate-950">{plagiarismProviderLabel(integrationSettings.provider)}</p>
          <p className="mt-2 text-sm text-slate-600">Web-scale manuscript similarity scanning is routed through the configured external provider.</p>
        </CardContent>
      </Card>
      <Card className="border-white/70 bg-white/85 backdrop-blur">
        <CardContent className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Operational status</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge className={cn(integrationSettings.enabled ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700")}>{integrationSettings.enabled ? "Enabled" : "Disabled"}</Badge>
            <Badge className={cn(integrationSettings.configured ? "bg-[#edf5f9] text-[#0b6fa4]" : "bg-amber-100 text-amber-900")}>{integrationSettings.configured ? "Credentials configured" : "Credentials required"}</Badge>
          </div>
          <p className="mt-3 text-sm text-slate-600">The journal can only submit manuscripts to Copyleaks when the integration is enabled and the API credentials are valid.</p>
        </CardContent>
      </Card>
      <Card className="border-white/70 bg-white/85 backdrop-blur">
        <CardContent className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Submission rule</p>
          <p className="mt-3 text-2xl font-semibold text-slate-950">{integrationSettings.require_completion ? "Wait for score" : "Allow pending scans"}</p>
          <p className="mt-2 text-sm text-slate-600">{integrationSettings.require_completion ? "Authors must wait for a completed plagiarism score before manuscript submission is accepted." : "Authors can submit while the scan continues, and the score will sync back after the webhook completes."}</p>
        </CardContent>
      </Card>
    </div>

    <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
      <CardHeader>
        <CardHeading icon={<Settings2 className="h-5 w-5" />} title="Copyleaks Configuration" description="Configure the external plagiarism provider, webhook routing, and author submission behavior." />
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault()
            setSaving(true)
            try {
              const response = await updateAdminIntegrations(form)
              setIntegrationSettings(response.settings)
              setRecentScans(response.recent_scans)
              setForm({
                plagiarism_enabled: response.settings.enabled,
                plagiarism_api_email: response.settings.api_email,
                plagiarism_api_key: "",
                plagiarism_sandbox: response.settings.sandbox,
                plagiarism_require_completion: response.settings.require_completion,
              })
              toast.success(response.message || "Integration settings updated.")
            } catch (error) {
              toast.error(errorText(error, "Unable to update integration settings."))
            } finally {
              setSaving(false)
            }
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>API email</Label>
              <Input type="email" value={form.plagiarism_api_email} onChange={(e) => setForm((prev) => ({ ...prev, plagiarism_api_email: e.target.value }))} placeholder="copyleaks-account@example.com" />
            </div>
            <div className="space-y-2">
              <Label>API key</Label>
              <Input type="password" value={form.plagiarism_api_key} onChange={(e) => setForm((prev) => ({ ...prev, plagiarism_api_key: e.target.value }))} placeholder={integrationSettings.api_key_configured ? "Stored securely. Enter a new key only to rotate it." : "Paste the Copyleaks API key"} />
              <p className="text-xs text-slate-500">{integrationSettings.api_key_configured ? "A key is already stored securely on the server." : "No API key is stored yet."}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
              <input type="checkbox" checked={form.plagiarism_enabled} onChange={(e) => setForm((prev) => ({ ...prev, plagiarism_enabled: e.target.checked }))} />
              <span><span className="font-semibold text-slate-900">Enable Copyleaks scanning</span><br />Turn on web-scale plagiarism scanning for author manuscript uploads.</span>
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
              <input type="checkbox" checked={form.plagiarism_sandbox} onChange={(e) => setForm((prev) => ({ ...prev, plagiarism_sandbox: e.target.checked }))} />
              <span><span className="font-semibold text-slate-900">Use sandbox mode</span><br />Keep this enabled while testing the integration before going live.</span>
            </label>
            <label className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
              <input type="checkbox" checked={form.plagiarism_require_completion} onChange={(e) => setForm((prev) => ({ ...prev, plagiarism_require_completion: e.target.checked }))} />
              <span><span className="font-semibold text-slate-900">Require a completed score before manuscript submission</span><br />Recommended. When disabled, authors can submit while the provider is still processing and the final score will sync back after the webhook fires.</span>
            </label>
          </div>

          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save integration settings"}</Button>
        </form>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Webhook status template</p>
            <p className="mt-3 text-sm text-slate-700 break-all">{integrationSettings.webhook_url_template}</p>
            <p className="mt-3 text-xs leading-6 text-slate-500">Register this pattern in Copyleaks so status updates arrive at the JASTI backend. The provider substitutes the final event in place of <code>{`{STATUS}`}</code>.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">New results webhook</p>
            <p className="mt-3 text-sm text-slate-700 break-all">{integrationSettings.new_results_webhook_url}</p>
            <p className="mt-3 text-xs leading-6 text-slate-500">Use this callback for result-notification events so the top matches and aggregated similarity score are stored automatically.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Operational notes</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              <li>Production mode should only be enabled after the public webhook URL is reachable from Copyleaks.</li>
              <li>Use sandbox mode first to verify callbacks and dashboard polling without consuming live credits.</li>
              <li>Recent scan activity below reflects the last submissions seen by the JASTI backend.</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
      <CardHeader>
        <CardHeading icon={<ShieldCheck className="h-5 w-5" />} title="Recent Plagiarism Scans" description="Inspect the latest provider jobs, completion state, similarity scores, and manuscript linkage." />
      </CardHeader>
      <CardContent>
        {recentScans.length ? <div className="space-y-3">
          {recentScans.map((scan, index) => <div key={String(scan.scan_row_id ?? `${scan.source_filename ?? "scan"}-${scan.updated_at ?? index}`)} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">{String(scan.title ?? scan.source_filename ?? "Untitled scan")}</p>
                  <PlagiarismStatusBadge status={String(scan.status ?? "pending")} />
                </div>
                <p className="mt-2 text-sm text-slate-500">{String(scan.source_filename ?? "No source filename recorded")}</p>
              </div>
              <div className="text-left lg:text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Similarity score</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{scan.similarity_score === null || scan.similarity_score === undefined || scan.similarity_score === "" ? "Pending" : `${Number(scan.similarity_score).toFixed(2)}%`}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
              <p>Provider: <span className="font-semibold text-slate-900">{plagiarismProviderLabel(String(scan.provider ?? ""))}</span></p>
              <p>Manuscript ID: <span className="font-semibold text-slate-900">{String(scan.manuscript_id ?? "Not linked yet")}</span></p>
              <p>Submitted: <span className="font-semibold text-slate-900">{String(scan.submitted_at ?? "Not yet")}</span></p>
              <p>Updated: <span className="font-semibold text-slate-900">{String(scan.updated_at ?? "Not yet")}</span></p>
            </div>
            {String(scan.last_error ?? "").trim() ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{String(scan.last_error)}</div> : null}
          </div>)}
        </div> : <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">No plagiarism scans have been submitted yet.</div>}
      </CardContent>
    </Card>
  </div>
}
function AdminMonitoringPanel({ workspace }: { workspace: WorkspacePayload }) {
  const messages = asArray(workspace.messages)
  const issues = asArray(workspace.admin?.issues)
  const journals = asArray(workspace.admin?.journals)
  return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Workflow className="h-5 w-5" />} title="System Monitoring" description="Observe communication flow, publication structures, and admin-visible activity across the platform." /></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Issues configured</p><p className="mt-2 text-3xl font-semibold text-slate-950">{issues.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Journal records</p><p className="mt-2 text-3xl font-semibold text-slate-950">{journals.length}</p></div><div className="md:col-span-2"><Table rows={messages} /></div></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<BookMarked className="h-5 w-5" />} title="Issue Registry" /></CardHeader><CardContent><Table rows={issues} /></CardContent></Card></div>
}
function ModulePanel({ role, section, workspace, user, settings, onRefresh }: { role: string; section: string; workspace: WorkspacePayload; user: AuthUser; settings: JournalSettings; onRefresh: () => Promise<void> }) {
  if (role === "author") { if (section === "profile") return <ProfileCard user={user} onSaved={onRefresh} />; if (section === "communication") return <MessagesCard workspace={workspace} user={user} onSaved={onRefresh} />; return <AuthorPanels section={section} workspace={workspace} settings={settings} onSaved={onRefresh} /> }
  if (role === "reviewer") {
    if (!workspace.reviewer?.onboarding?.completed) return <ReviewerOnboardingCard onboarding={workspace.reviewer?.onboarding} user={user} onSaved={onRefresh} />
    if (section === "communication") return <MessagesCard workspace={workspace} user={user} onSaved={onRefresh} />
    return <ReviewerPanels section={section} workspace={workspace} onSaved={onRefresh} />
  }
  if (role === "technical_editor") {
    if (section === "profile") return <EditorOnboardingCard onboarding={workspace.editor?.onboarding} user={user} onSaved={onRefresh} />
    if (!workspace.editor?.onboarding?.completed) return <EditorOnboardingCard onboarding={workspace.editor?.onboarding} user={user} onSaved={onRefresh} />
    return <TechnicalEditorPanels section={section} workspace={workspace} settings={settings} onSaved={onRefresh} />
  }
  if (resolveWorkspaceRole(role) === "editor") {
    if (section === "profile") return <EditorOnboardingCard onboarding={workspace.editor?.onboarding} user={user} onSaved={onRefresh} />
    if (!workspace.editor?.onboarding?.completed) return <EditorOnboardingCard onboarding={workspace.editor?.onboarding} user={user} onSaved={onRefresh} />
    if (section === "communication") return <MessagesCard workspace={workspace} user={user} onSaved={onRefresh} />
    return <EditorPanels section={section} workspace={workspace} onSaved={onRefresh} />
  }
  if (role === "editor_in_chief") return <EicPanels section={section} workspace={workspace} onSaved={onRefresh} />
  if (role === "admin") { if (section === "overview") return <AdminOverviewPanel workspace={workspace} onSaved={onRefresh} />; if (section === "manage-all-articles") return <AdminManageAllArticlesPanel workspace={workspace} onSaved={onRefresh} />; if (section === "applications") return <ApplicationsReview onSaved={onRefresh} />; if (section === "users") return <AdminUsersPanel workspace={workspace} onSaved={onRefresh} />; if (section === "settings") return <SettingsPanel settings={settings} onRefresh={onRefresh} />; if (section === "integrations") return <AdminInfrastructurePanel />; if (section === "monitoring") return <AdminMonitoringPanel workspace={workspace} />; if (section === "reports") return <ReportsPanel />; return <Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>{section.replaceAll("-"," ")}</CardTitle></CardHeader><CardContent><Table rows={[]} /></CardContent></Card> }
  return <Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Workspace</CardTitle></CardHeader><CardContent><Table rows={[]} /></CardContent></Card>
}
export default function AdminApp() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedRole = searchParams.get("role")?.trim() ?? ""
  const requestedSection = searchParams.get("section")?.trim() ?? ""
  const [loading, setLoading] = React.useState(true)
  const [workspace, setWorkspace] = React.useState<WorkspacePayload | null>(null)
  const [settings, setSettings] = React.useState<JournalSettings>(fallbackSettings)
  const [activeRole, setActiveRole] = React.useState("")
  const [activeSection, setActiveSection] = React.useState("")
  const [mobileNavigationOpen, setMobileNavigationOpen] = React.useState(false)
  const [loggingOut, setLoggingOut] = React.useState(false)
  const [loadError, setLoadError] = React.useState("")
  React.useEffect(() => {
    if (!mobileNavigationOpen || typeof document === "undefined") return

    const originalOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavigationOpen(false)
    }

    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [mobileNavigationOpen])
  const refresh = React.useCallback(async () => {
    setLoading(true)
    setLoadError("")
    try {
      const [workspaceResponse, settingsResponse] = await Promise.all([getWorkspace(), getPublicSettings()])
      const normalizedRoles = Array.isArray(workspaceResponse?.roles)
        ? workspaceResponse.roles
        : Array.isArray(workspaceResponse?.user?.roles)
          ? workspaceResponse.user.roles
          : []
      const normalizedWorkspace = {
        ...workspaceResponse,
        roles: normalizedRoles,
        user: {
          ...workspaceResponse.user,
          roles: Array.isArray(workspaceResponse?.user?.roles) ? workspaceResponse.user.roles : normalizedRoles,
        },
      }
      const normalizedSettings = normalizeJournalSettings(settingsResponse.settings)
      setWorkspace(normalizedWorkspace)
      setSettings(normalizedSettings)
      applyJournalBranding(normalizedSettings)
      const rolePriority: Record<string, number> = {
        admin: 10,
        editor_in_chief: 9,
        managing_editor: 8,
        section_editor: 7,
        technical_editor: 6,
        advisory_board: 5,
        editor: 4,
        reviewer: 3,
        author: 1,
      }
      const sortedRoles = [...normalizedRoles].sort((a, b) => {
        const priorityA = rolePriority[a] ?? 0
        const priorityB = rolePriority[b] ?? 0
        return priorityB - priorityA
      })
      const firstRole = sortedRoles[0] ?? ""
      setActiveRole((current) => {
        if (requestedRole && normalizedRoles.includes(requestedRole)) {
          return requestedRole
        }
        return current && normalizedRoles.includes(current) ? current : firstRole
      })
    } catch (error) {
      setWorkspace(null)
      setLoadError(errorText(error, "Unable to load dashboard."))
      toast.error(errorText(error, "Unable to load dashboard."))
    } finally {
      setLoading(false)
    }
  }, [requestedRole])
  React.useEffect(() => { void refresh() }, [refresh])
  const resolvedActiveRole = React.useMemo(() => resolveWorkspaceRole(activeRole), [activeRole])
  const activeConfig = React.useMemo(() => workspaceConfigs.find((entry) => entry.role === resolvedActiveRole), [resolvedActiveRole])
  const defaultSectionForRole = React.useCallback((role: string) => {
    const resolvedRole = resolveWorkspaceRole(role)
    const config = workspaceConfigs.find((entry) => entry.role === resolvedRole)
    if (!config) return ""
    const fallbackSection = config.sections.some((entry) => entry.id === (roleDefaultSections[resolvedRole] ?? ""))
      ? roleDefaultSections[resolvedRole]
      : config.sections[0]?.id ?? ""
    if (
      ["author", "reviewer", "editor"].includes(resolvedRole)
      && needsProfileCompletion(workspace?.user)
      && config.sections.some((entry) => entry.id === "profile")
    ) {
      return "profile"
    }
    return fallbackSection
  }, [workspace?.user])
  const switchRole = React.useCallback((role: string) => {
    setActiveRole(role)
    setActiveSection(defaultSectionForRole(role))
  }, [defaultSectionForRole])
  const defaultRoleSection = React.useMemo(() => {
    if (!activeConfig) return ""
    const fallbackSection = activeConfig.sections.some((entry) => entry.id === (roleDefaultSections[resolvedActiveRole] ?? ""))
      ? roleDefaultSections[resolvedActiveRole]
      : activeConfig.sections[0]?.id ?? ""
    if (
      ["author", "reviewer", "editor"].includes(resolvedActiveRole)
      && needsProfileCompletion(workspace?.user)
      && activeConfig.sections.some((entry) => entry.id === "profile")
    ) {
      return "profile"
    }
    return fallbackSection
  }, [activeConfig, resolvedActiveRole, workspace?.user])
  React.useEffect(() => {
    if (!activeConfig) return
    setActiveSection((current)=> {
      if (resolvedActiveRole === "editor" && (!requestedSection || requestedSection === "assignments" || requestedSection === "screening")) {
        return "selection"
      }
      const requestMatchesActiveRole = !requestedRole || requestedRole === activeRole
      if (requestMatchesActiveRole && requestedSection && activeConfig.sections.some((entry)=> entry.id===requestedSection)) {
        return requestedSection
      }
      if (current && activeConfig.sections.some((entry)=> entry.id===current)) {
        return current
      }
      if (["author", "reviewer", "editor"].includes(resolvedActiveRole)) {
        return defaultRoleSection
      }
      return current && activeConfig.sections.some((entry)=> entry.id===current) ? current : activeConfig.sections[0]?.id ?? ""
    })
  }, [activeConfig, activeRole, defaultRoleSection, requestedRole, requestedSection, resolvedActiveRole])
  React.useEffect(() => {
    if (!activeRole || !activeSection) return
    if (activeConfig && !activeConfig.sections.some((entry) => entry.id === activeSection)) return
    const next = new URLSearchParams(searchParams)
    if (next.get("role") === activeRole && next.get("section") === activeSection) return
    next.set("role", activeRole)
    next.set("section", activeSection)
    setSearchParams(next, { replace: true })
  }, [activeConfig, activeRole, activeSection, searchParams, setSearchParams])
  if (!loading && !workspace) return <div className="relative min-h-screen overflow-hidden px-4 py-16 sm:px-6 lg:px-8"><div className="absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_top_left,rgba(11,111,164,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(31,107,92,0.14),transparent_24%)]" /><div className="mx-auto max-w-3xl"><Card className="surface-panel-strong"><CardHeader><Badge className="w-fit bg-[#edf5f9] text-[#0b6fa4]">Workspace error</Badge><CardTitle className="display-section text-slate-950">Unable to open workspace</CardTitle><CardDescription>{loadError || "The dashboard session could not be loaded."}</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3"><Button onClick={()=>void refresh()}>Retry workspace</Button><Link to="/login/author" className={cn(buttonVariants({ variant: "outline" }))}>Return to login</Link></CardContent></Card></div></div>
  if (!loading && workspace && (!workspace.roles || workspace.roles.length === 0)) return <div className="relative min-h-screen overflow-hidden px-4 py-16 sm:px-6 lg:px-8"><div className="absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_top_left,rgba(11,111,164,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(31,107,92,0.14),transparent_24%)]" /><div className="mx-auto max-w-3xl"><Card className="surface-panel-strong"><CardHeader><Badge className="w-fit bg-[#edf5f9] text-[#0b6fa4]">Access issue</Badge><CardTitle className="display-section text-slate-950">No workspace roles available</CardTitle><CardDescription>Your account is authenticated, but no journal role is assigned for dashboard access.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3"><Button onClick={()=>void refresh()}>Reload workspace</Button><Link to="/login/author" className={cn(buttonVariants({ variant: "outline" }))}>Return to login</Link></CardContent></Card></div></div>
  const user = workspace?.user
  const statsSource = resolvedActiveRole && workspace ? (workspace as Record<string, unknown>)[resolvedActiveRole] : null
  const currentStats = statsSource && typeof statsSource === "object" ? (statsSource as Record<string, unknown>).overview ?? (statsSource as Record<string, unknown>) : null
  const currentSectionConfig = activeConfig?.sections.find((section)=>section.id===activeSection)
  const activeRoleLabel = roleLabels[activeRole] ?? (activeRole || "Pending")
  const activeSectionTitle = currentSectionConfig?.label ?? activeConfig?.title ?? "Loading workspace..."
  const activeSectionDescription = currentSectionConfig?.description ?? activeConfig?.intro ?? "Loading role workspace."
  const workspaceBrandAcronym = (() => {
    const normalized = String(settings.journal_acronym ?? "").trim()
    if (!normalized) return "JASTI"
    return normalized.toUpperCase()
  })()
  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logoutAccount()
      setWorkspace(null)
      toast.success("Logged out successfully.")
      navigate(resolveLogoutRedirect(activeRole || workspace?.roles?.[0] || ""), { replace: true })
    } catch (error) {
      toast.error(errorText(error, "Unable to log out."))
    } finally {
      setLoggingOut(false)
    }
  }
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top_left,rgba(11,111,164,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(31,107,92,0.16),transparent_24%),linear-gradient(180deg,rgba(248,250,252,0.9)_0%,rgba(246,250,248,0.94)_46%,rgba(238,244,248,0.96)_100%)]" />
      <header className="sticky top-0 z-[130] border-b border-white/70 bg-[rgba(248,250,252,0.76)] backdrop-blur-xl">
        <div className="mx-auto w-full max-w-none px-3 py-2.5 sm:px-6 sm:py-3 lg:px-8 2xl:px-10">
          <div className="surface-panel-strong flex items-center justify-between gap-3 px-3.5 py-2.5 sm:px-4 sm:py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] border border-white/80 bg-white shadow-[0_12px_24px_rgba(15,23,42,0.12)] sm:h-12 sm:w-12">
                {settings.logo_path ? (
                  <img src={resolveApiAssetUrl(settings.logo_path)} alt={settings.journal_name} className="h-full w-full object-cover" />
                ) : (
                  <span className="display-acronym text-[1.15rem] text-jostum-700 sm:text-[1.3rem]">{workspaceBrandAcronym}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-display text-[1.15rem] font-semibold leading-none tracking-[-0.04em] text-slate-950 sm:text-[1.3rem]">
                  {workspaceBrandAcronym}
                </p>
                <p className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:block">
                  {activeRoleLabel} workspace
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-3">
              <Link
                to="/"
                aria-label="Public Site"
                title="Public Site"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:border-jostum-300 hover:text-jostum-700 sm:w-auto sm:gap-2 sm:px-4"
              >
                <Globe2 className="h-4 w-4" />
                <span className="hidden sm:inline">Public Site</span>
              </Link>
              {user ? <ProfileMenu user={user} activeRoleLabel={activeRoleLabel} onSaved={refresh} onLogout={handleLogout} loggingOut={loggingOut} /> : null}
              <button
                type="button"
                aria-controls="dashboard-mobile-nav"
                  aria-expanded={mobileNavigationOpen}
                aria-label={mobileNavigationOpen ? "Close dashboard navigation" : "Open dashboard navigation"}
                onClick={() => setMobileNavigationOpen((current) => !current)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:border-jostum-300 hover:text-jostum-700 xl:hidden"
              >
                {mobileNavigationOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </header>
      {mobileNavigationOpen ? <div className="fixed inset-0 z-[120] bg-slate-950/30 xl:hidden" onClick={() => setMobileNavigationOpen(false)}>
        <div className="absolute inset-x-0 bottom-0 top-[5.2rem] px-3 pb-3 sm:top-[5.75rem] sm:px-6 sm:pb-6" onClick={(event) => event.stopPropagation()}>
          <div id="dashboard-mobile-nav" className="surface-panel-strong flex h-full w-[min(92vw,24rem)] max-w-full flex-col overflow-hidden shadow-[0_30px_70px_rgba(15,23,42,0.22)]">
            <div className="h-1.5 bg-[linear-gradient(90deg,#0b6fa4_0%,#1f6b5c_100%)]" />
            <CardContent className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Dashboard navigation</p>
                <p className="mt-1 text-sm text-slate-500">{activeRoleLabel}</p>
              </div>
              <div className="space-y-4 border-t border-slate-200/80 pt-4">
                <div>
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Role spaces</p>
                  <div className="mt-2.5 grid gap-2">
                    {(workspace?.roles ?? []).map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => {
                          switchRole(role)
                          setMobileNavigationOpen(false)
                        }}
                        className={cn(
                          "flex min-h-[3.7rem] w-full items-start gap-3 rounded-[1.15rem] px-3.5 py-3 text-left text-[13px] font-semibold leading-5 transition",
                          activeRole === role
                            ? "bg-[linear-gradient(135deg,#0b6fa4_0%,#1f6b5c_100%)] text-white shadow-[0_16px_28px_rgba(11,111,164,0.18)]"
                            : "border border-slate-200/80 bg-slate-50/90 text-slate-700 hover:border-jostum-200 hover:bg-white hover:text-slate-950",
                        )}
                      >
                        <RoleIcon role={role} className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 whitespace-normal">{roleLabels[role] ?? role}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {activeConfig ? (
                  <div>
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{activeConfig.title} links</p>
                    <div className="mt-2.5 grid gap-2">
                      {activeConfig.sections.map((section) => (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => {
                            setActiveSection(section.id)
                            setMobileNavigationOpen(false)
                          }}
                          className={cn(
                            "flex min-h-[4rem] w-full items-start gap-3 rounded-[1.15rem] px-3.5 py-3 text-left text-[13px] font-medium leading-5 transition",
                            activeSection === section.id
                              ? "bg-slate-950 text-white shadow-[0_16px_28px_rgba(15,23,42,0.16)]"
                              : "border border-slate-200/80 bg-white/90 text-slate-700 hover:border-jostum-200 hover:bg-jostum-50/70 hover:text-jostum-700",
                          )}
                        >
                          <SectionIcon sectionId={section.id} className="mt-0.5 h-4 w-4 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="whitespace-normal text-[13px] font-semibold leading-5">{section.label}</p>
                            <p className={cn("mt-1 text-[11px] leading-4", activeSection === section.id ? "text-slate-300" : "text-slate-500")}>
                              {section.description}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </div>
        </div>
      </div> : null}
      <div className="mx-auto w-full max-w-none px-3 py-4 sm:px-6 lg:px-8 xl:py-6 2xl:px-10">
        <div className="mt-4 grid gap-4 lg:gap-6 xl:mt-0 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden self-start xl:sticky xl:top-28 xl:block">
            <div className="workspace-sidebar-scroll surface-panel space-y-3 p-3 lg:max-h-[calc(100vh-7.75rem)] lg:space-y-4 lg:overflow-y-auto lg:p-3.5 lg:pr-2">
              <div>
                <p className="px-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Role spaces</p>
                <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1 xl:grid xl:overflow-visible xl:pb-0">
                  {(workspace?.roles ?? []).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => switchRole(role)}
                      className={cn(
                        "flex min-w-max items-center gap-3 rounded-[1.15rem] px-3.5 py-2.5 text-left text-[13px] font-semibold leading-5 whitespace-nowrap transition xl:w-full xl:min-w-0",
                        activeRole === role
                          ? "bg-[linear-gradient(135deg,#0b6fa4_0%,#1f6b5c_100%)] text-white shadow-[0_16px_28px_rgba(11,111,164,0.18)]"
                          : "bg-slate-50/90 text-slate-600 hover:bg-white hover:text-slate-900",
                      )}
                    >
                      <RoleIcon role={role} className="h-4 w-4" />
                      <span className="min-w-0 flex-1">{roleLabels[role] ?? role}</span>
                    </button>
                  ))}
                </div>
              </div>
              {activeConfig ? (
                <div>
                  <p className="px-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{activeConfig.title} links</p>
                  <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1 xl:grid xl:overflow-visible xl:pb-0">
                    {activeConfig.sections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setActiveSection(section.id)}
                        className={cn(
                          "flex min-w-max items-center gap-3 rounded-[1.15rem] px-3.5 py-2.5 text-left text-[13px] font-medium leading-5 whitespace-nowrap transition xl:w-full xl:min-w-0",
                          activeSection === section.id
                            ? "bg-slate-950 text-white shadow-[0_16px_28px_rgba(15,23,42,0.16)]"
                            : "bg-slate-50/90 text-slate-700 hover:bg-jostum-50 hover:text-jostum-700",
                        )}
                      >
                        <SectionIcon sectionId={section.id} className="h-4 w-4" />
                        <span className="min-w-0 flex-1">{section.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
          <main className="min-w-0 space-y-4 sm:space-y-5">
            <Card data-workspace-summary className="surface-panel-strong overflow-hidden">
              <div className="h-1.5 bg-[linear-gradient(90deg,#0b6fa4_0%,#1f6b5c_100%)]" />
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.15rem] bg-[linear-gradient(135deg,rgba(11,111,164,0.14),rgba(31,107,92,0.18))] text-jostum-700">
                    <SectionIcon sectionId={activeSection} className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <Badge className="w-fit bg-[#edf5f9] px-3 py-1 text-[10px] tracking-[0.16em] text-[#0b6fa4]">{activeConfig?.title ?? "Loading"}</Badge>
                    <h2 className="mt-1.5 font-display text-[clamp(1.15rem,4.6vw,2.03rem)] font-semibold leading-[1] tracking-[-0.04em] text-slate-950">
                      {activeSectionTitle}
                    </h2>
                    <p className="mt-1.5 max-w-3xl text-[12px] leading-5 text-slate-600 sm:mt-2 sm:text-sm sm:leading-6">
                      {activeSectionDescription}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {currentStats ? <Stats source={currentStats} /> : null}
            {workspace && user && activeRole && activeSection ? (
              <ModulePanel role={resolvedActiveRole} section={activeSection} workspace={workspace} user={user} settings={settings} onRefresh={refresh} />
            ) : (
              <Card className="surface-panel">
                <CardContent className="p-6 text-sm text-slate-600">Loading workspace...</CardContent>
              </Card>
            )}
          </main>
        </div>
      </div>
      <Toaster position="top-right" />
    </div>
  )
}
