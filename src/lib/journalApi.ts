import axios, { isAxiosError, type AxiosProgressEvent } from "axios"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizedAppBasePath() {
  const basePath = String(import.meta.env.BASE_URL || "/").trim()
  if (!basePath || basePath === "/") return ""
  return `/${basePath.replace(/^\/+|\/+$/g, "")}`
}

function defaultApiBaseUrl() {
  if (typeof window === "undefined" || !window.location?.origin) return "/api"

  // When Vite serves the frontend on a dev port, the PHP API still lives under Apache.
  if (import.meta.env.DEV) {
    return "/api"
  }

  return `${window.location.origin}${normalizedAppBasePath()}/api`
}

function normalizeConfiguredUrl(value?: string) {
  return value?.trim().replace(/\/+$/, "") || ""
}

function isLocalHostname(hostname: string) {
  return new Set(["localhost", "127.0.0.1", "::1"]).has(hostname.toLowerCase())
}

function shouldUseDevApiProxy(value: string) {
  if (typeof window === "undefined" || !import.meta.env.DEV || !value) return false

  try {
    const configuredUrl = new URL(value, window.location.origin)
    return isLocalHostname(configuredUrl.hostname)
  } catch {
    return false
  }
}

function isHostedLocalOnlyApiUrl(value: string) {
  if (typeof window === "undefined" || !value) return false

  try {
    const configuredUrl = new URL(value, window.location.origin)
    const configuredHost = configuredUrl.hostname.toLowerCase()
    const currentHost = window.location.hostname.toLowerCase()
    return isLocalHostname(configuredHost) && !isLocalHostname(currentHost)
  } catch {
    return false
  }
}

function configuredApiBaseUrl() {
  if (typeof window === "undefined") return ""
  const runtimeConfig = window.__JASTI_RUNTIME_CONFIG__?.apiUrl?.trim() || ""
  if (runtimeConfig) {
    const normalizedRuntimeUrl = normalizeConfiguredUrl(runtimeConfig)
    if (!shouldUseDevApiProxy(normalizedRuntimeUrl) && !isHostedLocalOnlyApiUrl(normalizedRuntimeUrl)) {
      return normalizedRuntimeUrl
    }
  }
  const runtimeMeta = document.querySelector('meta[name="jasti-api-base"]')?.getAttribute("content")?.trim() || ""
  const normalizedMetaUrl = normalizeConfiguredUrl(runtimeMeta)
  if (!shouldUseDevApiProxy(normalizedMetaUrl) && !isHostedLocalOnlyApiUrl(normalizedMetaUrl)) {
    return normalizedMetaUrl
  }
  return ""
}

const baseURL = configuredApiBaseUrl() || defaultApiBaseUrl()
const apiBaseUrl = new URL(baseURL.endsWith("/") ? baseURL : `${baseURL}/`, typeof window !== "undefined" ? window.location.origin : "http://localhost")
const apiRootPath = apiBaseUrl.pathname.replace(/\/+$/, "")
const appBasePath = apiRootPath.replace(/\/api$/, "")

export const journalApi = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
})

const botChallengeMarkers = [
  "__cf$cv$params",
  "challenge-platform",
  'document.cookie = "humans_',
  "cf-browser-verification",
]

function isHtmlBotChallengeResponse(data: unknown, status?: number, contentType?: string) {
  if (typeof data !== "string") return false

  const normalized = data.toLowerCase()
  const type = (contentType ?? "").toLowerCase()
  const htmlLike = type.includes("text/html") || normalized.includes("<html") || normalized.includes("<script")
  if (!htmlLike) return false

  return [403, 409, 429, 503].includes(status ?? 0) && botChallengeMarkers.some((marker) => normalized.includes(marker))
}

export function resolveApiErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    const responseData = error.response?.data
    if (isRecord(responseData)) {
      if (typeof responseData.message === "string" && responseData.message.trim() !== "") {
        return responseData.message
      }
      if (typeof responseData.error === "string" && responseData.error.trim() !== "") {
        return responseData.error
      }
    }

    const contentTypeHeader = error.response?.headers?.["content-type"]
    const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader.join("; ") : String(contentTypeHeader ?? "")

    if (isHtmlBotChallengeResponse(responseData, error.response?.status, contentType)) {
      return "The site security layer blocked this request before it reached JASTI. Allow /api/* in Cloudflare or hosting security, then try again."
    }

    if (typeof responseData === "string" && contentType.toLowerCase().includes("text/html")) {
      return "The server returned an unexpected HTML page instead of API JSON. Check the site firewall or hosting configuration."
    }
  }

  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function resolveApiAssetUrl(path?: string | null) {
  if (!path) return ""
  if (/^https?:\/\//i.test(path)) return path
  if (import.meta.env.DEV) {
    if (path.startsWith("/api/")) return path
    if (path.startsWith("api/")) return `/${path}`
    if (path.startsWith("/uploads/")) return `/api${path}`
    if (path.startsWith("uploads/")) return `/api/${path}`
  }
  if (path.startsWith("/images/")) {
    return new URL(path, typeof window !== "undefined" ? window.location.origin : apiBaseUrl.origin).toString()
  }
  if (path.startsWith("/api/")) {
    return new URL(`${appBasePath}${path}`, apiBaseUrl.origin).toString()
  }
  return new URL(path.replace(/^\/+/, ""), `${apiBaseUrl.href}`).toString()
}

export function buildPublicArticleDownloadUrl(articleId: number, target: "pdf" | "article" = "pdf") {
  const url = new URL("public/download.php", apiBaseUrl.href)
  url.searchParams.set("article_id", String(articleId))
  url.searchParams.set("target", target)
  return url.toString()
}

export function buildReportDownloadUrl(type: string, format: string) {
  const url = new URL("reports.php", apiBaseUrl.href)
  url.searchParams.set("type", type)
  url.searchParams.set("format", format)
  return url.toString()
}

export type JournalSettings = {
  journal_name: string
  journal_acronym: string
  logo_path: string
  homepage_tagline: string
  homepage_intro: string
  home_topbar_text: string
  featured_articles_title: string
  featured_articles_description: string
  research_pathways_title: string
  call_for_papers_title: string
  call_for_papers_description: string
  call_for_papers_cta_title: string
  call_for_papers_cta_body: string
  call_for_papers_notes: string[]
  trending_research_title: string
  trending_research_description: string
  publishing_overview_title: string
  publishing_overview_description: string
  workflow_snapshot_title: string
  workflow_snapshot_description: string
  discover_open_access_title: string
  discover_open_access_body: string
  discover_open_access_image: string
  discover_open_access_points: string[]
  publish_with_us_title: string
  publish_with_us_body: string
  publish_with_us_image: string
  publish_with_us_points: string[]
  track_research_title: string
  track_research_body: string
  track_research_image: string
  call_for_papers: Array<{ title: string; deadline: string; summary: string }>
  trending_research: Array<{ title: string; area: string; summary: string }>
  aims: string[]
  scope: string[]
  objectives: string[]
  review_specializations: string[]
  footer_summary: string
  footer_bottom_text: string
  footer_bottom_tagline: string
  whatsapp_number: string
  default_gq_percent: string
  default_ai_score_percent: string
  default_similarity_percent: string
  submission_fee_ngn: string
  publication_fee_ngn: string
}

export type AuthUser = {
  user_id: number
  first_name: string
  last_name: string
  email: string
  orcid_id?: string | null
  institution?: string | null
  country?: string | null
  phone?: string | null
  avatar_path?: string | null
  status?: string
  date_registered?: string | null
  last_login?: string | null
  roles: string[]
}

export type DashboardPayload = Record<string, { title: string; stats: unknown; actions: string[] }>

export type WorkspacePayload = {
  user: AuthUser
  settings: Record<string, string>
  roles: string[]
  messages: Array<Record<string, unknown>>
  author?: {
    manuscripts: Array<Record<string, unknown>>
    revisions: Array<Record<string, unknown>>
    payments?: Array<Record<string, unknown>>
    copyright_forms?: Array<Record<string, unknown>>
  }
  reviewer?: {
    profile: Record<string, unknown> | null
    onboarding?: {
      completed: boolean
      application: Record<string, unknown>
      qualifications: Array<Record<string, unknown>>
      expertise: Array<Record<string, unknown>>
      journal_experiences: Array<Record<string, unknown>>
      availability: Record<string, unknown>
      conflicts: Array<Record<string, unknown>>
      agreements: Record<string, unknown>
      specialization_options: string[]
    }
    invitations: Array<Record<string, unknown>>
    reviews: Array<Record<string, unknown>>
  }
  editor?: {
    overview?: Record<string, unknown>
    profile?: Record<string, unknown> | null
    onboarding?: {
      completed: boolean
      application: Record<string, unknown>
      qualifications: Array<Record<string, unknown>>
      expertise: Array<Record<string, unknown>>
      journal_experiences: Array<Record<string, unknown>>
      section_options: Array<Record<string, unknown>>
    }
    assignments: Array<Record<string, unknown>>
    unassigned_manuscripts: Array<Record<string, unknown>>
    technical_screenings?: Array<Record<string, unknown>>
    reviewers: Array<Record<string, unknown>>
    decisions: Array<Record<string, unknown>>
  }
  editor_in_chief?: {
    overview: Record<string, unknown>
    editor_decisions: Array<Record<string, unknown>>
    final_decisions: Array<Record<string, unknown>>
    users: Array<Record<string, unknown>>
  }
  admin?: {
    users: Array<Record<string, unknown>>
    journals: Array<Record<string, unknown>>
    issues: Array<Record<string, unknown>>
    manuscripts?: Array<Record<string, unknown>>
    settings: Record<string, string>
  }
}

export type FeaturedArticle = {
  article_id: number
  manuscript_id: number
  title: string
  abstract: string
  article_type: string
  doi: string
  publication_date: string
  article_url: string
  journal_name: string
  keywords?: string | null
  views: number
  downloads: number
  citations: number
  altmetric_score: number
  authors: string[]
}

export type PublicArticleDetail = {
  article_id: number
  manuscript_id: number
  title: string
  abstract: string
  introduction: string
  article_type: string
  doi: string
  publication_date: string
  page_numbers: string
  journal_name: string
  issn: string
  volume: number | null
  issue_number: number | null
  publication_year: number | null
  article_url: string
  pdf_path: string
  downloads: number
  views: number
  citations: number
  altmetric_score: number
  authors: string[]
  keywords: string[]
}

export type PublicResearcherPublication = {
  article_id: number
  manuscript_id: number
  title: string
  abstract: string
  article_type: string
  publication_date: string
  journal_name: string
  keywords: string[]
  views: number
  downloads: number
  citations: number
}

export type PublicResearcher = {
  researcher_key: string
  slug: string
  name: string
  profile_label: string
  institution: string
  country?: string | null
  orcid_id?: string | null
  avatar_path?: string | null
  primary_field: string
  expertise_tags: string[]
  publication_count: number
  views: number
  downloads: number
  citations: number
  h_index: number
  latest_publication_date: string
  publications: PublicResearcherPublication[]
}

export type VerificationMeta = {
  sent_at?: string | null
  expires_at?: string | null
  verified?: boolean
  email_sent?: boolean
  email_error?: string | null
}

export type PasswordResetRequest = {
  email: string
}

export type PasswordResetPayload = {
  email: string
  token: string
  password: string
}

export type ManuscriptSimilarityMatch = {
  manuscript_id?: number
  id?: string
  title: string
  status?: string
  score: number
  url?: string
  view_url?: string
  matched_words?: number
}

export type ManuscriptSimilarityResult = {
  provider?: string
  status: string
  draft_token?: string | null
  message: string
  score?: number | null
  require_completion?: boolean
  word_count?: number
  match_count?: number
  top_matches: ManuscriptSimilarityMatch[]
}

export type AdminIntegrationsSettings = {
  provider: string
  enabled: boolean
  api_email: string
  api_key: string
  sandbox: boolean
  require_completion: boolean
  configured: boolean
  api_key_configured?: boolean
  webhook_secret?: string
  webhook_url_template: string
  new_results_webhook_url: string
}

export async function registerAccount(payload: Record<string, unknown>) {
  const { data } = await journalApi.post("/auth/create-account.php", payload)
  return data as { message: string; user: AuthUser; verification?: VerificationMeta }
}

export async function loginAccount(payload: { email: string; password: string }) {
  const { data } = await journalApi.post("/auth/login.php", payload)
  return data as { message: string; user: AuthUser; verification?: VerificationMeta }
}

export async function resendVerificationEmail(payload: { email: string }) {
  const { data } = await journalApi.post("/auth/resend_verification.php", payload)
  return data as { message: string; verification?: VerificationMeta }
}

export async function requestPasswordReset(payload: PasswordResetRequest) {
  const { data } = await journalApi.post("/auth/request_password_reset.php", payload)
  return data as { message: string }
}

export async function resetPassword(payload: PasswordResetPayload) {
  const { data } = await journalApi.post("/auth/reset_password.php", payload)
  return data as { message: string }
}

export async function logoutAccount() {
  const { data } = await journalApi.post("/auth/logout.php")
  return data as { message: string }
}

export async function getSession() {
  const { data } = await journalApi.get("/auth/me.php")
  return data as { authenticated: boolean; user?: AuthUser; dashboards?: DashboardPayload }
}

export async function getDashboards() {
  const { data } = await journalApi.get("/dashboard/index.php")
  return data as { user: AuthUser; dashboards: DashboardPayload }
}

export async function getPublicSettings() {
  const { data } = await journalApi.get("/settings.php")
  if (!isRecord(data) || !isRecord(data.settings)) {
    throw new Error("Public settings response was malformed.")
  }
  return data as { settings: JournalSettings }
}

export async function getFeaturedArticles(options?: { limit?: number }) {
  const params = options?.limit ? { limit: options.limit } : undefined
  const { data } = await journalApi.get("/public/articles.php", { params })
  return data as { articles: FeaturedArticle[] }
}

export async function getPublicArticle(articleId: number) {
  const { data } = await journalApi.get("/public/article.php", { params: { article_id: articleId } })
  return data as { article: PublicArticleDetail }
}

export async function getPublicResearchers() {
  const { data } = await journalApi.get("/public/researchers.php")
  return data as { researchers: PublicResearcher[] }
}

export async function getAdminSettings() {
  const { data } = await journalApi.get("/admin/settings.php")
  return data as { user: AuthUser; settings: Record<string, string> }
}

export type ReviewerOnboardingApplication = {
  reviewer_id: number
  user_id: number
  name: string
  email: string
  country?: string | null
  institution?: string | null
  department?: string | null
  position?: string | null
  cv_file?: string | null
  publication_list_file?: string | null
  application_completed: boolean
  status: "pending" | "approved" | "rejected" | string
  date_registered?: string | null
  reviewed_at?: string | null
  reviewed_by?: number | null
  reviewed_by_name?: string | null
  rejection_reason?: string | null
  acceptance_notes?: string | null
}

export type EditorOnboardingApplication = {
  editor_id: number
  user_id: number
  name: string
  email: string
  country?: string | null
  institution?: string | null
  department?: string | null
  position?: string | null
  editor_role?: string | null
  cv_file?: string | null
  publication_list_file?: string | null
  application_completed: boolean
  status: "pending" | "approved" | "rejected" | string
  date_registered?: string | null
  reviewed_at?: string | null
  reviewed_by?: number | null
  reviewed_by_name?: string | null
  rejection_reason?: string | null
  acceptance_notes?: string | null
}

export async function getReviewerOnboardingApplications(params?: { status?: string; limit?: number; offset?: number; completed_only?: boolean }) {
  const { data } = await journalApi.get("/admin/reviewer-onboarding-applications.php", {
    params: {
      status: params?.status ?? "pending",
      limit: params?.limit ?? 50,
      offset: params?.offset ?? 0,
      completed_only: params?.completed_only ?? true,
    },
  })
  return data as { applications: ReviewerOnboardingApplication[]; pagination: { total: number; limit: number; offset: number; page: number; pages: number } }
}

export async function approveReviewerOnboarding(payload: { reviewer_id: number; notes?: string }) {
  const { data } = await journalApi.post("/admin/reviewer-onboarding-accept.php", payload)
  return data as { message: string; reviewer_id: number }
}

export async function rejectReviewerOnboarding(payload: { reviewer_id: number; reason: string }) {
  const { data } = await journalApi.post("/admin/reviewer-onboarding-reject.php", payload)
  return data as { message: string; reviewer_id: number }
}

export async function getEditorOnboardingApplications(params?: { status?: string; limit?: number; offset?: number; completed_only?: boolean }) {
  const { data } = await journalApi.get("/admin/editor-onboarding-applications.php", {
    params: {
      status: params?.status ?? "pending",
      limit: params?.limit ?? 50,
      offset: params?.offset ?? 0,
      completed_only: params?.completed_only ?? true,
    },
  })
  return data as { applications: EditorOnboardingApplication[]; pagination: { total: number; limit: number; offset: number; page: number; pages: number } }
}

export async function approveEditorOnboarding(payload: { editor_id: number; notes?: string }) {
  const { data } = await journalApi.post("/admin/editor-onboarding-accept.php", payload)
  return data as { message: string; editor_id: number }
}

export async function rejectEditorOnboarding(payload: { editor_id: number; reason: string }) {
  const { data } = await journalApi.post("/admin/editor-onboarding-reject.php", payload)
  return data as { message: string; editor_id: number }
}

export async function updateAdminSettings(payload: {
  journal_name: string
  journal_acronym: string
  homepage_tagline: string
  homepage_intro: string
  home_topbar_text: string
  featured_articles_title: string
  featured_articles_description: string
  research_pathways_title: string
  call_for_papers_title: string
  call_for_papers_description: string
  call_for_papers_cta_title: string
  call_for_papers_cta_body: string
  call_for_papers_notes: string[]
  trending_research_title: string
  trending_research_description: string
  publishing_overview_title: string
  publishing_overview_description: string
  workflow_snapshot_title: string
  workflow_snapshot_description: string
  discover_open_access_title: string
  discover_open_access_body: string
  discover_open_access_points: string[]
  publish_with_us_title: string
  publish_with_us_body: string
  publish_with_us_points: string[]
  track_research_title: string
  track_research_body: string
  call_for_papers: Array<{ title: string; deadline: string; summary: string }>
  trending_research: Array<{ title: string; area: string; summary: string }>
  aims: string[]
  scope: string[]
  objectives: string[]
  review_specializations: string[]
  footer_summary: string
  footer_bottom_text: string
  footer_bottom_tagline: string
  whatsapp_number: string
  default_gq_percent: string
  default_ai_score_percent: string
  default_similarity_percent: string
  submission_fee_ngn: string
  publication_fee_ngn: string
} | FormData, options?: UploadOptions) {
  const isFormData = payload instanceof FormData
  const { data } = await journalApi.post("/admin/settings.php", payload, isFormData ? {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event: AxiosProgressEvent) => {
      if (!event.total) return
      options?.onProgress?.(Math.round((event.loaded / event.total) * 100))
    },
  } : undefined)
  return data as { message: string; settings: Record<string, string> }
}

type UploadOptions = {
  onProgress?: (progress: number) => void
}

export async function uploadJournalLogo(file: File, options?: UploadOptions) {
  const formData = new FormData()
  formData.append("logo", file)
  const { data } = await journalApi.post("/admin/upload_logo.php", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event: AxiosProgressEvent) => {
      if (!event.total) return
      options?.onProgress?.(Math.round((event.loaded / event.total) * 100))
    },
  })
  return data as { message: string; logo_path: string; settings: Record<string, string> }
}

export async function getWorkspace() {
  const { data } = await journalApi.get("/workspace.php")
  return data as WorkspacePayload
}

export async function updateProfile(payload: Record<string, unknown>, options?: UploadOptions) {
  const isFormData = payload instanceof FormData
  const { data } = await journalApi.post("/user/profile.php", payload, isFormData ? {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event: AxiosProgressEvent) => {
      if (!event.total) return
      options?.onProgress?.(Math.round((event.loaded / event.total) * 100))
    },
  } : undefined)
  return data as { message: string; user: AuthUser }
}

export async function sendMessage(payload: Record<string, unknown>) {
  const { data } = await journalApi.post("/messages.php", payload)
  return data as { message: string; message_id: number; email_sent?: boolean; email_message?: string }
}

export async function submitManuscript(payload: Record<string, unknown>, options?: UploadOptions) {
  const isFormData = payload instanceof FormData
  const { data } = await journalApi.post("/author/manuscripts.php", payload, isFormData ? {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event: AxiosProgressEvent) => {
      if (!event.total) return
      options?.onProgress?.(Math.round((event.loaded / event.total) * 100))
    },
  } : undefined)
  return data as {
    message: string
    manuscript_id: number
    reference_number: string
    email_sent: boolean
    email_message: string
    submitted_at: string
  }
}

export async function analyzeManuscriptPlagiarism(file: File) {
  const formData = new FormData()
  formData.append("manuscript_file", file)
  const { data } = await journalApi.post("/author/check_plagiarism.php", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return data as ManuscriptSimilarityResult
}

export async function getManuscriptPlagiarismStatus(draftToken: string) {
  const { data } = await journalApi.get("/author/plagiarism_status.php", { params: { draft_token: draftToken } })
  return data as ManuscriptSimilarityResult
}

export async function updateManuscriptPlagiarismScore(payload: { manuscript_id: number; plagiarism_score: number | null }) {
  const { data } = await journalApi.post("/manuscripts/plagiarism_score.php", payload)
  return data as { message: string; manuscript: { manuscript_id: number; title: string; plagiarism_score: number | null } }
}

export async function submitRevision(payload: Record<string, unknown>, options?: UploadOptions) {
  const isFormData = payload instanceof FormData
  const { data } = await journalApi.post("/author/revisions.php", payload, isFormData ? {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event: AxiosProgressEvent) => {
      if (!event.total) return
      options?.onProgress?.(Math.round((event.loaded / event.total) * 100))
    },
  } : undefined)
  return data as { message: string }
}

export async function submitPayment(payload: Record<string, unknown>, options?: UploadOptions) {
  const isFormData = payload instanceof FormData
  const { data } = await journalApi.post("/author/payments.php", payload, isFormData ? {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event: AxiosProgressEvent) => {
      if (!event.total) return
      options?.onProgress?.(Math.round((event.loaded / event.total) * 100))
    },
  } : undefined)
  return data as { message: string }
}

export async function initializePaystackPayment(payload: { manuscript_id: number; amount: number; total_pages: number }) {
  const { data } = await journalApi.post("/author/paystack_initialize.php", payload)
  return data as { message: string; reference: string; authorization_url: string; access_code: string }
}

export async function verifyPaystackPayment(payload: { reference: string }) {
  const { data } = await journalApi.post("/author/paystack_verify.php", payload)
  return data as { message: string; payment_id: number; reference: string; manuscript_id: number }
}

export async function reviewPaymentReceipt(payload: { payment_id: number; action?: "review" | "reject" }) {
  const { data } = await journalApi.post("/eic/payments.php", payload)
  return data as { message: string }
}

export async function submitCopyrightForm(payload: Record<string, unknown>, options?: UploadOptions) {
  const isFormData = payload instanceof FormData
  const { data } = await journalApi.post("/author/copyright.php", payload, isFormData ? {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event: AxiosProgressEvent) => {
      if (!event.total) return
      options?.onProgress?.(Math.round((event.loaded / event.total) * 100))
    },
  } : undefined)
  return data as { message: string }
}

export async function updateReviewerProfile(payload: Record<string, unknown>, options?: UploadOptions) {
  const isFormData = payload instanceof FormData
  const { data } = await journalApi.post("/reviewer/profile.php", payload, isFormData ? {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event: AxiosProgressEvent) => {
      if (!event.total) return
      options?.onProgress?.(Math.round((event.loaded / event.total) * 100))
    },
  } : undefined)
  return data as { message: string; completed?: boolean }
}

export async function updateEditorProfile(payload: Record<string, unknown>, options?: UploadOptions) {
  const isFormData = payload instanceof FormData
  const { data } = await journalApi.post("/editor/profile.php", payload, isFormData ? {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event: AxiosProgressEvent) => {
      if (!event.total) return
      options?.onProgress?.(Math.round((event.loaded / event.total) * 100))
    },
  } : undefined)
  return data as { message: string; completed?: boolean }
}

export async function respondToInvitation(payload: Record<string, unknown>) {
  const { data } = await journalApi.post("/reviewer/invitations.php", payload)
  return data as { message: string }
}

export async function submitReview(payload: Record<string, unknown>) {
  const isFormData = payload instanceof FormData
  const { data } = await journalApi.post("/reviewer/reviews.php", payload, isFormData ? {
    headers: { "Content-Type": "multipart/form-data" },
  } : undefined)
  return data as { message: string; review_id: number }
}

export async function claimAssignment(payload: Record<string, unknown>) {
  const { data } = await journalApi.post("/editor/assignments.php", payload)
  return data as { message: string }
}

export async function inviteReviewer(payload: Record<string, unknown>) {
  const { data } = await journalApi.post("/editor/reviewer_invitations.php", payload)
  return data as { message: string; invitation_id: number }
}

export async function recordEditorDecision(payload: Record<string, unknown>) {
  const { data } = await journalApi.post("/editor/decisions.php", payload)
  return data as { message: string; decision_id: number }
}

export async function submitTechnicalScreening(payload: Record<string, unknown>, options?: UploadOptions) {
  const isFormData = payload instanceof FormData
  const { data } = await journalApi.post("/editor/technical_screening.php", payload, isFormData ? {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event: AxiosProgressEvent) => {
      if (!event.total) return
      options?.onProgress?.(Math.round((event.loaded / event.total) * 100))
    },
  } : undefined)
  return data as { message: string }
}

export async function uploadProductionPdf(payload: FormData, options?: UploadOptions) {
  const { data } = await journalApi.post("/editor/production_pdf.php", payload, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event: AxiosProgressEvent) => {
      if (!event.total) return
      options?.onProgress?.(Math.round((event.loaded / event.total) * 100))
    },
  })
  return data as { message: string; file_path: string }
}

export async function decideTechnicalScreening(payload: { manuscript_id: number; decision: "approved" | "rejected"; reason?: string }) {
  const { data } = await journalApi.post("/editor/technical_screening.php", { action: "editor_decision", ...payload })
  return data as { message: string }
}

export async function recordFinalDecision(payload: Record<string, unknown>) {
  const { data } = await journalApi.post("/eic/final_decisions.php", payload)
  return data as { message: string; email_sent?: boolean; email_message?: string }
}

export async function sendPaymentReminder(payload: { manuscript_id: number }) {
  const { data } = await journalApi.post("/eic/payment_reminder.php", payload)
  return data as { message: string }
}

export async function publishManuscript(payload: { manuscript_id: number; page_numbers: string }) {
  const { data } = await journalApi.post("/eic/publish.php", payload)
  return data as { message: string; manuscript_id: number; article_id: number }
}

export async function archivePublication(payload: { manuscript_id?: number; article_id?: number }) {
  const { data } = await journalApi.post("/eic/archive_publication.php", payload)
  return data as { message: string; manuscript_id: number; article_id: number }
}

export async function deletePublication(payload: { manuscript_id?: number; article_id?: number }) {
  const { data } = await journalApi.post("/eic/delete_publication.php", payload)
  return data as { message: string; manuscript_id: number; article_id: number }
}

export async function updatePublication(payload: {
  manuscript_id?: number
  article_id?: number
  title: string
  reference_number: string
  publication_date: string
}) {
  const { data } = await journalApi.post("/eic/update_publication.php", payload)
  return data as { message: string; manuscript_id: number; article_id: number }
}

export async function manageIssues(payload: Record<string, unknown>) {
  const { data } = await journalApi.post("/eic/issues.php", payload)
  return data as { message: string; issues: Array<Record<string, unknown>> }
}

export async function updateUserAccess(payload: Record<string, unknown>) {
  const { data } = await journalApi.post("/admin/users.php", payload)
  return data as { message: string; users: Array<Record<string, unknown>> }
}

export async function createAdminUser(payload: Record<string, unknown>) {
  const { data } = await journalApi.post("/admin/users.php", { action: "create", ...payload })
  return data as { message: string; users: Array<Record<string, unknown>> }
}

export async function editAdminUser(payload: Record<string, unknown>) {
  const { data } = await journalApi.post("/admin/users.php", { action: "edit", ...payload })
  return data as { message: string; users: Array<Record<string, unknown>> }
}

export async function deleteAdminUser(userId: number) {
  const { data } = await journalApi.post("/admin/users.php", { action: "delete", user_id: userId })
  return data as { message: string; users: Array<Record<string, unknown>> }
}

export async function getAdminIntegrations() {
  const { data } = await journalApi.get("/admin/integrations.php")
  return data as { settings: AdminIntegrationsSettings; recent_scans: Array<Record<string, unknown>> }
}

export async function updateAdminIntegrations(payload: {
  plagiarism_enabled: boolean
  plagiarism_api_email: string
  plagiarism_api_key: string
  plagiarism_sandbox: boolean
  plagiarism_require_completion: boolean
}) {
  const { data } = await journalApi.post("/admin/integrations.php", payload)
  return data as { message: string; settings: AdminIntegrationsSettings; recent_scans: Array<Record<string, unknown>> }
}

// Editor Functions
export type EditorType = {
  editor_type_id: number
  type_name: string
  title: string
  description: string
  capabilities: {
    can_assign_reviewers: boolean
    can_make_decisions: boolean
    can_appoint_editors: boolean
  }
}

export type EditorProfile = {
  editor_profile_id: number
  user_id: number
  editor_type_id: number
  type_name: string
  description: string
  subject_areas: string | null
  bio: string | null
  expertise_description: string | null
  appointment_date: string | null
  status: "active" | "inactive" | "on_leave"
  assigned_manuscripts_limit: number
  current_assigned_count: number
}

export type EditorDashboardData = {
  user: AuthUser
  editor_profile: EditorProfile
  stats: Record<string, number>
  access: Record<string, boolean>
}

export async function getEditorTypes() {
  const { data } = await journalApi.get("/editor/editor-types.php")
  return data as { editor_types: EditorType[]; total: number }
}

export async function getEditorDashboard() {
  const { data } = await journalApi.get("/editor/dashboard.php")
  return data as EditorDashboardData
}

export async function registerEditor(payload: {
  first_name: string
  last_name: string
  email: string
  password: string
  confirm_password?: string
  institution: string
  country: string
  phone: string
  orcid_id: string
  editor_type: string
  subject_areas: string
  expertise_description: string
  bio: string
}) {
  const { data } = await journalApi.post("/auth/create-account.php", payload)
  return data as {
    message: string
    user_id: number
    editor_type: string
    dashboard_url: string
    verification?: VerificationMeta
  }
}


// Campaign CMS (Romeo landing page)
export type CampaignSite = {
  site_id: number
  site_title: string
  meta_description: string
  constituency: string
  state: string
  country: string
  address_line: string
  media_team: string
  notice_text: string
  newsletter_title: string
  newsletter_text: string
  copyright_text: string
}

export type CampaignSocialLink = {
  social_id: number
  platform: string
  url: string
  display_order: number
  is_active: number
}

export type CampaignNavLink = {
  nav_id: number
  label: string
  anchor: string
  display_order: number
  is_active: number
}

export type CampaignHeroSlide = {
  slide_id: number
  headline: string
  subheadline: string
  body: string
  cta_label: string
  cta_anchor: string
  background_media_id: number | null
  display_order: number
  is_active: number
}

export type CampaignPriority = {
  priority_id: number
  title: string
  body: string
  link_anchor: string
  display_order: number
  is_active: number
}

export type CampaignMessage = {
  message_id: number
  title: string
  body: string
  signature: string
  portrait_media_id: number | null
}

export type CampaignPressRelease = {
  press_id: number
  title: string
  date_published: string
  body: string
  media_id: number | null
  display_order: number
  is_active: number
}

export type CampaignStatement = {
  statement_id: number
  title: string
  body: string
  media_id: number | null
  display_order: number
  is_active: number
}

export type CampaignGetInvolved = {
  involved_id: number
  eyebrow: string
  title: string
  body: string
  image_media_id: number | null
}

export type CampaignGetInvolvedPoint = {
  point_id: number
  involved_id: number
  point_text: string
  display_order: number
}

export type CampaignMission = {
  mission_id: number
  title: string
  subtitle: string
}

export type CampaignMissionItem = {
  item_id: number
  mission_id: number
  title: string
  body: string
  media_id: number | null
  display_order: number
}

export type CampaignEngagement = {
  engagement_id: number
  title: string
  location: string
  date_label: string
  time_label: string
  media_id: number | null
  display_order: number
  is_active: number
}

export type CampaignUpdate = {
  update_id: number
  badge_top: string
  badge_bottom: string
  title: string
  excerpt: string
  link_anchor: string
  media_id: number | null
  display_order: number
  is_active: number
}

export type CampaignMediaMeta = {
  media_id: number
  media_type: 'image' | 'file'
  filename: string
  original_name: string
  mime_type: string
  byte_size: number
  alt_text: string | null
  created_at: string
}

export type CampaignPublicPayload = {
  site: CampaignSite | null
  social_links: CampaignSocialLink[]
  nav_links: CampaignNavLink[]
  hero_slides: CampaignHeroSlide[]
  priorities: CampaignPriority[]
  message: CampaignMessage | null
  press_releases: CampaignPressRelease[]
  statements: CampaignStatement[]
  get_involved: CampaignGetInvolved | null
  get_involved_points: CampaignGetInvolvedPoint[]
  mission: CampaignMission | null
  mission_items: CampaignMissionItem[]
  engagements: CampaignEngagement[]
  updates: CampaignUpdate[]
}

export type CampaignAdminPayload = CampaignPublicPayload & {
  media: CampaignMediaMeta[]
}

export function buildCampaignMediaUrl(mediaId: number) {
  const url = new URL('public/campaign-media.php', apiBaseUrl.href)
  url.searchParams.set('id', String(mediaId))
  return url.toString()
}

export async function getCampaignPublic() {
  const { data } = await journalApi.get('/public/campaign.php')
  return data as CampaignPublicPayload
}

export async function getCampaignAdmin() {
  const { data } = await journalApi.get('/admin/campaign.php')
  return data as CampaignAdminPayload
}

export async function saveCampaignAdmin(payload: Record<string, unknown>) {
  const { data } = await journalApi.post('/admin/campaign.php', payload)
  return data as { message: string }
}

export async function uploadCampaignMedia(payload: FormData, options?: UploadOptions) {
  const { data } = await journalApi.post('/admin/campaign_media.php', payload, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event: AxiosProgressEvent) => {
      if (!event.total) return
      options?.onProgress?.(Math.round((event.loaded / event.total) * 100))
    },
  })
  return data as { message: string; media: CampaignMediaMeta }
}
