import * as React from "react"
import { isAxiosError } from "axios"
import { BarChart3, BookMarked, BookOpenText, CheckSquare, ChevronDown, FileClock, FileText, Globe2, LayoutDashboard, LogOut, Mail, Microscope, Settings2, ShieldCheck, Upload, User, UserCog, Users, Workflow, X } from "lucide-react"
import { createPortal } from "react-dom"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { workspaceConfigs } from "@/data/dashboardModules"
import { applyJournalBranding, normalizeJournalSettings } from "@/hooks/useJournalSettings"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Toaster } from "@/components/ui/sonner"
import { Textarea } from "@/components/ui/textarea"
import ApplicationsReview from "@/admin/components/ApplicationsReview"
import {
  claimAssignment,
  createAdminUser,
  deleteAdminUser,
  editAdminUser,
  getAdminIntegrations,
  getPublicSettings,
  getWorkspace,
  initializePaystackPayment,
  inviteReviewer,
  logoutAccount,
  manageIssues,
  publishManuscript,
  recordEditorDecision,
  recordFinalDecision,
  reviewPaymentReceipt,
  resendVerificationEmail,
  respondToInvitation,
  resolveApiAssetUrl,
  sendMessage,
  submitManuscript,
  submitPayment,
  submitCopyrightForm,
  submitRevision,
  submitReview,
  type AuthUser,
  type AdminIntegrationsSettings,
  type JournalSettings,
  type WorkspacePayload,
  updateAdminSettings,
  updateAdminIntegrations,
  updateManuscriptPlagiarismScore,
  updateEditorProfile,
  updateProfile,
  updateReviewerProfile,
  updateUserAccess,
  uploadJournalLogo,
  verifyPaystackPayment,
} from "@/lib/journalApi"
import { cn } from "@/lib/utils"

const roleIcons: Record<string, React.ReactNode> = {
  author: <BookOpenText className="h-4 w-4" />,
  reviewer: <Microscope className="h-4 w-4" />,
  editor: <FileClock className="h-4 w-4" />,
  managing_editor: <FileClock className="h-4 w-4" />,
  section_editor: <FileClock className="h-4 w-4" />,
  technical_editor: <FileClock className="h-4 w-4" />,
  advisory_board: <FileClock className="h-4 w-4" />,
  editor_in_chief: <BookMarked className="h-4 w-4" />,
  admin: <UserCog className="h-4 w-4" />,
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
const resolveWorkspaceRole = (role: string) => (editorWorkspaceRoles.has(role) ? "editor" : role)
const hasProfileValue = (value: unknown) => String(value ?? "").trim() !== ""
const roleDefaultSections: Record<string, string> = {
  author: "submission",
  reviewer: "invitations",
  editor: "assignments",
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
const fallbackSettings: JournalSettings = { journal_name: "Journal of Applied Science, Technology, and Innovation", journal_acronym: "JASTI", logo_path: "", homepage_tagline: "Building a rigorous African journal platform for applied research.", homepage_intro: "Home for multidisciplinary research, applied scholarship, editorial quality, and publication visibility across science, technology, and innovation.", home_topbar_text: "Home for all research in applied science, technology, and innovation", featured_articles_title: "Recently published research", featured_articles_description: "Peer-reviewed articles and manuscripts published through the JASTI editorial workflow.", research_pathways_title: "Research publishing pathways", call_for_papers_title: "Submission deadlines and current opportunities", call_for_papers_description: "Calls for papers are published here by the administrator and provide issue opportunities for authors across JASTI thematic areas.", call_for_papers_cta_title: "Login and submit", call_for_papers_cta_body: "Use the JASTI portal to log in, prepare your manuscript, and submit within the relevant deadline window.", call_for_papers_notes: [], trending_research_title: "Current topics across applied scholarship", trending_research_description: "Highlighted research areas help readers, authors, and editors identify emerging themes across applied science, technology, and innovation.", publishing_overview_title: "Editorial quality and practical relevance", publishing_overview_description: "JASTI prioritizes methodological soundness, publication ethics, applied relevance, and multidisciplinary integration across research contexts.", workflow_snapshot_title: "From submission to publication", workflow_snapshot_description: "The journal system is modeled around the full digital publishing sequence from submission to indexing and citation tracking.", discover_open_access_title: "Discover Open Access", discover_open_access_body: "Explore open and accessible research pathways, publication ethics, visibility strategies, and the role of open scholarship in applied knowledge exchange.", discover_open_access_image: "/images/discover-open-access.jpg", discover_open_access_points: [], publish_with_us_title: "Publish with Us", publish_with_us_body: "Learn how JASTI supports authors through submission, peer review, revision, production planning, and publication-ready editorial workflows.", publish_with_us_image: "/images/publish-with-us.jpg", publish_with_us_points: [], track_research_title: "Track Your Research", track_research_body: "Monitor submissions, revisions, editorial decisions, downloads, citations, DOI progress, and journal communication through the JASTI portal.", track_research_image: "/images/track-your-research.jpg", call_for_papers: [], trending_research: [], aims: [], scope: [], objectives: [], review_specializations: [], footer_summary: "Home for multidisciplinary research, applied scholarship, editorial quality, and publication visibility across science, technology, and innovation.", footer_bottom_text: "Journal publishing, peer review, and research visibility.", footer_bottom_tagline: "Applied science. Technology. Innovation." }
const asArray = (value: unknown) => Array.isArray(value) ? value as Array<Record<string, unknown>> : []
const asRecord = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
const sectionIconMap: Record<string, React.ReactNode> = {
  profile: <LayoutDashboard className="h-5 w-5" />,
  submission: <FileText className="h-5 w-5" />,
  applications: <FileText className="h-5 w-5" />,
  compliance: <CheckSquare className="h-5 w-5" />,
  tracker: <Workflow className="h-5 w-5" />,
  revision: <Upload className="h-5 w-5" />,
  communication: <Mail className="h-5 w-5" />,
  metrics: <BarChart3 className="h-5 w-5" />,
  invitations: <Users className="h-5 w-5" />,
  assigned: <BookOpenText className="h-5 w-5" />,
  evaluation: <Microscope className="h-5 w-5" />,
  recommendation: <CheckSquare className="h-5 w-5" />,
  comments: <Mail className="h-5 w-5" />,
  deadlines: <Workflow className="h-5 w-5" />,
  assignments: <FileText className="h-5 w-5" />,
  screening: <ShieldCheck className="h-5 w-5" />,
  selection: <Microscope className="h-5 w-5" />,
  monitoring: <BarChart3 className="h-5 w-5" />,
  decisions: <FileClock className="h-5 w-5" />,
  analytics: <BarChart3 className="h-5 w-5" />,
  overview: <BookMarked className="h-5 w-5" />,
  "final-decisions": <FileClock className="h-5 w-5" />,
  board: <Users className="h-5 w-5" />,
  ethics: <ShieldCheck className="h-5 w-5" />,
  impact: <Globe2 className="h-5 w-5" />,
  scheduling: <BookMarked className="h-5 w-5" />,
  "manage-issues": <BookMarked className="h-5 w-5" />,
  users: <Users className="h-5 w-5" />,
  settings: <Settings2 className="h-5 w-5" />,
  integrations: <Settings2 className="h-5 w-5" />,
}
function CardHeading({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return <div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(11,111,164,0.14),rgba(31,107,92,0.18))] text-jostum-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">{icon}</div><div className="space-y-1">{description ? <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{description}</CardDescription> : null}<CardTitle className="font-display text-2xl leading-[1.08] tracking-[-0.03em] sm:text-[2rem]">{title}</CardTitle></div></div>
}
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const manuscriptArticleTypeOptions = ["Case Studies", "Review", "Conference"] as const
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
  onFileSelect: (file: File | null) => void
  onRemove: () => void
}) {
  const [dragging, setDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const handleFile = (selectedFile: File | null) => onFileSelect(selectedFile)
  return <div className="space-y-2">
    <Label>{label}</Label>
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
        {file ? <button type="button" onClick={(event) => { event.stopPropagation(); onRemove() }} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button> : null}
      </div>
    </div>
    {error ? <p className="text-xs text-red-600">{error}</p> : null}
    {typeof progress === "number" && progress > 0 ? <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500"><span>{progressLabel ?? "Upload progress"}</span><span>{progress}%</span></div>
      <div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-jostum-700 transition-all" style={{ width: `${Math.min(progress, 100)}%` }} /></div>
    </div> : null}
  </div>
}
function ProfileMenu({ user, onSaved, onLogout, loggingOut }: { user: AuthUser; onSaved: () => Promise<void>; onLogout: () => Promise<void>; loggingOut: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [avatarError, setAvatarError] = React.useState("")
  const [avatarUploadProgress, setAvatarUploadProgress] = React.useState(0)
  const menuRef = React.useRef<HTMLDivElement | null>(null)
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null)
  const [form, setForm] = React.useState({ first_name: user.first_name, last_name: user.last_name, orcid_id: user.orcid_id ?? "", institution: user.institution ?? "", country: user.country ?? "", phone: user.phone ?? "", password: "", confirm_password: "" })
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
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} />
              </div>
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
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((prev) => !prev)} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 py-1 pl-1 pr-1.5 text-left shadow-sm transition hover:border-jostum-300 sm:gap-3 sm:px-2 sm:py-2">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-jostum-700 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(15,23,42,0.12)] sm:h-11 sm:w-11">{avatarSrc ? <img src={avatarSrc} alt={`${user.first_name} ${user.last_name}`} className="h-full w-full object-cover" /> : initials}</div>
        <div className="hidden sm:block">
          <p className="text-sm font-semibold text-slate-900">{user.first_name} {user.last_name}</p>
          <p className="text-xs text-slate-500">{roleLabels[user.roles[0] ?? ""] ?? "User"}</p>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-slate-500 sm:h-4 sm:w-4" />
      </button>
      {open ? <div className="absolute right-0 top-full z-[140] mt-3 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"><div className="rounded-2xl bg-slate-50 px-4 py-3"><p className="font-semibold text-slate-900">{user.first_name} {user.last_name}</p><p className="text-sm text-slate-500">{user.email}</p></div><button type="button" onClick={() => { setEditing(true); setOpen(false) }} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-jostum-50 hover:text-jostum-700"><User className="h-4 w-4" />Edit profile</button><button type="button" onClick={() => { setOpen(false); void onLogout() }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50">{loggingOut ? <Workflow className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}Logout</button></div> : null}
    </div>
    {editProfileModal}
  </>
}
function errorText(error: unknown, fallback: string) { if (isAxiosError(error)) { const payload = error.response?.data as { message?: string } | undefined; if (payload?.message) return payload.message } return error instanceof Error && error.message ? error.message : fallback }
function extractStorageFileName(path: string) {
  const normalized = path.split("#")[0]?.split("?")[0] ?? path
  const segments = normalized.split("/").filter(Boolean)
  return segments[segments.length - 1] ?? normalized
}
function splitHeaderTitle(title: string) {
  const normalized = title.trim()
  if (normalized === "") return [""]

  const commaBreaks = [...normalized.matchAll(/,\s*/g)].map((match) => (match.index ?? 0) + 1)
  if (commaBreaks.length) {
    const midpoint = normalized.length / 2
    const breakIndex = commaBreaks.reduce((best, current) =>
      Math.abs(current - midpoint) < Math.abs(best - midpoint) ? current : best,
    )
    return [normalized.slice(0, breakIndex).trimEnd(), normalized.slice(breakIndex).trimStart()]
  }

  const words = normalized.split(/\s+/)
  if (words.length < 2) return [normalized]

  const midpoint = Math.ceil(words.length / 2)
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")]
}
function formatFileBundle(value: unknown) {
  const entries = String(value ?? "").split("||").map((entry) => entry.trim()).filter(Boolean)
  if (!entries.length) return ""

  return <div className="space-y-1">
    {entries.map((entry, index) => {
      const separatorIndex = entry.indexOf(":")
      const label = separatorIndex >= 0 ? entry.slice(0, separatorIndex).trim() : `file ${index + 1}`
      const path = separatorIndex >= 0 ? entry.slice(separatorIndex + 1).trim() : entry
      const fileName = extractStorageFileName(path)

      return <p key={`${label}-${index}`} className="text-[12px] leading-5 text-slate-700">
        <span className="font-semibold text-slate-900">{label}:</span>{" "}
        <span className="break-all">{fileName}</span>
      </p>
    })}
  </div>
}
function displayValue(value: unknown, key?: string) {
  if (Array.isArray(value)) return value.length ? `${value.length} items` : "0"
  if (value && typeof value === "object") return `${Object.keys(value as Record<string, unknown>).length} fields`
  const text = String(value ?? "")
  if (key === "file_bundle") return formatFileBundle(text)
  if (key === "reference_number" || key === "manuscript_id") return <span className="whitespace-nowrap">{text}</span>
  if (key === "abstract" && text.length > 100) return `${text.slice(0, 100)}...`
  if (text.length > 160) return `${text.slice(0, 160)}...`
  return text
}
function statValue(value: unknown) { if (Array.isArray(value)) return value.length; if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length; return String(value ?? 0) }
function Table({ rows, columns }: { rows: Array<Record<string, unknown>>; columns?: string[] }) {
  if (!rows.length) {
    return <div className="rounded-[1.4rem] border border-slate-200/80 bg-white/88 p-5 text-sm text-slate-500 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">No records available.</div>
  }

  const baseKeys = columns?.length ? [...columns] : Object.keys(rows[0])
  if (!baseKeys.includes("reference_number") && Object.prototype.hasOwnProperty.call(rows[0], "reference_number")) {
    baseKeys.unshift("reference_number")
  }
  const cols = columns?.length ? baseKeys : baseKeys.slice(0, 6)

  const cellClass = (column: string) => {
    const base = "px-4 py-3 align-top text-[13px] leading-5 text-slate-700"
    if (column === "reference_number" || column === "manuscript_id") return `${base} whitespace-nowrap`
    if (column === "file_bundle") return `${base} min-w-[17rem]`
    if (column === "status" || column === "plagiarism_score") return `${base} whitespace-nowrap`
    return `${base} whitespace-normal`
  }

  return <div className="min-w-0 max-w-full overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/92 shadow-[0_18px_38px_rgba(15,23,42,0.07)] backdrop-blur"><div className="overflow-x-auto"><table className="w-full min-w-[52rem] table-auto text-[13px]"><thead className="bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.95))]"><tr>{cols.map((c)=><th key={c} className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-950">{c.replaceAll("_"," ")}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i} className="border-t border-slate-200/80 align-top odd:bg-white even:bg-slate-50/45">{cols.map((c)=><td key={c} className={cellClass(c)}>{displayValue(r[c], c)}</td>)}</tr>)}</tbody></table></div></div>
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
  const [saving, setSaving] = React.useState(false)
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setSaving(true); try { await updateProfile(form); await onSaved(); toast.success("Profile updated.") } catch (error) { toast.error(errorText(error, "Unable to update profile.")) } finally { setSaving(false) } }
  return <Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<LayoutDashboard className="h-5 w-5" />} title="Profile Management" /></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-2" onSubmit={submit}><div className="space-y-2"><Label>First name</Label><Input value={form.first_name} onChange={(e)=>setForm((p)=>({...p,first_name:e.target.value}))} /></div><div className="space-y-2"><Label>Last name</Label><Input value={form.last_name} onChange={(e)=>setForm((p)=>({...p,last_name:e.target.value}))} /></div><div className="space-y-2"><Label>ORCID</Label><Input value={form.orcid_id} onChange={(e)=>setForm((p)=>({...p,orcid_id:e.target.value}))} /></div><div className="space-y-2"><Label>Institution</Label><Input value={form.institution} onChange={(e)=>setForm((p)=>({...p,institution:e.target.value}))} /></div><div className="space-y-2"><Label>Country</Label><Input value={form.country} onChange={(e)=>setForm((p)=>({...p,country:e.target.value}))} /></div><div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e)=>setForm((p)=>({...p,phone:e.target.value}))} /></div><div className="md:col-span-2"><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save profile"}</Button></div></form></CardContent></Card>
}
function MessagesCard({ workspace, user, onSaved }: { workspace: WorkspacePayload; user: AuthUser; onSaved: () => Promise<void> }) {
  const users = [...asArray(workspace.admin?.users), ...asArray(workspace.editor_in_chief?.users)].filter((v, i, a) => v.user_id && a.findIndex((e) => e.user_id === v.user_id) === i)
  const reviewerAcceptedManuscripts = asArray(workspace.reviewer?.invitations).filter((entry) => String(entry.response) === "accepted")
  const [form, setForm] = React.useState({ receiver_id: "", manuscript_id: "", subject: "", message_body: "" })
  const [sending, setSending] = React.useState(false)
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setSending(true); try { await sendMessage({ ...form, receiver_id: user.roles.includes("reviewer") ? undefined : Number(form.receiver_id), manuscript_id: form.manuscript_id ? Number(form.manuscript_id) : null }); setForm({ receiver_id: "", manuscript_id: "", subject: "", message_body: "" }); await onSaved(); toast.success(user.roles.includes("reviewer") ? "Message sent to corresponding author." : "Message sent.") } catch (error) { toast.error(errorText(error, "Unable to send message.")) } finally { setSending(false) } }
  return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Mail className="h-5 w-5" />} title="Communication Center" /></CardHeader><CardContent><Table rows={asArray(workspace.messages)} /></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Mail className="h-5 w-5" />} title={user.roles.includes("reviewer") ? "Send Message to Corresponding Author" : "Send Message"} /></CardHeader><CardContent><form className="space-y-4" onSubmit={submit}>{user.roles.includes("reviewer") ? <div className="space-y-2"><Label>Assigned manuscript</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.manuscript_id} onChange={(e)=>setForm((p)=>({...p,manuscript_id:e.target.value}))}><option value="">Select manuscript</option>{reviewerAcceptedManuscripts.map((entry)=><option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>{String(entry.title ?? entry.manuscript_id)}</option>)}</select><p className="text-xs text-slate-500">The corresponding author will receive your message without exposing author details on your screen.</p></div> : <div className="space-y-2"><Label>Receiver</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.receiver_id} onChange={(e)=>setForm((p)=>({...p,receiver_id:e.target.value}))}><option value="">Select user</option>{users.filter((entry)=>Number(entry.user_id)!==user.user_id).map((entry)=><option key={String(entry.user_id)} value={String(entry.user_id)}>{String(entry.first_name ?? "")} {String(entry.last_name ?? "")} ({String(entry.email ?? "")})</option>)}</select></div>}{!user.roles.includes("reviewer") ? <div className="space-y-2"><Label>Manuscript ID</Label><Input value={form.manuscript_id} onChange={(e)=>setForm((p)=>({...p,manuscript_id:e.target.value}))} /></div> : null}<div className="space-y-2"><Label>Subject</Label><Input value={form.subject} onChange={(e)=>setForm((p)=>({...p,subject:e.target.value}))} /></div><div className="space-y-2"><Label>Message</Label><Textarea rows={6} value={form.message_body} onChange={(e)=>setForm((p)=>({...p,message_body:e.target.value}))} /></div><Button type="submit" disabled={sending}>{sending ? "Sending..." : "Send message"}</Button></form></CardContent></Card></div>
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
function AuthorPanels({ section, workspace, onSaved }: { section: string; workspace: WorkspacePayload; onSaved: () => Promise<void> }) {
  const manuscripts = asArray(workspace.author?.manuscripts)
  const revisionEligibleManuscripts = manuscripts.filter((entry) => String(entry.status ?? "") === "revision_required")
  const revisions = asArray(workspace.author?.revisions)
  const payments = asArray(workspace.author?.payments)
  const copyrightForms = asArray(workspace.author?.copyright_forms)
  const payableManuscripts = manuscripts.filter((entry) => ["accepted", "production", "published"].includes(String(entry.status ?? "")))
  const confirmedPayments = payments.filter((entry) => String(entry.payment_status ?? "") === "confirmed")
  const receiptEligiblePayments = payments.filter((entry) => String(entry.payment_status ?? "") === "confirmed" && String(entry.proof_file_path ?? "").trim() === "")
  const [submission, setSubmission] = React.useState({ title: "", abstract: "", keywords: "", article_type: "", plagiarism_score: "", manuscript_file: null as File | null, supplementary_file: null as File | null })
  const [revision, setRevision] = React.useState({ manuscript_id: "", response_document: "", revised_file: null as File | null })
  const [paymentForm, setPaymentForm] = React.useState({ manuscript_id: "", amount: "", payment_reference: "", payment_details: "", proof_file: null as File | null })
  const [copyrightForm, setCopyrightForm] = React.useState({ manuscript_id: "", signed_file: null as File | null, notes: "" })
  const [onlinePayment, setOnlinePayment] = React.useState({ manuscript_id: "", amount: "" })
  const [uploadErrors, setUploadErrors] = React.useState({ manuscript_file: "", supplementary_file: "", revised_file: "", payment_proof: "", signed_file: "" })
  const [uploadProgress, setUploadProgress] = React.useState({ manuscript_file: 0, revised_file: 0, payment_proof: 0, signed_file: 0 })
  const [saving, setSaving] = React.useState(false)
  const [payingOnline, setPayingOnline] = React.useState(false)
  const [verifyingPayment, setVerifyingPayment] = React.useState(false)
  const [manuscriptSearch, setManuscriptSearch] = React.useState("")
  const normalize = (value: unknown) => String(value ?? "").toLowerCase()
  const filteredManuscripts = manuscriptSearch.trim() === ""
    ? manuscripts
    : manuscripts.filter((entry) => {
        const q = manuscriptSearch.toLowerCase()
        return normalize(entry.reference_number).includes(q)
          || normalize(entry.manuscript_id).includes(q)
          || normalize(entry.title).includes(q)
          || normalize(entry.article_type).includes(q)
      })

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
      return
    }
    const error = validateUploadFile(file, ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/x-tex", "application/x-tex", "text/plain"], "Main manuscript")
    if (error) {
      setSubmission((prev) => ({ ...prev, plagiarism_score: "", manuscript_file: null }))
      setUploadErrors((prev) => ({ ...prev, manuscript_file: error }))
      return
    }
    setSubmission((prev) => ({ ...prev, manuscript_file: file, plagiarism_score: "" }))
    setUploadErrors((prev) => ({ ...prev, manuscript_file: "" }))
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
  if (section === "submission") return <div className="grid gap-5">
    <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
      <CardHeader className="pb-4">
        <CardHeading icon={<FileText className="h-5 w-5" />} title="New Manuscript Submission" description="Upload a clean manuscript package for editorial review." />
      </CardHeader>
      <CardContent className="space-y-5">
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!submission.manuscript_file) {
              setUploadErrors((prev) => ({ ...prev, manuscript_file: "Upload the main manuscript file before submitting." }))
              return
            }

            setSaving(true)
            setUploadProgress((prev) => ({ ...prev, manuscript_file: 0 }))
            try {
              const payload = new FormData()
              payload.append("title", submission.title)
              payload.append("abstract", submission.abstract)
              payload.append("keywords", submission.keywords)
              payload.append("article_type", submission.article_type)
              payload.append("manuscript_file", submission.manuscript_file)
              if (submission.supplementary_file) payload.append("supplementary_file", submission.supplementary_file)

              const response = await submitManuscript(payload as unknown as Record<string, unknown>, {
                onProgress: (progress) => setUploadProgress((prev) => ({ ...prev, manuscript_file: progress })),
              })

              setSubmission({ title: "", abstract: "", keywords: "", article_type: "", plagiarism_score: "", manuscript_file: null, supplementary_file: null })
              setUploadErrors({ manuscript_file: "", supplementary_file: "", revised_file: "", payment_proof: "", signed_file: "" })
              await onSaved()
              scrollToDashboardStats()
              toast.success(response.message || "Manuscript submitted.")
            } catch (error) {
              toast.error(errorText(error, "Unable to submit manuscript."))
            } finally {
              setSaving(false)
              setTimeout(() => setUploadProgress((prev) => ({ ...prev, manuscript_file: 0 })), 500)
            }
          }}
        >
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(280px,0.82fr)]">
            <div className="space-y-2 xl:col-span-2">
              <Label>Title</Label>
              <Input value={submission.title} onChange={(e) => setSubmission((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="order-2 space-y-4 xl:order-3">
              <div className="space-y-2">
                <Label>Article type</Label>
                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={submission.article_type} onChange={(e) => setSubmission((p) => ({ ...p, article_type: e.target.value }))}>
                  <option value="">Select article type</option>
                  {manuscriptArticleTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Keywords</Label>
                <Input value={submission.keywords} onChange={(e) => setSubmission((p) => ({ ...p, keywords: e.target.value }))} />
              </div>
            </div>
            <div className="order-3 space-y-2 xl:order-2">
              <Label>Abstract</Label>
              <Textarea rows={8} value={submission.abstract} onChange={(e) => setSubmission((p) => ({ ...p, abstract: e.target.value }))} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <FileDropzone
              label="Main manuscript"
              accept=".pdf,.doc,.docx,.tex,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/x-tex,application/x-tex"
              helperText="Accepted: PDF, DOC, DOCX, TEX. Maximum 10MB."
              file={submission.manuscript_file}
              error={uploadErrors.manuscript_file}
              progress={uploadProgress.manuscript_file}
              progressLabel="Uploading manuscript"
              onFileSelect={handleManuscriptSelect}
              onRemove={() => {
                setSubmission((prev) => ({ ...prev, plagiarism_score: "", manuscript_file: null }))
                setUploadErrors((prev) => ({ ...prev, manuscript_file: "" }))
                setUploadProgress((prev) => ({ ...prev, manuscript_file: 0 }))
              }}
            />
            <FileDropzone
              label="Supplementary file"
              accept=".pdf,.doc,.docx,.zip,.csv,.xlsx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,application/x-zip-compressed,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png"
              helperText="PDF, DOC, DOCX, ZIP, CSV, XLSX, JPG, PNG. Max 10MB."
              file={submission.supplementary_file}
              error={uploadErrors.supplementary_file}
              onFileSelect={(file) => assignUpload("supplementary_file", file, ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/x-zip-compressed", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/jpeg", "image/png"], "Supplementary file", (value) => setSubmission((p) => ({ ...p, supplementary_file: value })))}
              onRemove={() => assignUpload("supplementary_file", null, [], "Supplementary file", (value) => setSubmission((p) => ({ ...p, supplementary_file: value })))}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-slate-500">After submission, the page slides back to the overview cards so you can immediately review the updated manuscript counts.</p>
            <Button type="submit" disabled={saving} className="sm:min-w-[170px]">
              {saving ? "Submitting..." : "Submit manuscript"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
    <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
      <CardHeader className="pb-4 sm:flex-row sm:items-end sm:justify-between">
        <CardHeading icon={<BookOpenText className="h-5 w-5" />} title="Submitted Manuscripts" description="Search and review your recent submissions without leaving the author workspace." />
        <Input className="w-full sm:max-w-xs" placeholder="Search ref # or title" value={manuscriptSearch} onChange={(e)=>setManuscriptSearch(e.target.value)} />
      </CardHeader>
      <CardContent className="space-y-4">
        <Table rows={filteredManuscripts} columns={["reference_number", "title", "status", "article_type", "plagiarism_score", "file_bundle"]} />
      </CardContent>
    </Card>
  </div>
  if (section === "revision") return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Upload className="h-5 w-5" />} title="Revision Module" description="Manage revised versions and response documents only for manuscripts currently returned for revision." /></CardHeader><CardContent><form className="space-y-4" onSubmit={async (e)=>{e.preventDefault(); if (!revision.manuscript_id) { toast.error("Select a manuscript that is currently in revision."); return } if (!revision.revised_file) { setUploadErrors((prev) => ({ ...prev, revised_file: "Upload the revised manuscript before submitting the revision." })); return } setSaving(true); setUploadProgress((prev) => ({ ...prev, revised_file: 0 })); try { const payload = new FormData(); payload.append("manuscript_id", revision.manuscript_id); payload.append("response_document", revision.response_document); payload.append("revised_file", revision.revised_file); await submitRevision(payload as unknown as Record<string, unknown>, { onProgress: (progress) => setUploadProgress((prev) => ({ ...prev, revised_file: progress })) }); setRevision({ manuscript_id: "", response_document: "", revised_file: null }); setUploadErrors((prev) => ({ ...prev, revised_file: "" })); await onSaved(); toast.success("Revision submitted.") } catch (error) { toast.error(errorText(error, "Unable to submit revision.")) } finally { setSaving(false); setTimeout(() => setUploadProgress((prev) => ({ ...prev, revised_file: 0 })), 500) } }}><div className="space-y-2"><Label>Manuscript</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={revision.manuscript_id} onChange={(e)=>setRevision((p)=>({...p,manuscript_id:e.target.value}))} disabled={revisionEligibleManuscripts.length === 0}><option value="">{revisionEligibleManuscripts.length ? "Select manuscript" : "No manuscript currently requires revision"}</option>{revisionEligibleManuscripts.map((entry)=><option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>{String(entry.reference_number ?? entry.manuscript_id)} — {String(entry.title ?? entry.manuscript_id)}</option>)}</select></div>{revisionEligibleManuscripts.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">A manuscript will appear here only after reviewers and editors request revision.</div> : null}<div className="space-y-2"><Label>Response to reviewers</Label><Textarea rows={8} value={revision.response_document} onChange={(e)=>setRevision((p)=>({...p,response_document:e.target.value}))} /></div><FileDropzone label="Revised manuscript" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" helperText="Accepted: PDF, DOC, DOCX. Maximum 10MB." file={revision.revised_file} error={uploadErrors.revised_file} progress={uploadProgress.revised_file} progressLabel="Uploading revision" onFileSelect={(file)=>assignUpload("revised_file", file, ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], "Revised manuscript", (value)=>setRevision((p)=>({...p, revised_file: value})))} onRemove={()=>{ assignUpload("revised_file", null, [], "Revised manuscript", (value)=>setRevision((p)=>({...p, revised_file: value}))); setUploadProgress((prev) => ({ ...prev, revised_file: 0 })) }} /><Button type="submit" disabled={saving || revisionEligibleManuscripts.length === 0}>{saving ? "Submitting..." : "Submit revision"}</Button></form></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Workflow className="h-5 w-5" />} title="Revision History" /></CardHeader><CardContent><Table rows={revisions} /></CardContent></Card></div>
  if (section === "metrics") return <div className="grid gap-6"><div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<BarChart3 className="h-5 w-5" />} title="Online Payment with Paystack" description="Pay online for accepted manuscripts. The secret key remains on the PHP backend and payment is initialized securely before redirecting to Paystack." /></CardHeader><CardContent className="space-y-5"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><p className="font-semibold text-slate-900">Paystack workflow</p><p className="mt-2 leading-7">Choose an accepted manuscript, enter the amount, and continue to Paystack. When payment succeeds, the dashboard verifies the transaction automatically when you return.</p></div>{verifyingPayment ? <div className="rounded-2xl border border-slate-200 bg-jostum-50 p-4 text-sm text-jostum-800">Verifying your Paystack payment...</div> : null}<form className="space-y-4" onSubmit={async (e)=>{ e.preventDefault(); if (!onlinePayment.manuscript_id || !onlinePayment.amount) { toast.error("Select a payable manuscript and enter the amount first."); return } setPayingOnline(true); try { const response = await initializePaystackPayment({ manuscript_id: Number(onlinePayment.manuscript_id), amount: Number(onlinePayment.amount) }); toast.success(response.message); window.location.assign(response.authorization_url) } catch (error) { toast.error(errorText(error, "Unable to initialize Paystack payment.")) } finally { setPayingOnline(false) } }}><div className="space-y-2"><Label>Accepted manuscript</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={onlinePayment.manuscript_id} onChange={(e)=>setOnlinePayment((p)=>({...p, manuscript_id: e.target.value}))} disabled={payableManuscripts.length === 0}><option value="">{payableManuscripts.length ? "Select manuscript" : "No manuscript is ready for payment"}</option>{payableManuscripts.map((entry)=><option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>{String(entry.reference_number ?? entry.manuscript_id)} — {String(entry.title ?? entry.manuscript_id)}</option>)}</select></div><div className="space-y-2"><Label>Amount (NGN)</Label><Input value={onlinePayment.amount} onChange={(e)=>setOnlinePayment((p)=>({...p, amount: e.target.value}))} placeholder="50000" /></div><Button type="submit" disabled={payingOnline || payableManuscripts.length === 0}>{payingOnline ? "Redirecting..." : "Pay with Paystack"}</Button></form><form className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4" onSubmit={async (e)=>{e.preventDefault(); if (!copyrightForm.signed_file) { setUploadErrors((prev) => ({ ...prev, signed_file: "Upload the signed copyright form before continuing." })); return } setSaving(true); setUploadProgress((prev) => ({ ...prev, signed_file: 0 })); try { const payload = new FormData(); payload.append("manuscript_id", copyrightForm.manuscript_id); payload.append("notes", copyrightForm.notes); payload.append("signed_form", copyrightForm.signed_file); await submitCopyrightForm(payload as unknown as Record<string, unknown>, { onProgress: (progress) => setUploadProgress((prev) => ({ ...prev, signed_file: progress })) }); setCopyrightForm({ manuscript_id: "", signed_file: null, notes: "" }); setUploadErrors((prev) => ({ ...prev, signed_file: "" })); await onSaved(); toast.success("Copyright form uploaded.") } catch (error) { toast.error(errorText(error, "Unable to upload copyright form.")) } finally { setSaving(false); setTimeout(() => setUploadProgress((prev) => ({ ...prev, signed_file: 0 })), 500) } }}><p className="text-sm font-semibold text-slate-900">Upload signed copyright form</p><div className="space-y-2"><Label>Paid manuscript</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={copyrightForm.manuscript_id} onChange={(e)=>setCopyrightForm((p)=>({...p,manuscript_id:e.target.value}))}><option value="">Select manuscript</option>{confirmedPayments.map((entry)=><option key={String(entry.payment_id)} value={String(entry.manuscript_id)}>{String(entry.manuscript_id)} | {String(entry.payment_reference)}</option>)}</select></div><FileDropzone label="Signed copyright form" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" helperText="Accepted: PDF, JPG, PNG. Maximum 10MB." file={copyrightForm.signed_file} error={uploadErrors.signed_file} progress={uploadProgress.signed_file} progressLabel="Uploading copyright form" onFileSelect={(file)=>assignUpload("signed_file", file, ["application/pdf", "image/jpeg", "image/png"], "Signed copyright form", (value)=>setCopyrightForm((p)=>({...p, signed_file: value})))} onRemove={()=>{ assignUpload("signed_file", null, [], "Signed copyright form", (value)=>setCopyrightForm((p)=>({...p, signed_file: value}))); setUploadProgress((prev) => ({ ...prev, signed_file: 0 })) }} /><div className="space-y-2"><Label>Notes</Label><Textarea rows={4} value={copyrightForm.notes} onChange={(e)=>setCopyrightForm((p)=>({...p,notes:e.target.value}))} /></div><Button type="submit" disabled={saving || confirmedPayments.length === 0}>{saving ? "Uploading..." : "Upload copyright form"}</Button></form></CardContent></Card><div className="space-y-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Workflow className="h-5 w-5" />} title="Paid but want to send receipt" description="Upload your receipt after Paystack confirms payment. The receipt is attached to the existing online payment reference." /></CardHeader><CardContent><form className="space-y-4" onSubmit={async (e)=>{e.preventDefault(); if (!paymentForm.proof_file) { setUploadErrors((prev) => ({ ...prev, payment_proof: "Upload the payment proof before sending payment details." })); return } setSaving(true); setUploadProgress((prev) => ({ ...prev, payment_proof: 0 })); try { const payload = new FormData(); payload.append("manuscript_id", paymentForm.manuscript_id); payload.append("amount", paymentForm.amount); payload.append("payment_reference", paymentForm.payment_reference); payload.append("payment_details", paymentForm.payment_details); payload.append("payment_proof", paymentForm.proof_file); await submitPayment(payload as unknown as Record<string, unknown>, { onProgress: (progress) => setUploadProgress((prev) => ({ ...prev, payment_proof: progress })) }); setPaymentForm({ manuscript_id: "", amount: "", payment_reference: "", payment_details: "", proof_file: null }); setUploadErrors((prev) => ({ ...prev, payment_proof: "" })); await onSaved(); toast.success("Receipt submitted and attached to the payment record.") } catch (error) { toast.error(errorText(error, "Unable to submit payment receipt.")) } finally { setSaving(false); setTimeout(() => setUploadProgress((prev) => ({ ...prev, payment_proof: 0 })), 500) } }}><div className="space-y-2"><Label>Paid manuscript</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={paymentForm.manuscript_id} onChange={(e)=>setPaymentForm((p)=>({...p,manuscript_id:e.target.value, payment_reference: ""}))} disabled={receiptEligiblePayments.length === 0}><option value="">{receiptEligiblePayments.length ? "Select manuscript" : "All confirmed payments already have receipts"}</option>{receiptEligiblePayments.map((entry)=><option key={String(entry.payment_id)} value={String(entry.manuscript_id)}>{String(entry.manuscript_id)} | {String(entry.payment_reference)}</option>)}</select></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Amount</Label><Input value={paymentForm.amount} onChange={(e)=>setPaymentForm((p)=>({...p,amount:e.target.value}))} placeholder="Optional if already verified online" /></div><div className="space-y-2"><Label>Payment reference</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={paymentForm.payment_reference} onChange={(e)=>setPaymentForm((p)=>({...p,payment_reference:e.target.value}))} disabled={receiptEligiblePayments.length === 0}><option value="">{receiptEligiblePayments.length ? "Select payment reference" : "No receipt upload pending"}</option>{receiptEligiblePayments.filter((entry)=>!paymentForm.manuscript_id || String(entry.manuscript_id) === paymentForm.manuscript_id).map((entry)=><option key={String(entry.payment_id)} value={String(entry.payment_reference)}>{String(entry.payment_reference)}</option>)}</select></div></div><FileDropzone label="Payment proof" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" helperText="Accepted: PDF, JPG, PNG, WEBP. Maximum 10MB." file={paymentForm.proof_file} error={uploadErrors.payment_proof} progress={uploadProgress.payment_proof} progressLabel="Uploading payment proof" onFileSelect={(file)=>assignUpload("payment_proof", file, ["application/pdf", "image/jpeg", "image/png", "image/webp"], "Payment proof", (value)=>setPaymentForm((p)=>({...p, proof_file: value})))} onRemove={()=>{ assignUpload("payment_proof", null, [], "Payment proof", (value)=>setPaymentForm((p)=>({...p, proof_file: value}))); setUploadProgress((prev) => ({ ...prev, payment_proof: 0 })) }} /><div className="space-y-2"><Label>Receipt notes</Label><Textarea rows={4} value={paymentForm.payment_details} onChange={(e)=>setPaymentForm((p)=>({...p,payment_details:e.target.value}))} /></div><Button type="submit" disabled={saving || receiptEligiblePayments.length === 0 || !paymentForm.payment_reference || !paymentForm.manuscript_id}>{saving ? "Submitting..." : "Submit receipt"}</Button></form></CardContent></Card></div></div><PaymentRecordsCard payments={payments} copyrightForms={copyrightForms} /></div>
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

  return <Card className="border-white/70 bg-white/88 backdrop-blur"><CardHeader><CardHeading icon={<Microscope className="h-5 w-5" />} title="Reviewer Application Required" description="Complete the JASTI reviewer application before invitations, review forms, and assigned manuscripts become available." /></CardHeader><CardContent className="space-y-6"><div className="grid gap-3 md:grid-cols-7">{stepLabels.map((label, index) => <button key={label} type="button" onClick={() => { setStep(index + 1); setValidationMessage("") }} className={cn("rounded-2xl border px-3 py-3 text-left text-sm font-medium", step === index + 1 ? "border-jostum-700 bg-jostum-50 text-jostum-800" : "border-slate-200 bg-white text-slate-600")}><p className="text-xs uppercase tracking-[0.16em]">{`Step ${index + 1}`}</p><p className="mt-2">{label}</p></button>)}</div><div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">The final editorial-office section from the reviewer form remains admin-controlled and is not shown to reviewers.</div>{validationMessage ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{validationMessage}</div> : null}{step === 1 ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e)=>setForm((prev)=>({...prev,title:e.target.value}))} placeholder="Dr." /></div><div className="space-y-2"><Label>First name</Label><Input value={form.first_name} onChange={(e)=>setForm((prev)=>({...prev,first_name:e.target.value}))} /></div><div className="space-y-2"><Label>Last name</Label><Input value={form.last_name} onChange={(e)=>setForm((prev)=>({...prev,last_name:e.target.value}))} /></div><div className="space-y-2"><Label>Gender</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.gender} onChange={(e)=>setForm((prev)=>({...prev,gender:e.target.value}))}><option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Prefer not to say">Prefer not to say</option></select></div><div className="space-y-2"><Label>Nationality</Label><Input value={form.nationality} onChange={(e)=>setForm((prev)=>({...prev,nationality:e.target.value}))} /></div><div className="space-y-2"><Label>Country of residence</Label><Input value={form.country} onChange={(e)=>setForm((prev)=>({...prev,country:e.target.value}))} /></div><div className="space-y-2"><Label>Institution / Organization</Label><Input value={form.institution} onChange={(e)=>setForm((prev)=>({...prev,institution:e.target.value}))} /></div><div className="space-y-2"><Label>Department / Faculty</Label><Input value={form.department} onChange={(e)=>setForm((prev)=>({...prev,department:e.target.value}))} /></div><div className="space-y-2"><Label>Current position</Label><Input value={form.position} onChange={(e)=>setForm((prev)=>({...prev,position:e.target.value}))} /></div></div> : null}{step === 2 ? <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Institutional email</Label><Input type="email" value={form.email} onChange={(e)=>setForm((prev)=>({...prev,email:e.target.value}))} /></div><div className="space-y-2"><Label>Alternative email</Label><Input type="email" value={form.alt_email} onChange={(e)=>setForm((prev)=>({...prev,alt_email:e.target.value}))} /></div><div className="space-y-2"><Label>Phone number</Label><Input value={form.phone} onChange={(e)=>setForm((prev)=>({...prev,phone:e.target.value}))} /></div><div className="space-y-2"><Label>Whatsapp number</Label><Input value={form.whatsapp_number} onChange={(e)=>setForm((prev)=>({...prev,whatsapp_number:e.target.value}))} /></div><div className="space-y-2 md:col-span-2"><Label>Office address</Label><Textarea rows={5} value={form.office_address} onChange={(e)=>setForm((prev)=>({...prev,office_address:e.target.value}))} /></div></div> : null}{step === 3 ? <div className="space-y-4">{qualifications.map((entry, index) => <div key={index} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><Label>Degree</Label><Input value={entry.degree} onChange={(e)=>setQualifications((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, degree: e.target.value } : item))} /></div><div className="space-y-2"><Label>Field of study</Label><Input value={entry.field_of_study} onChange={(e)=>setQualifications((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, field_of_study: e.target.value } : item))} /></div><div className="space-y-2"><Label>Institution</Label><Input value={entry.institution} onChange={(e)=>setQualifications((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, institution: e.target.value } : item))} /></div><div className="space-y-2"><Label>Graduation year</Label><Input value={entry.graduation_year} onChange={(e)=>setQualifications((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, graduation_year: e.target.value } : item))} /></div></div>)}<Button type="button" variant="outline" onClick={() => setQualifications((prev) => [...prev, { degree: "", field_of_study: "", institution: "", graduation_year: "" }])}>Add qualification</Button></div> : null}{step === 4 ? <div className="space-y-4"><div className="space-y-2"><Label>Primary research areas (select up to 5)</Label><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{specializationOptions.map((option) => <label key={option} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={specializations.includes(option)} disabled={!specializations.includes(option) && specializations.length >= 5} onChange={(e)=>setSpecializations((prev)=>e.target.checked ? [...prev, option] : prev.filter((item)=>item!==option))} />{option}</label>)}</div><p className="text-xs text-slate-500">You can select up to five primary research areas.</p></div><div className="space-y-4">{expertise.map((entry, index) => <div key={index} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2"><div className="space-y-2"><Label>Research area</Label><Input value={entry.research_area} onChange={(e)=>setExpertise((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, research_area: e.target.value } : item))} /></div><div className="space-y-2"><Label>Specific keywords</Label><Input value={entry.keywords} onChange={(e)=>setExpertise((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, keywords: e.target.value } : item))} placeholder="machine learning, smart grids, IoT" /></div></div>)}<Button type="button" variant="outline" onClick={() => setExpertise((prev) => [...prev, { research_area: "", keywords: "" }])}>Add expertise row</Button></div></div> : null}{step === 5 ? <div className="space-y-4"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><Label>Google Scholar profile</Label><Input value={form.google_scholar_link} onChange={(e)=>setForm((prev)=>({...prev,google_scholar_link:e.target.value}))} /></div><div className="space-y-2"><Label>ORCID ID</Label><Input value={form.orcid_id} onChange={(e)=>setForm((prev)=>({...prev,orcid_id:e.target.value}))} /></div><div className="space-y-2"><Label>Scopus Author ID</Label><Input value={form.scopus_id} onChange={(e)=>setForm((prev)=>({...prev,scopus_id:e.target.value}))} /></div><div className="space-y-2"><Label>Web of Science Researcher ID</Label><Input value={form.researcher_id} onChange={(e)=>setForm((prev)=>({...prev,researcher_id:e.target.value}))} /></div></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Publication count</Label><Input value={form.publication_count} onChange={(e)=>setForm((prev)=>({...prev,publication_count:e.target.value}))} /></div><div className="space-y-2"><Label>Peer-reviewed publications band</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.publication_count_band} onChange={(e)=>setForm((prev)=>({...prev,publication_count_band:e.target.value}))}><option value="">Select band</option><option value="1-5">1-5</option><option value="6-15">6-15</option><option value="16-30">16-30</option><option value="30+">30+</option></select></div></div></div> : null}{step === 6 ? <div className="space-y-4"><label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.reviewer_experience} onChange={(e)=>setForm((prev)=>({...prev,reviewer_experience:e.target.checked}))} />I have previously served as a journal reviewer</label>{form.reviewer_experience ? <div className="space-y-4">{journalExperiences.map((entry, index) => <div key={index} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3"><div className="space-y-2"><Label>Journal name</Label><Input value={entry.journal_name} onChange={(e)=>setJournalExperiences((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, journal_name: e.target.value } : item))} /></div><div className="space-y-2"><Label>Publisher</Label><Input value={entry.publisher} onChange={(e)=>setJournalExperiences((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, publisher: e.target.value } : item))} /></div><div className="space-y-2"><Label>Years of service</Label><Input value={entry.years_of_service} onChange={(e)=>setJournalExperiences((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, years_of_service: e.target.value } : item))} /></div></div>)}<Button type="button" variant="outline" onClick={() => setJournalExperiences((prev) => [...prev, { journal_name: "", publisher: "", years_of_service: "" }])}>Add journal experience</Button></div> : null}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><Label>Papers reviewed band</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.papers_reviewed_band} onChange={(e)=>setForm((prev)=>({...prev,papers_reviewed_band:e.target.value}))}><option value="">Select band</option><option value="1-5">1-5</option><option value="6-15">6-15</option><option value="16-30">16-30</option><option value="30+">30+</option></select></div><div className="space-y-2"><Label>Manuscripts willing to review per year</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.manuscripts_per_year_band} onChange={(e)=>setForm((prev)=>({...prev,manuscripts_per_year_band:e.target.value}))}><option value="">Select band</option><option value="2-5">2-5</option><option value="7-12">7-12</option><option value="12-20">12-20</option></select></div><div className="space-y-2"><Label>Numeric max reviews per year</Label><Input value={form.max_reviews_per_year} onChange={(e)=>setForm((prev)=>({...prev,max_reviews_per_year:e.target.value, manuscripts_per_year: e.target.value || prev.manuscripts_per_year}))} /></div><div className="space-y-2"><Label>Preferred review timeline</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.preferred_review_time} onChange={(e)=>setForm((prev)=>({...prev,preferred_review_time:e.target.value}))}><option value="7">7 days</option><option value="14">14 days</option><option value="21">21 days</option></select></div></div><div className="grid gap-4 md:grid-cols-2"><label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.available} onChange={(e)=>setForm((prev)=>({...prev,available:e.target.checked}))} />Currently available for review assignments</label><div className="space-y-2"><Label>Last review date</Label><Input type="date" value={form.last_review_date} onChange={(e)=>setForm((prev)=>({...prev,last_review_date:e.target.value}))} /></div></div><div className="space-y-4">{conflicts.map((entry, index) => <div key={index} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3"><div className="space-y-2"><Label>Institution conflict</Label><Input value={entry.institution_conflict} onChange={(e)=>setConflicts((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, institution_conflict: e.target.value } : item))} /></div><div className="space-y-2"><Label>Author conflict</Label><Input value={entry.author_conflict} onChange={(e)=>setConflicts((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, author_conflict: e.target.value } : item))} /></div><div className="space-y-2"><Label>Notes</Label><Input value={entry.notes} onChange={(e)=>setConflicts((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, notes: e.target.value } : item))} /></div></div>)}<Button type="button" variant="outline" onClick={() => setConflicts((prev) => [...prev, { institution_conflict: "", author_conflict: "", notes: "" }])}>Add conflict entry</Button></div></div> : null}{step === 7 ? <div className="space-y-5"><div className="space-y-2"><Label>Short academic biography</Label><Textarea rows={6} value={form.bio} onChange={(e)=>setForm((prev)=>({...prev,bio:e.target.value}))} /></div><div className="grid gap-6 lg:grid-cols-3"><div className="space-y-3"><FileDropzone label="Curriculum Vitae" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" helperText="Accepted: PDF, DOC, DOCX. Maximum 10MB." file={files.cv_file} error={uploadErrors.cv_file} progress={uploadProgress > 0 ? uploadProgress : undefined} progressLabel="Uploading reviewer files" onFileSelect={(file)=>handleFileAssign("cv_file", file, ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], "Curriculum Vitae")} onRemove={()=>handleFileAssign("cv_file", null, [], "Curriculum Vitae")} />{currentCvPath ? <a href={resolveApiAssetUrl(currentCvPath)} target="_blank" rel="noreferrer" className="text-xs font-medium text-jostum-700 underline underline-offset-4">View current CV</a> : null}</div><div className="space-y-3"><FileDropzone label="List of publications" accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" helperText="Optional: PDF, DOC, DOCX, or TXT. Maximum 10MB." file={files.publication_list_file} error={uploadErrors.publication_list_file} progress={uploadProgress > 0 ? uploadProgress : undefined} progressLabel="Uploading reviewer files" onFileSelect={(file)=>handleFileAssign("publication_list_file", file, ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"], "Publication list")} onRemove={()=>handleFileAssign("publication_list_file", null, [], "Publication list")} />{currentPublicationListPath ? <a href={resolveApiAssetUrl(currentPublicationListPath)} target="_blank" rel="noreferrer" className="text-xs font-medium text-jostum-700 underline underline-offset-4">View current publication list</a> : null}</div><div className="space-y-3"><FileDropzone label="ORCID profile screenshot" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" helperText="Optional: PDF, JPG, PNG, WEBP. Maximum 10MB." file={files.orcid_screenshot_file} error={uploadErrors.orcid_screenshot_file} progress={uploadProgress > 0 ? uploadProgress : undefined} progressLabel="Uploading reviewer files" onFileSelect={(file)=>handleFileAssign("orcid_screenshot_file", file, ["application/pdf", "image/jpeg", "image/png", "image/webp"], "ORCID profile screenshot")} onRemove={()=>handleFileAssign("orcid_screenshot_file", null, [], "ORCID profile screenshot")} />{currentOrcidScreenshotPath ? <a href={resolveApiAssetUrl(currentOrcidScreenshotPath)} target="_blank" rel="noreferrer" className="text-xs font-medium text-jostum-700 underline underline-offset-4">View current ORCID file</a> : null}</div></div><div className="grid gap-3 md:grid-cols-2"><label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.confidentiality_agreed} onChange={(e)=>setForm((prev)=>({...prev,confidentiality_agreed:e.target.checked}))} />I will maintain strict confidentiality of manuscripts.</label><label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.conflict_policy_agreed} onChange={(e)=>setForm((prev)=>({...prev,conflict_policy_agreed:e.target.checked}))} />I will declare conflicts of interest before reviewing.</label><label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.ethical_review_agreed} onChange={(e)=>setForm((prev)=>({...prev,ethical_review_agreed:e.target.checked}))} />I will provide objective and constructive reviews and adhere to JASTI peer review policy.</label></div></div> : null}<div className="flex items-center justify-between gap-3"><Button type="button" variant="outline" disabled={step === 1} onClick={() => { setStep((current) => Math.max(1, current - 1)); setValidationMessage("") }}>Previous</Button><div className="flex items-center gap-3">{step < 7 ? <Button type="button" onClick={() => { const error = validateStep(step); if (error) { setValidationMessage(error); return } setValidationMessage(""); setStep((current) => Math.min(7, current + 1)) }}>Next</Button> : <Button type="button" onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Finish application"}</Button>}</div></div></CardContent></Card>
}

function ReviewerPanels({ section, workspace, onSaved }: { section: string; workspace: WorkspacePayload; onSaved: () => Promise<void> }) {
  const onboarding = workspace.reviewer?.onboarding ?? { completed: false, application: {}, qualifications: [], expertise: [], journal_experiences: [], availability: {}, conflicts: [], agreements: {}, specialization_options: [] }
  const invitations = asArray(workspace.reviewer?.invitations)
  const reviews = asArray(workspace.reviewer?.reviews)
  const acceptedInvitations = invitations.filter((entry) => String(entry.response) === "accepted")
  const pendingInvitations = invitations.filter((entry) => String(entry.response) === "pending")
  const [reviewForm, setReviewForm] = React.useState({ manuscript_id: "", recommendation: "major_revision", comments_to_author: "", confidential_comments: "", score_novelty: "3", score_methodology: "3", score_clarity: "3", score_significance: "3" })
  const [saving, setSaving] = React.useState(false)
  if (section === "profile") return <ReviewerOnboardingCard onboarding={onboarding} user={workspace.user} onSaved={onSaved} />
  if (section === "invitations") return <div className="grid gap-6"><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Users className="h-5 w-5" />} title="Invitation Management" description="Accept or decline invitations before moving a manuscript into your active review queue." /></CardHeader><CardContent className="space-y-4">{invitations.length ? invitations.map((item)=>{ const response = String(item.response ?? "pending"); const isLocked = response !== "pending"; return <div key={String(item.invitation_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold text-slate-900">{String(item.title ?? item.manuscript_id)}</p><p className="text-sm text-slate-500">Response: {response} | Sent: {String(item.invitation_date ?? "")}</p></div><div className="flex gap-2"><Button size="sm" disabled={isLocked} onClick={async ()=>{try { await respondToInvitation({ invitation_id: Number(item.invitation_id), response: "accepted" }); await onSaved(); toast.success("Invitation accepted.") } catch (error) { toast.error(errorText(error, "Unable to respond.")) }}}>{response === "accepted" ? "Accepted" : "Accept"}</Button><Button size="sm" variant="outline" disabled={isLocked} onClick={async ()=>{try { await respondToInvitation({ invitation_id: Number(item.invitation_id), response: "declined" }); await onSaved(); toast.success("Invitation declined.") } catch (error) { toast.error(errorText(error, "Unable to respond.")) }}}>{response === "declined" ? "Declined" : "Decline"}</Button></div></div></div>}) : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No invitations available.</div>}</CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<BarChart3 className="h-5 w-5" />} title="Invitation Summary" /></CardHeader><CardContent className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pending</p><p className="mt-2 text-3xl font-semibold text-slate-950">{pendingInvitations.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Accepted</p><p className="mt-2 text-3xl font-semibold text-slate-950">{acceptedInvitations.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Completed reviews</p><p className="mt-2 text-3xl font-semibold text-slate-950">{reviews.length}</p></div><div className="md:col-span-3"><Table rows={invitations} /></div></CardContent></Card></div>
  if (section === "deadlines") return <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]"><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Workflow className="h-5 w-5" />} title="Deadline Tracker" description="Use the invitation timeline and response dates to keep review turnaround under control." /></CardHeader><CardContent className="space-y-3">{acceptedInvitations.length ? acceptedInvitations.map((item)=><div key={String(item.invitation_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold text-slate-900">{String(item.title ?? item.manuscript_id)}</p><p className="mt-2 text-sm text-slate-500">Accepted on: {String(item.response_date ?? "Awaiting response date")}</p><p className="text-sm text-slate-500">Invitation sent: {String(item.invitation_date ?? "")}</p></div>) : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No accepted manuscripts are currently in your review queue.</div>}</CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<BookOpenText className="h-5 w-5" />} title="Assigned Manuscript Timeline" /></CardHeader><CardContent><Table rows={acceptedInvitations} /></CardContent></Card></div>
  if (section === "assigned") return <div className="grid gap-6"><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<BookOpenText className="h-5 w-5" />} title="Assigned Manuscripts" description="Author identities remain hidden. Review only the manuscript content, files, and editorial instructions." /></CardHeader><CardContent className="space-y-4">{acceptedInvitations.length ? acceptedInvitations.map((item)=><div key={String(item.invitation_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold text-slate-900">{String(item.title ?? item.manuscript_id)}</p><p className="mt-2 text-sm text-slate-500">Status: {String(item.status ?? "")}</p><p className="mt-2 text-xs leading-6 text-slate-500">{String(item.file_bundle ?? "No manuscript file bundle available yet.")}</p></div>) : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No manuscripts have been assigned to you yet.</div>}</CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Workflow className="h-5 w-5" />} title="Accepted Review Queue" /></CardHeader><CardContent><Table rows={acceptedInvitations} /></CardContent></Card></div>
  if (["evaluation", "recommendation", "comments"].includes(section)) return <div className="grid gap-6"><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Review Evaluation Form</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={async (e)=>{e.preventDefault(); setSaving(true); try { await submitReview({ ...reviewForm, manuscript_id: Number(reviewForm.manuscript_id), score_novelty: Number(reviewForm.score_novelty), score_methodology: Number(reviewForm.score_methodology), score_clarity: Number(reviewForm.score_clarity), score_significance: Number(reviewForm.score_significance) }); setReviewForm({ manuscript_id: "", recommendation: "major_revision", comments_to_author: "", confidential_comments: "", score_novelty: "3", score_methodology: "3", score_clarity: "3", score_significance: "3" }); await onSaved(); toast.success("Review submitted.") } catch (error) { toast.error(errorText(error, "Unable to submit review.")) } finally { setSaving(false) } }}><div className="space-y-2"><Label>Accepted invitation manuscript</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={reviewForm.manuscript_id} onChange={(e)=>setReviewForm((p)=>({...p,manuscript_id:e.target.value}))}><option value="">Select manuscript</option>{invitations.filter((entry)=>String(entry.response)==="accepted").map((entry)=><option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>{String(entry.title ?? entry.manuscript_id)}</option>)}</select></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Novelty</Label><Input value={reviewForm.score_novelty} onChange={(e)=>setReviewForm((p)=>({...p,score_novelty:e.target.value}))} /></div><div className="space-y-2"><Label>Methodology</Label><Input value={reviewForm.score_methodology} onChange={(e)=>setReviewForm((p)=>({...p,score_methodology:e.target.value}))} /></div><div className="space-y-2"><Label>Clarity</Label><Input value={reviewForm.score_clarity} onChange={(e)=>setReviewForm((p)=>({...p,score_clarity:e.target.value}))} /></div><div className="space-y-2"><Label>Significance</Label><Input value={reviewForm.score_significance} onChange={(e)=>setReviewForm((p)=>({...p,score_significance:e.target.value}))} /></div></div><div className="space-y-2"><Label>Recommendation</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={reviewForm.recommendation} onChange={(e)=>setReviewForm((p)=>({...p,recommendation:e.target.value}))}><option value="accept">Accept</option><option value="minor_revision">Minor revision</option><option value="major_revision">Major revision</option><option value="reject">Reject</option></select></div><div className="space-y-2"><Label>Comments to authors</Label><Textarea rows={5} value={reviewForm.comments_to_author} onChange={(e)=>setReviewForm((p)=>({...p,comments_to_author:e.target.value}))} /></div><div className="space-y-2"><Label>Confidential comments to editor</Label><Textarea rows={5} value={reviewForm.confidential_comments} onChange={(e)=>setReviewForm((p)=>({...p,confidential_comments:e.target.value}))} /></div><Button type="submit" disabled={saving}>{saving ? "Submitting..." : "Submit review"}</Button></form></CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Completed Reviews</CardTitle></CardHeader><CardContent><Table rows={reviews} /></CardContent></Card></div>
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

  return <Card className="border-white/70 bg-white/88 backdrop-blur"><CardHeader><CardHeading icon={<FileClock className="h-5 w-5" />} title="Editor Application Required" description="Complete the editorial board application before accessing manuscript handling, reviewer assignment, and decisions." /></CardHeader><CardContent className="space-y-6"><div className="grid gap-3 md:grid-cols-7">{stepLabels.map((label, index) => <button key={label} type="button" onClick={() => { setStep(index + 1); setValidationMessage("") }} className={cn("rounded-2xl border px-3 py-3 text-left text-sm font-medium", step === index + 1 ? "border-jostum-700 bg-jostum-50 text-jostum-800" : "border-slate-200 bg-white text-slate-600")}><p className="text-xs uppercase tracking-[0.16em]">{`Step ${index + 1}`}</p><p className="mt-2">{label}</p></button>)}</div><div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">This application follows the JASTI editorial board form. Editorial office-use fields such as approval status, assigned section, and editor ID remain under admin control and are not exposed here.</div>{validationMessage ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{validationMessage}</div> : null}{step === 1 ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e)=>setForm((prev)=>({...prev,title:e.target.value}))} placeholder="Dr." /></div><div className="space-y-2"><Label>First name</Label><Input value={form.first_name} onChange={(e)=>setForm((prev)=>({...prev,first_name:e.target.value}))} /></div><div className="space-y-2"><Label>Last name</Label><Input value={form.last_name} onChange={(e)=>setForm((prev)=>({...prev,last_name:e.target.value}))} /></div><div className="space-y-2"><Label>Gender</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.gender} onChange={(e)=>setForm((prev)=>({...prev,gender:e.target.value}))}><option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option></select></div><div className="space-y-2"><Label>Nationality</Label><Input value={form.nationality} onChange={(e)=>setForm((prev)=>({...prev,nationality:e.target.value}))} /></div><div className="space-y-2"><Label>Country of residence</Label><Input value={form.country} onChange={(e)=>setForm((prev)=>({...prev,country:e.target.value}))} /></div></div> : null}{step === 2 ? <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Institution / Organization</Label><Input value={form.institution} onChange={(e)=>setForm((prev)=>({...prev,institution:e.target.value}))} /></div><div className="space-y-2"><Label>Faculty</Label><Input value={form.faculty} onChange={(e)=>setForm((prev)=>({...prev,faculty:e.target.value}))} /></div><div className="space-y-2"><Label>Department</Label><Input value={form.department} onChange={(e)=>setForm((prev)=>({...prev,department:e.target.value}))} /></div><div className="space-y-2"><Label>Current academic rank</Label><Input value={form.academic_rank} onChange={(e)=>setForm((prev)=>({...prev,academic_rank:e.target.value}))} /></div><div className="space-y-2"><Label>Current position / role</Label><Input value={form.position} onChange={(e)=>setForm((prev)=>({...prev,position:e.target.value}))} /></div><div className="space-y-2"><Label>Appointment type</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.editor_role} onChange={(e)=>setForm((prev)=>({...prev,editor_role:e.target.value}))}><option value="editorial_board">Editorial Board</option><option value="associate_editor">Associate Editor</option><option value="section_editor">Section Editor</option><option value="managing_editor">Managing Editor</option></select></div></div> : null}{step === 3 ? <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Institutional email</Label><Input type="email" value={form.email} onChange={(e)=>setForm((prev)=>({...prev,email:e.target.value}))} /></div><div className="space-y-2"><Label>Alternative email</Label><Input type="email" value={form.alt_email} onChange={(e)=>setForm((prev)=>({...prev,alt_email:e.target.value}))} /></div><div className="space-y-2"><Label>Phone number</Label><Input value={form.phone} onChange={(e)=>setForm((prev)=>({...prev,phone:e.target.value}))} /></div><div className="space-y-2"><Label>Whatsapp number</Label><Input value={form.whatsapp_number} onChange={(e)=>setForm((prev)=>({...prev,whatsapp_number:e.target.value}))} /></div><div className="space-y-2 md:col-span-2"><Label>Office address</Label><Textarea rows={5} value={form.office_address} onChange={(e)=>setForm((prev)=>({...prev,office_address:e.target.value}))} /></div></div> : null}{step === 4 ? <div className="space-y-4">{qualifications.map((entry, index) => <div key={index} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><Label>Degree</Label><Input value={entry.degree} onChange={(e)=>setQualifications((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, degree: e.target.value } : item))} /></div><div className="space-y-2"><Label>Field of study</Label><Input value={entry.field_of_study} onChange={(e)=>setQualifications((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, field_of_study: e.target.value } : item))} /></div><div className="space-y-2"><Label>Institution</Label><Input value={entry.institution} onChange={(e)=>setQualifications((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, institution: e.target.value } : item))} /></div><div className="space-y-2"><Label>Graduation year</Label><Input value={entry.graduation_year} onChange={(e)=>setQualifications((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, graduation_year: e.target.value } : item))} /></div></div>)}<Button type="button" variant="outline" onClick={() => setQualifications((prev) => [...prev, { degree: "", field_of_study: "", institution: "", graduation_year: "" }])}>Add qualification</Button></div> : null}{step === 5 ? <div className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Primary editorial area</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.primary_editorial_area} onChange={(e)=>setForm((prev)=>({...prev,primary_editorial_area:e.target.value}))}><option value="">Select area</option>{sectionOptions.map((entry)=><option key={String(entry.section_id ?? entry.section_name)} value={String(entry.section_name ?? "")}>{String(entry.section_name ?? "")}</option>)}</select></div><div className="space-y-2"><Label>Specific research keywords</Label><Input value={form.research_keywords} onChange={(e)=>setForm((prev)=>({...prev,research_keywords:e.target.value}))} placeholder="AI, data science, smart systems" /></div></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><Label>ORCID ID</Label><Input value={form.orcid_id} onChange={(e)=>setForm((prev)=>({...prev,orcid_id:e.target.value}))} /></div><div className="space-y-2"><Label>Scopus ID</Label><Input value={form.scopus_id} onChange={(e)=>setForm((prev)=>({...prev,scopus_id:e.target.value}))} /></div><div className="space-y-2"><Label>Researcher ID</Label><Input value={form.researcher_id} onChange={(e)=>setForm((prev)=>({...prev,researcher_id:e.target.value}))} /></div><div className="space-y-2"><Label>Google Scholar link</Label><Input value={form.google_scholar_link} onChange={(e)=>setForm((prev)=>({...prev,google_scholar_link:e.target.value}))} /></div></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Publication count</Label><Input value={form.publication_count} onChange={(e)=>setForm((prev)=>({...prev,publication_count:e.target.value}))} /></div><div className="space-y-2"><Label>Publication count band</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.publication_count_band} onChange={(e)=>setForm((prev)=>({...prev,publication_count_band:e.target.value}))}><option value="">Select range</option><option value="1-10">1-10</option><option value="11-25">11-25</option><option value="26-50">26-50</option><option value="51-100">51-100</option><option value="100+">100+</option></select></div></div><div className="space-y-4">{expertise.map((entry, index) => <div key={index} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2"><div className="space-y-2"><Label>Additional research area</Label><Input value={entry.research_area} onChange={(e)=>setExpertise((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, research_area: e.target.value } : item))} /></div><div className="space-y-2"><Label>Keywords</Label><Input value={entry.keywords} onChange={(e)=>setExpertise((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, keywords: e.target.value } : item))} /></div></div>)}<Button type="button" variant="outline" onClick={() => setExpertise((prev) => [...prev, { research_area: "", keywords: "" }])}>Add expertise row</Button></div></div> : null}{step === 6 ? <div className="space-y-4"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><Label>Reviewed for journals</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.journals_reviewed_band} onChange={(e)=>setForm((prev)=>({...prev,journals_reviewed_band:e.target.value}))}><option value="">Select band</option><option value="1-3">1-3</option><option value="4-10">4-10</option><option value="11-20">11-20</option><option value="20+">20+</option></select></div><div className="space-y-2"><Label>Papers reviewed</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.papers_reviewed_band} onChange={(e)=>setForm((prev)=>({...prev,papers_reviewed_band:e.target.value}))}><option value="">Select band</option><option value="1-10">1-10</option><option value="11-30">11-30</option><option value="31-60">31-60</option><option value="60+">60+</option></select></div><div className="space-y-2"><Label>Manuscripts per year</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.manuscripts_per_year_band} onChange={(e)=>setForm((prev)=>({...prev,manuscripts_per_year_band:e.target.value}))}><option value="">Select band</option><option value="1-5">1-5</option><option value="6-10">6-10</option><option value="11-20">11-20</option><option value="20+">20+</option></select></div><div className="space-y-2"><Label>Decision timeline</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.preferred_decision_timeline} onChange={(e)=>setForm((prev)=>({...prev,preferred_decision_timeline:e.target.value}))}><option value="7">7 days</option><option value="14">14 days</option><option value="21">21 days</option></select></div></div><label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.editorial_experience} onChange={(e)=>setForm((prev)=>({...prev,editorial_experience:e.target.checked}))} />I have served in a journal editorial role before</label>{form.editorial_experience ? <div className="space-y-4">{journalExperiences.map((entry, index) => <div key={index} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><Label>Journal name</Label><Input value={entry.journal_name} onChange={(e)=>setJournalExperiences((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, journal_name: e.target.value } : item))} /></div><div className="space-y-2"><Label>Publisher</Label><Input value={entry.publisher} onChange={(e)=>setJournalExperiences((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, publisher: e.target.value } : item))} /></div><div className="space-y-2"><Label>Role</Label><Input value={entry.role_title} onChange={(e)=>setJournalExperiences((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, role_title: e.target.value } : item))} /></div><div className="space-y-2"><Label>Years of service</Label><Input value={entry.years_of_service} onChange={(e)=>setJournalExperiences((prev)=>prev.map((item, itemIndex)=>itemIndex===index ? { ...item, years_of_service: e.target.value } : item))} /></div></div>)}<Button type="button" variant="outline" onClick={() => setJournalExperiences((prev) => [...prev, { journal_name: "", publisher: "", role_title: "", years_of_service: "" }])}>Add editorial assignment</Button></div> : null}</div> : null}{step === 7 ? <div className="space-y-5"><div className="space-y-2"><Label>Short academic biography</Label><Textarea rows={6} value={form.bio} onChange={(e)=>setForm((prev)=>({...prev,bio:e.target.value}))} /></div><div className="grid gap-6 lg:grid-cols-2"><div className="space-y-3"><FileDropzone label="Curriculum Vitae" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" helperText="Accepted: PDF, DOC, DOCX. Maximum 10MB." file={files.cv_file} error={uploadErrors.cv_file} progress={uploadProgress > 0 ? uploadProgress : undefined} progressLabel="Uploading editor files" onFileSelect={(file)=>handleFileAssign("cv_file", file, ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], "Curriculum Vitae")} onRemove={()=>handleFileAssign("cv_file", null, [], "Curriculum Vitae")} />{currentCvPath ? <a href={resolveApiAssetUrl(currentCvPath)} target="_blank" rel="noreferrer" className="text-xs font-medium text-jostum-700 underline underline-offset-4">View current CV</a> : null}</div><div className="space-y-3"><FileDropzone label="Publication list" accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" helperText="Optional: PDF, DOC, DOCX, or TXT. Maximum 10MB." file={files.publication_list_file} error={uploadErrors.publication_list_file} progress={uploadProgress > 0 ? uploadProgress : undefined} progressLabel="Uploading editor files" onFileSelect={(file)=>handleFileAssign("publication_list_file", file, ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"], "Publication list")} onRemove={()=>handleFileAssign("publication_list_file", null, [], "Publication list")} />{currentPublicationListPath ? <a href={resolveApiAssetUrl(currentPublicationListPath)} target="_blank" rel="noreferrer" className="text-xs font-medium text-jostum-700 underline underline-offset-4">View current publication list</a> : null}</div></div><div className="grid gap-3 md:grid-cols-2"><label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.responsibility_fair_decisions} onChange={(e)=>setForm((prev)=>({...prev,responsibility_fair_decisions:e.target.checked}))} />Make fair and unbiased editorial decisions</label><label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.responsibility_confidentiality} onChange={(e)=>setForm((prev)=>({...prev,responsibility_confidentiality:e.target.checked}))} />Maintain confidentiality throughout the editorial process</label><label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.responsibility_conflicts} onChange={(e)=>setForm((prev)=>({...prev,responsibility_conflicts:e.target.checked}))} />Avoid and disclose conflicts of interest</label><label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.responsibility_integrity} onChange={(e)=>setForm((prev)=>({...prev,responsibility_integrity:e.target.checked}))} />Uphold research integrity and publication ethics</label><label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.responsibility_timeliness} onChange={(e)=>setForm((prev)=>({...prev,responsibility_timeliness:e.target.checked}))} />Support timely and documented editorial decisions</label><label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.conflict_of_interest_declared} onChange={(e)=>setForm((prev)=>({...prev,conflict_of_interest_declared:e.target.checked}))} />I have declared any conflict of interest relevant to this application</label><label className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.final_declaration_agreed} onChange={(e)=>setForm((prev)=>({...prev,final_declaration_agreed:e.target.checked}))} />I certify that the information supplied is accurate and agree to serve within JASTI editorial standards if appointed.</label></div></div> : null}<div className="flex items-center justify-between gap-3"><Button type="button" variant="outline" disabled={step === 1} onClick={() => { setStep((current) => Math.max(1, current - 1)); setValidationMessage("") }}>Previous</Button><div className="flex items-center gap-3">{step < 7 ? <Button type="button" onClick={() => { const error = validateStep(step); if (error) { setValidationMessage(error); return } setValidationMessage(""); setStep((current) => Math.min(7, current + 1)) }}>Next</Button> : <Button type="button" onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Finish application"}</Button>}</div></div></CardContent></Card>
}

function EditorPanels({ section, workspace, onSaved }: { section: string; workspace: WorkspacePayload; onSaved: () => Promise<void> }) {
  const assignments = asArray(workspace.editor?.assignments)
  const unassigned = asArray(workspace.editor?.unassigned_manuscripts)
  const reviewers = asArray(workspace.editor?.reviewers)
  const decisions = asArray(workspace.editor?.decisions)
  const activeAssignments = assignments.filter((entry) => ["submitted", "editor_screening", "under_review", "revision_required"].includes(String(entry.status)))
  const revisionQueue = assignments.filter((entry) => String(entry.status) === "revision_required")
  const reviewerAssignableAssignments = assignments.filter((entry) => Number(entry.reviewer_invitation_count ?? 0) === 0)
  const decisionEligibleAssignments = assignments.filter((entry) => Number(entry.completed_review_count ?? 0) > 0 && Number(entry.has_editor_decision ?? 0) === 0)
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
  const [inviteForm, setInviteForm] = React.useState({ manuscript_id: "", reviewer_ids: [] as string[], specialization_filter: "" })
  const [decisionForm, setDecisionForm] = React.useState({ manuscript_id: "", decision_type: "major_revision", decision_letter: "" })
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
  const filteredReviewers = inviteForm.specialization_filter
    ? reviewers.filter((entry) => {
        const raw = entry.specializations_json
        const values = typeof raw === "string" ? (() => { try { return JSON.parse(raw) as string[] } catch { return [] } })() : []
        return values.includes(inviteForm.specialization_filter) || String(entry.expertise_area ?? "").includes(inviteForm.specialization_filter)
      })
    : reviewers
  if (section === "assignments") return <div className="grid gap-6"><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<FileText className="h-5 w-5" />} title="Manuscript Assignment Panel" description="Claim new submissions that have not yet been picked up by an editor." /></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-900">Filter by ref #, ID, or title</p><Input className="max-w-xs" value={editorSearch} onChange={(e)=>setEditorSearch(e.target.value)} placeholder="JASTI-000000001" /></div>{filteredUnassigned.length ? filteredUnassigned.map((item)=><div key={String(item.manuscript_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold text-slate-900">{String(item.title ?? item.manuscript_id)}</p><p className="text-sm text-slate-500">Ref: {String(item.reference_number ?? item.manuscript_id)} | Type: {String(item.article_type ?? "")} | Plagiarism: {String(item.plagiarism_score ?? 0)}</p></div><Button size="sm" onClick={async ()=>{try { await claimAssignment({ manuscript_id: Number(item.manuscript_id) }); await onSaved(); toast.success("Manuscript assigned.") } catch (error) { toast.error(errorText(error, "Unable to assign manuscript.")) }}}>Claim assignment</Button></div></div>) : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No unassigned manuscripts.</div>}</CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Workflow className="h-5 w-5" />} title="Current Assignments" /></CardHeader><CardContent><Table rows={filteredAssignments} /></CardContent></Card></div>;  if (section === "screening") return <div className="grid gap-6"><ManualPlagiarismScorePanel entries={filteredActiveAssignments} title="Manual Plagiarism Score" description="Set or revise the manuscript similarity score after editorial screening." emptyMessage="No assigned manuscripts are currently available for plagiarism scoring." onSaved={onSaved} /><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<ShieldCheck className="h-5 w-5" />} title="Initial Screening" description="Check scope, formatting, ethics, and plagiarism indicators before assigning reviewers." /></CardHeader><CardContent className="space-y-4">{activeAssignments.length ? filteredActiveAssignments.map((item)=><div key={String(item.assignment_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold text-slate-900">{String(item.title ?? item.manuscript_id)}</p><div className="mt-3 grid gap-2 text-sm text-slate-500 md:grid-cols-2"><p>Scope status: aligned with current assignment</p><p>Plagiarism score: {item.plagiarism_score === null || item.plagiarism_score === undefined || item.plagiarism_score === "" ? "Not set" : `${Number(item.plagiarism_score).toFixed(2)}%`}</p><p>Submission date: {String(item.submission_date ?? "")}</p><p>Workflow status: {String(item.status ?? "")}</p></div></div>) : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No manuscripts currently require editorial screening.</div>}</CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<BookOpenText className="h-5 w-5" />} title="Screening Queue" /></CardHeader><CardContent><Table rows={filteredActiveAssignments} /></CardContent></Card></div>
  if (section === "selection") return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Reviewer Selection</CardTitle><CardDescription>Filter reviewers by specialization and assign one, two, or more reviewers to manuscripts that have not yet entered reviewer invitation workflow.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={async (e)=>{e.preventDefault(); setSaving(true); try { await inviteReviewer({ manuscript_id: Number(inviteForm.manuscript_id), reviewer_ids: inviteForm.reviewer_ids.map(Number) }); setInviteForm({ manuscript_id: "", reviewer_ids: [], specialization_filter: "" }); await onSaved(); toast.success("Reviewer invitations sent.") } catch (error) { toast.error(errorText(error, "Unable to invite reviewer.")) } finally { setSaving(false) } }}><div className="space-y-2"><Label>Manuscript</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={inviteForm.manuscript_id} onChange={(e)=>setInviteForm((p)=>({...p,manuscript_id:e.target.value}))} disabled={reviewerAssignableAssignments.length === 0}><option value="">{reviewerAssignableAssignments.length ? "Select manuscript" : "All assigned manuscripts already have reviewers"}</option>{reviewerAssignableAssignments.map((entry)=><option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>{String(entry.reference_number ?? entry.manuscript_id)} — {String(entry.title ?? entry.manuscript_id)}</option>)}</select></div>{reviewerAssignableAssignments.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">A manuscript disappears from reviewer selection after reviewer invitations have been sent.</div> : null}<div className="space-y-2"><Label>Filter by specialization</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={inviteForm.specialization_filter} onChange={(e)=>setInviteForm((p)=>({...p,specialization_filter:e.target.value}))}><option value="">All specialization areas</option>{specializationOptions.map((option)=><option key={option} value={option}>{option}</option>)}</select></div><div className="space-y-2"><Label>Select reviewer(s)</Label><div className="max-h-72 space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-white p-3">{filteredReviewers.map((entry)=><label key={String(entry.user_id)} className="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700"><input type="checkbox" checked={inviteForm.reviewer_ids.includes(String(entry.user_id))} onChange={(e)=>setInviteForm((prev)=>({...prev,reviewer_ids:e.target.checked ? [...prev.reviewer_ids, String(entry.user_id)] : prev.reviewer_ids.filter((id)=>id!==String(entry.user_id))}))} /><span><span className="font-semibold text-slate-900">{String(entry.first_name ?? "")} {String(entry.last_name ?? "")}</span><br /><span className="text-slate-500">{String(entry.expertise_area ?? "")}</span></span></label>)}</div></div><Button type="submit" disabled={saving || inviteForm.reviewer_ids.length === 0 || reviewerAssignableAssignments.length === 0 || !inviteForm.manuscript_id}>{saving ? "Inviting..." : "Assign selected reviewers"}</Button></form></CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Reviewer database</CardTitle></CardHeader><CardContent><Table rows={filteredReviewers} /></CardContent></Card></div>
  if (section === "monitoring") return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<BarChart3 className="h-5 w-5" />} title="Review Monitoring" description="Track manuscripts in review and reviewer readiness for the next invitation cycle." /></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Active assignments</p><p className="mt-2 text-3xl font-semibold text-slate-950">{activeAssignments.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Reviewer pool</p><p className="mt-2 text-3xl font-semibold text-slate-950">{reviewers.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2"><p className="text-sm font-semibold text-slate-900">Available reviewers</p><p className="mt-2 text-sm text-slate-500">{reviewers.filter((entry)=>String(entry.availability_status)==="available").length} available, {reviewers.filter((entry)=>String(entry.availability_status)==="busy").length} busy.</p></div></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Workflow className="h-5 w-5" />} title="Assignments Under Review" /></CardHeader><CardContent><Table rows={filteredActiveAssignments} /></CardContent></Card></div>
  if (section === "revision") return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Upload className="h-5 w-5" />} title="Revision Management" description="Watch the manuscripts currently in revision and compare them with existing editorial decisions." /></CardHeader><CardContent className="space-y-4">{revisionQueue.length ? filteredRevisionQueue.map((item)=><div key={String(item.assignment_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold text-slate-900">{String(item.title ?? item.manuscript_id)}</p><p className="mt-2 text-sm text-slate-500">Status: {String(item.status ?? "")}</p><p className="text-sm text-slate-500">Assigned on: {String(item.assigned_date ?? "")}</p></div>) : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No manuscripts are currently in the revision queue.</div>}</CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<FileClock className="h-5 w-5" />} title="Decision History for Revisions" /></CardHeader><CardContent><Table rows={filteredDecisions} /></CardContent></Card></div>
  if (section === "analytics") return <div className="grid gap-6 xl:grid-cols-3"><Card className="border-white/70 bg-white/85 backdrop-blur"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Assignments handled</p><p className="mt-2 text-3xl font-semibold text-slate-950">{assignments.length}</p></CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recorded decisions</p><p className="mt-2 text-3xl font-semibold text-slate-950">{decisions.length}</p></CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Available reviewers</p><p className="mt-2 text-3xl font-semibold text-slate-950">{reviewers.filter((entry)=>String(entry.availability_status)==="available").length}</p></CardContent></Card></div>
  return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Editorial Decision Module</CardTitle><CardDescription>Issue editorial recommendations only after reviewer reports have been submitted.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={async (e)=>{e.preventDefault(); setSaving(true); try { await recordEditorDecision({ manuscript_id: Number(decisionForm.manuscript_id), decision_type: decisionForm.decision_type, decision_letter: decisionForm.decision_letter }); setDecisionForm({ manuscript_id: "", decision_type: "major_revision", decision_letter: "" }); await onSaved(); toast.success("Decision saved.") } catch (error) { toast.error(errorText(error, "Unable to save decision.")) } finally { setSaving(false) } }}><div className="space-y-2"><Label>Manuscript</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={decisionForm.manuscript_id} onChange={(e)=>setDecisionForm((p)=>({...p,manuscript_id:e.target.value}))} disabled={decisionEligibleAssignments.length === 0}><option value="">{decisionEligibleAssignments.length ? "Select manuscript" : "No manuscript currently has completed reviewer reports"}</option>{decisionEligibleAssignments.map((entry)=><option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>{String(entry.reference_number ?? entry.manuscript_id)} — {String(entry.title ?? entry.manuscript_id)} ({String(entry.completed_review_count)} review{Number(entry.completed_review_count) === 1 ? "" : "s"})</option>)}</select></div>{decisionEligibleAssignments.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Editorial decisions become available only after at least one reviewer report has been submitted.</div> : null}<div className="space-y-2"><Label>Decision</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={decisionForm.decision_type} onChange={(e)=>setDecisionForm((p)=>({...p,decision_type:e.target.value}))}><option value="accept">Accept</option><option value="minor_revision">Minor revision</option><option value="major_revision">Major revision</option><option value="reject">Reject</option></select></div><div className="space-y-2"><Label>Decision letter</Label><Textarea rows={7} value={decisionForm.decision_letter} onChange={(e)=>setDecisionForm((p)=>({...p,decision_letter:e.target.value}))} /></div><Button type="submit" disabled={saving || decisionEligibleAssignments.length === 0 || !decisionForm.manuscript_id}>{saving ? "Saving..." : "Save decision"}</Button></form></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Recorded decisions</CardTitle></CardHeader><CardContent><Table rows={filteredDecisions} /></CardContent></Card></div>
}
function EicPanels({ section, workspace, onSaved }: { section: string; workspace: WorkspacePayload; onSaved: () => Promise<void> }) {
  const overview = asRecord(workspace.editor_in_chief?.overview)
  const editorDecisions = asArray(workspace.editor_in_chief?.editor_decisions)
  const finalDecisions = asArray(workspace.editor_in_chief?.final_decisions)
  const issues = asArray((workspace.editor_in_chief as Record<string, unknown> | undefined)?.issues)
  const users = asArray(workspace.editor_in_chief?.users)
  const paymentQueue = asArray((workspace.editor_in_chief as Record<string, unknown> | undefined)?.payments)
  const copyrightQueue = asArray((workspace.editor_in_chief as Record<string, unknown> | undefined)?.copyright_forms)
  const receiptReviewQueue = paymentQueue.filter((entry) => String(entry.proof_file_path ?? "").trim() !== "" && String(entry.payment_status ?? "") !== "reviewed")
  const editors = users.filter((entry) => hasEditorWorkspaceRole(entry.roles))
  const reviewers = users.filter((entry) => Array.isArray(entry.roles) && entry.roles.includes("reviewer"))
  const [eicSearch, setEicSearch] = React.useState("")
  const matchesEicSearch = React.useCallback((entry: Record<string, unknown>) => {
    const q = eicSearch.trim().toLowerCase()
    if (!q) return true
    const fields = ["reference_number", "manuscript_id", "title", "decision_type", "final_decision", "status", "author_name", "volume", "issue_number", "publication_year", "publication_date"]
    return fields.some((field) => String(entry?.[field] ?? "").toLowerCase().includes(q))
  }, [eicSearch])
  const filterEic = (list: Array<Record<string, unknown>>) => list.filter(matchesEicSearch)
  const filteredEditorDecisions = filterEic(editorDecisions)
  const filteredFinalDecisions = filterEic(finalDecisions)
  const publishReadyDecisions = finalDecisions.filter((entry) => String(entry.final_decision ?? "").toLowerCase() === "accepted")
  const filteredPublishReadyDecisions = filterEic(publishReadyDecisions)
  const filteredPaymentQueue = filterEic(paymentQueue)
  const filteredCopyrightQueue = filterEic(copyrightQueue)
  const filteredUsers = filterEic(users)
  const filteredReceiptReviewQueue = filterEic(receiptReviewQueue)
  const [form, setForm] = React.useState({ manuscript_id: "", final_decision: "accepted", remarks: "" })
  const [saving, setSaving] = React.useState(false)
  const [publishingId, setPublishingId] = React.useState<number | null>(null)
  const [publishModal, setPublishModal] = React.useState<{ manuscript_id: number; title: string } | null>(null)
  const [publishForm, setPublishForm] = React.useState({ page_numbers: "" })
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
  const openPublishModal = (entry: Record<string, unknown>) => {
    setPublishModal({
      manuscript_id: Number(entry.manuscript_id),
      title: String(entry.title ?? entry.manuscript_id),
    })
    setPublishForm({ page_numbers: String(entry.page_numbers ?? "") })
  }
  const closePublishModal = () => {
    if (publishingId !== null) return
    setPublishModal(null)
    setPublishForm({ page_numbers: "" })
  }
  const publishSelectedManuscript = async (manuscriptId: number, pageNumbers: string) => {
    setPublishingId(manuscriptId)
    try {
      await publishManuscript({ manuscript_id: manuscriptId, page_numbers: pageNumbers })
      await onSaved()
      setPublishModal(null)
      setPublishForm({ page_numbers: "" })
      toast.success("Manuscript published successfully.")
    } catch (error) {
      toast.error(errorText(error, "Unable to publish manuscript."))
    } finally {
      setPublishingId(null)
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
  if (section === "final-decisions") return <><div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>Final Decision Authority</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={async (e)=>{e.preventDefault(); setSaving(true); try { await recordFinalDecision({ manuscript_id: Number(form.manuscript_id), final_decision: form.final_decision, remarks: form.remarks }); setForm({ manuscript_id: "", final_decision: "accepted", remarks: "" }); await onSaved(); toast.success("Final decision saved.") } catch (error) { toast.error(errorText(error, "Unable to save final decision.")) } finally { setSaving(false) } }}><div className="space-y-2"><Label>Editor recommendation</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.manuscript_id} onChange={(e)=>setForm((p)=>({...p,manuscript_id:e.target.value}))}><option value="">Select manuscript</option>{editorDecisions.map((entry)=><option key={String(entry.manuscript_id)} value={String(entry.manuscript_id)}>{String(entry.reference_number ?? entry.manuscript_id)} — {String(entry.title ?? entry.manuscript_id)} | {String(entry.decision_type ?? "")}</option>)}</select></div><div className="space-y-2"><Label>Final decision</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.final_decision} onChange={(e)=>setForm((p)=>({...p,final_decision:e.target.value}))}><option value="accepted">Accepted</option><option value="rejected">Rejected</option></select></div><div className="space-y-2"><Label>Remarks</Label><Textarea rows={7} value={form.remarks} onChange={(e)=>setForm((p)=>({...p,remarks:e.target.value}))} /></div><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save final decision"}</Button></form></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Workflow className="h-5 w-5" />} title="Publish Accepted Manuscripts" description="Publish manuscripts that already have an Editor-in-Chief final acceptance." /></CardHeader><CardContent className="space-y-3">{filteredPublishReadyDecisions.length ? filteredPublishReadyDecisions.map((entry)=>{ const manuscriptId = Number(entry.manuscript_id); const alreadyPublished = String(entry.status ?? "").toLowerCase() === "published"; return <div key={String(entry.final_decision_id ?? entry.manuscript_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold text-slate-900">{String(entry.title ?? entry.manuscript_id)}</p><p className="text-sm text-slate-500">Ref: {String(entry.reference_number ?? entry.manuscript_id)} | Final decision: {String(entry.final_decision ?? "")} | Approved: {String(entry.approval_date ?? "")}</p>{alreadyPublished ? <p className="mt-1 text-sm font-medium text-emerald-700">published</p> : null}</div><Button size="sm" onClick={()=>openPublishModal(entry)} disabled={alreadyPublished || publishingId === manuscriptId}>{alreadyPublished ? "Published" : publishingId === manuscriptId ? "Publishing..." : "Publish manuscript"}</Button></div></div>}) : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No accepted final decisions are waiting for publication.</div>}</CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Final decisions</CardTitle><Input className="max-w-xs" placeholder="Search ref #, ID, title" value={eicSearch} onChange={(e)=>setEicSearch(e.target.value)} /></CardHeader><CardContent><Table rows={filteredFinalDecisions} /></CardContent></Card></div>{publishModal ? <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-xl rounded-3xl border border-white/70 bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h3 className="display-modal text-slate-950">Publish Manuscript</h3><p className="mt-2 text-sm text-slate-600">{publishModal.title}</p></div><button type="button" onClick={closePublishModal} className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50" disabled={publishingId !== null}>Close</button></div><form className="mt-6 space-y-4" onSubmit={async (e)=>{ e.preventDefault(); if (!publishForm.page_numbers.trim()) { toast.error("Enter page numbers first."); return } await publishSelectedManuscript(publishModal.manuscript_id, publishForm.page_numbers.trim()) }}><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">{issues.length ? `Publishing will use the latest issue on record: Vol. ${String(issues[0]?.volume ?? "")}, Issue ${String(issues[0]?.issue_number ?? "")} (${String(issues[0]?.publication_year ?? "")})` : "No issue exists yet. Create one first from Manage Issues before publishing."}</div><div className="space-y-2"><Label>Page numbers</Label><Input value={publishForm.page_numbers} onChange={(e)=>setPublishForm((prev)=>({...prev, page_numbers: e.target.value}))} placeholder="12-24" /></div><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={closePublishModal} disabled={publishingId !== null}>Cancel</Button><Button type="submit" disabled={publishingId !== null || issues.length === 0}>{publishingId !== null ? "Publishing..." : "Publish manuscript"}</Button></div></form></div></div> : null}</>
  if (section === "overview") return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<BookMarked className="h-5 w-5" />} title="Journal Overview Panel" /></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{Object.entries(overview).map(([key, value]) => <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{key.replaceAll("_", " ")}</p><p className="mt-2 text-3xl font-semibold text-slate-950">{String(value)}</p></div>)}</CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader className="flex flex-wrap items-center justify-between gap-3"><CardHeading icon={<FileClock className="h-5 w-5" />} title="Editor Decision Feed" /><Input className="max-w-xs" placeholder="Search ref #, ID, title" value={eicSearch} onChange={(e)=>setEicSearch(e.target.value)} /></CardHeader><CardContent><Table rows={filteredEditorDecisions} /></CardContent></Card></div>
  if (section === "board") return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader className="flex flex-wrap items-center justify-between gap-3"><CardHeading icon={<Users className="h-5 w-5" />} title="Editorial Board Management" description="Track the active editor and reviewer base that supports the journal pipeline." /><Input className="max-w-xs" placeholder="Search ref #, ID, name" value={eicSearch} onChange={(e)=>setEicSearch(e.target.value)} /></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Editors</p><p className="mt-2 text-3xl font-semibold text-slate-950">{editors.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Reviewers</p><p className="mt-2 text-3xl font-semibold text-slate-950">{reviewers.length}</p></div><div className="min-w-0 md:col-span-2"><Table rows={filteredUsers} /></div></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Microscope className="h-5 w-5" />} title="Reviewer and Editor Roster" /></CardHeader><CardContent><Table rows={filteredUsers} /></CardContent></Card></div>
  if (section === "ethics") return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<ShieldCheck className="h-5 w-5" />} title="Ethics and Compliance" description="Review the queue of decisions, payment records, and copyright submissions that need executive oversight." /></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Payment queue</p><p className="mt-2 text-3xl font-semibold text-slate-950">{paymentQueue.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Receipt review queue</p><p className="mt-2 text-3xl font-semibold text-slate-950">{receiptReviewQueue.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Copyright queue</p><p className="mt-2 text-3xl font-semibold text-slate-950">{copyrightQueue.length}</p></div><div className="min-w-0 md:col-span-2"><Table rows={filteredEditorDecisions} /></div></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Workflow className="h-5 w-5" />} title="Submission Compliance Queues" /></CardHeader><CardContent className="grid gap-6"><div className="min-w-0"><p className="mb-3 text-sm font-semibold text-slate-900">Receipt review actions</p><div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 max-h-[22rem] overflow-y-auto">{receiptReviewQueue.length ? filteredReceiptReviewQueue.map((entry)=><div key={String(entry.payment_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3"><div><p className="font-semibold text-slate-900">{String(entry.title ?? entry.manuscript_id)}</p><p className="text-sm text-slate-500">Author: {String(entry.author_name ?? "")} | Ref: {String(entry.payment_reference ?? "")}</p><div className="mt-2"><PaymentStatusBadge status={paymentLifecycleStatus(entry)} /></div></div><div className="flex flex-wrap gap-2"><Button size="sm" onClick={async ()=>{ try { await reviewPaymentReceipt({ payment_id: Number(entry.payment_id), action: "review" }); await onSaved(); toast.success("Payment receipt marked as reviewed.") } catch (error) { toast.error(errorText(error, "Unable to review receipt.")) } }}>Mark reviewed</Button><Button size="sm" variant="outline" onClick={async ()=>{ try { await reviewPaymentReceipt({ payment_id: Number(entry.payment_id), action: "reject" }); await onSaved(); toast.success("Payment receipt rejected.") } catch (error) { toast.error(errorText(error, "Unable to reject receipt.")) } }}>Reject</Button></div></div></div>) : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No payment receipts are waiting for review.</div>}</div></div><div className="min-w-0"><p className="mb-3 text-sm font-semibold text-slate-900">Payments</p><Table rows={filteredPaymentQueue} /></div><div className="min-w-0"><p className="mb-3 text-sm font-semibold text-slate-900">Copyright forms</p><Table rows={filteredCopyrightQueue} /></div></CardContent></Card></div>
  if (section === "applications") return <ApplicationsReview onSaved={onSaved} />
  if (section === "impact") return <div className="grid gap-6 xl:grid-cols-3"><Card className="border-white/70 bg-white/85 backdrop-blur"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Editor decisions</p><p className="mt-2 text-3xl font-semibold text-slate-950">{filteredEditorDecisions.length}</p></CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Final decisions</p><p className="mt-2 text-3xl font-semibold text-slate-950">{filteredFinalDecisions.length}</p></CardContent></Card><Card className="border-white/70 bg-white/85 backdrop-blur"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Published readiness</p><p className="mt-2 text-3xl font-semibold text-slate-950">{String(overview.published ?? 0)}</p></CardContent></Card></div>
  if (section === "manage-issues") return <><div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<BookMarked className="h-5 w-5" />} title="Manage Issues" description="Create issue records that publication will use automatically." /></CardHeader><CardContent><form className="space-y-4" onSubmit={createIssue}><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Volume</Label><Input value={issueForm.volume} onChange={(e)=>setIssueForm((prev)=>({...prev, volume: e.target.value}))} placeholder="1" /></div><div className="space-y-2"><Label>Issue number</Label><Input value={issueForm.issue_number} onChange={(e)=>setIssueForm((prev)=>({...prev, issue_number: e.target.value}))} placeholder="1" /></div></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Publication year</Label><Input value={issueForm.publication_year} onChange={(e)=>setIssueForm((prev)=>({...prev, publication_year: e.target.value}))} placeholder="2026" /></div><div className="space-y-2"><Label>Publication date</Label><Input type="date" value={issueForm.publication_date} onChange={(e)=>setIssueForm((prev)=>({...prev, publication_date: e.target.value}))} /></div></div><div className="space-y-2"><Label>Status</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={issueForm.status} onChange={(e)=>setIssueForm((prev)=>({...prev, status: e.target.value}))}><option value="upcoming">Upcoming</option><option value="published">Published</option></select></div><Button type="submit" disabled={issueSaving}>{issueSaving ? "Saving..." : "Create issue"}</Button></form></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader className="flex flex-wrap items-center justify-between gap-3"><CardHeading icon={<BookMarked className="h-5 w-5" />} title="Issue Registry" description="The latest issue in this list will be used during publication." /><Input className="max-w-xs" placeholder="Search volume, issue, year" value={eicSearch} onChange={(e)=>setEicSearch(e.target.value)} /></CardHeader><CardContent><div className="space-y-3">{filterEic(issues).length ? filterEic(issues).map((issue)=>{ const issueId = Number(issue.issue_id); return <div key={String(issue.issue_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold text-slate-900">Volume {String(issue.volume ?? "")}, Issue {String(issue.issue_number ?? "")}</p><p className="text-sm text-slate-500">Year: {String(issue.publication_year ?? "")} | Date: {String(issue.publication_date ?? "")} | Status: {String(issue.status ?? "")}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>openIssueEditModal(issue)} disabled={issueEditingId === issueId || issueDeletingId === issueId}>Edit</Button><Button size="sm" variant="outline" onClick={async ()=>{ await deleteIssue(issueId) }} disabled={issueDeletingId === issueId || issueEditingId === issueId}>{issueDeletingId === issueId ? "Deleting..." : "Delete"}</Button></div></div></div>}) : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No issues have been created yet.</div>}</div></CardContent></Card></div>{issueEditModal ? <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-lg rounded-3xl border border-white/70 bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h3 className="display-modal text-slate-950">Edit Issue Status</h3><p className="mt-2 text-sm text-slate-600">{issueEditModal.label}</p></div><button type="button" onClick={closeIssueEditModal} className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50" disabled={issueEditingId !== null}>Close</button></div><form className="mt-6 space-y-4" onSubmit={editIssueStatus}><div className="space-y-2"><Label>Status</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={issueEditStatus} onChange={(e)=>setIssueEditStatus(e.target.value)}><option value="upcoming">Upcoming</option><option value="published">Published</option></select></div><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={closeIssueEditModal} disabled={issueEditingId !== null}>Cancel</Button><Button type="submit" disabled={issueEditingId !== null}>{issueEditingId !== null ? "Saving..." : "Save changes"}</Button></div></form></div></div> : null}</>
  if (section === "scheduling") return <><div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader className="flex flex-wrap items-center justify-between gap-3"><CardHeading icon={<BookMarked className="h-5 w-5" />} title="Publication Scheduling" description="Use accepted and finalized decisions to plan issue release order and production readiness." /><Input className="max-w-xs" placeholder="Search ref #, ID, title" value={eicSearch} onChange={(e)=>setEicSearch(e.target.value)} /></CardHeader><CardContent className="space-y-3">{filteredPublishReadyDecisions.length ? filteredPublishReadyDecisions.map((entry)=>{ const manuscriptId = Number(entry.manuscript_id); const alreadyPublished = String(entry.status ?? "").toLowerCase() === "published"; return <div key={String(entry.final_decision_id ?? entry.manuscript_id)} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold text-slate-900">{String(entry.title ?? entry.manuscript_id)}</p><p className="text-sm text-slate-500">Ref: {String(entry.reference_number ?? entry.manuscript_id)} | Approved: {String(entry.approval_date ?? "")}</p><p className="mt-1 text-sm text-slate-500">{String(entry.remarks ?? "Ready for publication scheduling and release.")}</p>{alreadyPublished ? <p className="mt-1 text-sm font-medium text-emerald-700">published</p> : null}</div><Button size="sm" onClick={()=>openPublishModal(entry)} disabled={alreadyPublished || publishingId === manuscriptId}>{alreadyPublished ? "Published" : publishingId === manuscriptId ? "Publishing..." : "Publish now"}</Button></div></div>}) : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No accepted manuscripts are currently ready to publish.</div>}</CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Workflow className="h-5 w-5" />} title="Decision Pipeline" /></CardHeader><CardContent><Table rows={filteredEditorDecisions} /></CardContent></Card></div>{publishModal ? <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-xl rounded-3xl border border-white/70 bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h3 className="display-modal text-slate-950">Publish Manuscript</h3><p className="mt-2 text-sm text-slate-600">{publishModal.title}</p></div><button type="button" onClick={closePublishModal} className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50" disabled={publishingId !== null}>Close</button></div><form className="mt-6 space-y-4" onSubmit={async (e)=>{ e.preventDefault(); if (!publishForm.page_numbers.trim()) { toast.error("Enter page numbers first."); return } await publishSelectedManuscript(publishModal.manuscript_id, publishForm.page_numbers.trim()) }}><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">{issues.length ? `Publishing will use the latest issue on record: Vol. ${String(issues[0]?.volume ?? "")}, Issue ${String(issues[0]?.issue_number ?? "")} (${String(issues[0]?.publication_year ?? "")})` : "No issue exists yet. Create one first from Manage Issues before publishing."}</div><div className="space-y-2"><Label>Page numbers</Label><Input value={publishForm.page_numbers} onChange={(e)=>setPublishForm((prev)=>({...prev, page_numbers: e.target.value}))} placeholder="12-24" /></div><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={closePublishModal} disabled={publishingId !== null}>Cancel</Button><Button type="submit" disabled={publishingId !== null || issues.length === 0}>{publishingId !== null ? "Publishing..." : "Publish manuscript"}</Button></div></form></div></div> : null}</>
  if (section === "monitoring") return <div className="grid gap-6"><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Globe2 className="h-5 w-5" />} title="System Monitoring" description="Watch user distribution and manuscript flow from the Editor-in-Chief control center." /></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Users in workspace</p><p className="mt-2 text-3xl font-semibold text-slate-950">{users.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Accepted manuscripts</p><p className="mt-2 text-3xl font-semibold text-slate-950">{String(overview.accepted ?? 0)}</p></div><div className="min-w-0 md:col-span-2"><Table rows={filteredUsers} /></div></CardContent></Card><Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur"><CardHeader className="flex flex-wrap items-center justify-between gap-3"><CardHeading icon={<FileClock className="h-5 w-5" />} title="Recent Executive Decisions" /><Input className="max-w-xs" placeholder="Search ref #, ID, title" value={eicSearch} onChange={(e)=>setEicSearch(e.target.value)} /></CardHeader><CardContent><Table rows={filteredFinalDecisions} /></CardContent></Card></div>
  return <Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>{section.replaceAll("-"," ")}</CardTitle></CardHeader><CardContent><Table rows={filteredEditorDecisions} /></CardContent></Card>
}
function AdminUsersPanel({ workspace, onSaved }: { workspace: WorkspacePayload; onSaved: () => Promise<void> }) {
  const users = asArray(workspace.admin?.users)
  const [form, setForm] = React.useState({ user_id: "", role: "reviewer", status: "active" })
  const [saving, setSaving] = React.useState(false)
  const [showCreateModal, setShowCreateModal] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [createForm, setCreateForm] = React.useState({ first_name: "", last_name: "", email: "", password: "", institution: "", country: "", phone: "", orcid_id: "", role: "author", status: "active", expertise_area: "" })
  const [editingUser, setEditingUser] = React.useState<Record<string, unknown> | null>(null)
  const [editSaving, setEditSaving] = React.useState(false)
  const [editForm, setEditForm] = React.useState({ user_id: "", first_name: "", last_name: "", email: "", institution: "", country: "", phone: "", orcid_id: "", status: "active" })

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
        <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">Unverified</Badge>
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
                  await updateUserAccess({ user_id: Number(form.user_id), role: form.role, status: form.status })
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
                            size="sm"
                            variant="destructive"
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
                            <LogOut className="h-4 w-4 rotate-180" />
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

      {showCreateModal ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-3xl rounded-3xl border border-white/70 bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h3 className="display-modal text-slate-950">Create New User</h3><p className="mt-2 text-sm text-slate-600">Add any publishing account, from author and reviewer through the editorial chain to administrator, from one modal form.</p></div><button type="button" onClick={()=>setShowCreateModal(false)} className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50">Close</button></div><form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={async (e)=>{e.preventDefault(); setCreating(true); try { await createAdminUser(createForm); toast.success("User created successfully."); setShowCreateModal(false); setCreateForm({ first_name: "", last_name: "", email: "", password: "", institution: "", country: "", phone: "", orcid_id: "", role: "author", status: "active", expertise_area: "" }); await onSaved() } catch (error) { toast.error(errorText(error, "Unable to create user.")) } finally { setCreating(false) } }}><div className="space-y-2"><Label>First name</Label><Input value={createForm.first_name} onChange={(e)=>setCreateForm((p)=>({...p,first_name:e.target.value}))} required /></div><div className="space-y-2"><Label>Last name</Label><Input value={createForm.last_name} onChange={(e)=>setCreateForm((p)=>({...p,last_name:e.target.value}))} required /></div><div className="space-y-2 md:col-span-2"><Label>Email</Label><Input type="email" value={createForm.email} onChange={(e)=>setCreateForm((p)=>({...p,email:e.target.value}))} required /></div><div className="space-y-2"><Label>Password</Label><Input type="password" minLength={8} value={createForm.password} onChange={(e)=>setCreateForm((p)=>({...p,password:e.target.value}))} required /></div><div className="space-y-2"><Label>Role</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={createForm.role} onChange={(e)=>setCreateForm((p)=>({...p,role:e.target.value}))}>{userRoleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div className="space-y-2"><Label>Status</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={createForm.status} onChange={(e)=>setCreateForm((p)=>({...p,status:e.target.value}))}><option value="active">Active</option><option value="inactive">Inactive</option></select></div><div className="space-y-2"><Label>Institution</Label><Input value={createForm.institution} onChange={(e)=>setCreateForm((p)=>({...p,institution:e.target.value}))} /></div><div className="space-y-2"><Label>Country</Label><Input value={createForm.country} onChange={(e)=>setCreateForm((p)=>({...p,country:e.target.value}))} /></div><div className="space-y-2"><Label>Phone</Label><Input value={createForm.phone} onChange={(e)=>setCreateForm((p)=>({...p,phone:e.target.value}))} /></div><div className="space-y-2"><Label>ORCID</Label><Input value={createForm.orcid_id} onChange={(e)=>setCreateForm((p)=>({...p,orcid_id:e.target.value}))} /></div>{createForm.role === "reviewer" ? <div className="space-y-2 md:col-span-2"><Label>Expertise area</Label><Textarea rows={4} value={createForm.expertise_area} onChange={(e)=>setCreateForm((p)=>({...p,expertise_area:e.target.value}))} /></div> : null}<div className="md:col-span-2 flex justify-end gap-3"><Button type="button" variant="outline" onClick={()=>setShowCreateModal(false)}>Cancel</Button><Button type="submit" disabled={creating}>{creating ? "Creating..." : "Create user"}</Button></div></form></div></div> : null}

      {editingUser ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-3xl rounded-3xl border border-white/70 bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h3 className="display-modal text-slate-950">Edit User</h3><p className="mt-2 text-sm text-slate-600">Update basic user information directly from current users.</p></div><button type="button" onClick={()=>setEditingUser(null)} className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50">Close</button></div><form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={async (e)=>{e.preventDefault(); setEditSaving(true); try { await editAdminUser({ ...editForm, user_id: Number(editForm.user_id) }); await onSaved(); toast.success("User updated."); setEditingUser(null) } catch (error) { toast.error(errorText(error, "Unable to edit user.")) } finally { setEditSaving(false) } }}><div className="space-y-2"><Label>First name</Label><Input value={editForm.first_name} onChange={(e)=>setEditForm((p)=>({...p, first_name: e.target.value}))} required /></div><div className="space-y-2"><Label>Last name</Label><Input value={editForm.last_name} onChange={(e)=>setEditForm((p)=>({...p, last_name: e.target.value}))} required /></div><div className="space-y-2 md:col-span-2"><Label>Email</Label><Input type="email" value={editForm.email} onChange={(e)=>setEditForm((p)=>({...p, email: e.target.value}))} required /></div><div className="space-y-2"><Label>Institution</Label><Input value={editForm.institution} onChange={(e)=>setEditForm((p)=>({...p, institution: e.target.value}))} /></div><div className="space-y-2"><Label>Country</Label><Input value={editForm.country} onChange={(e)=>setEditForm((p)=>({...p, country: e.target.value}))} /></div><div className="space-y-2"><Label>Phone</Label><Input value={editForm.phone} onChange={(e)=>setEditForm((p)=>({...p, phone: e.target.value}))} /></div><div className="space-y-2"><Label>ORCID</Label><Input value={editForm.orcid_id} onChange={(e)=>setEditForm((p)=>({...p, orcid_id: e.target.value}))} /></div><div className="space-y-2"><Label>Status</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={editForm.status} onChange={(e)=>setEditForm((p)=>({...p, status: e.target.value}))}><option value="active">Active</option><option value="inactive">Inactive</option></select></div><div className="md:col-span-2 flex justify-end gap-3"><Button type="button" variant="outline" onClick={()=>setEditingUser(null)}>Cancel</Button><Button type="submit" disabled={editSaving}>{editSaving ? "Saving..." : "Save user"}</Button></div></form></div></div> : null}
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

  return <Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardHeading icon={<Settings2 className="h-5 w-5" />} title="System Settings" description="Admin can manage journal branding, public page content, and public media from one settings workspace." /></CardHeader><CardContent className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><div className="space-y-6 rounded-3xl border border-slate-200 bg-slate-50 p-5"><div className="space-y-4"><div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">{logoFile ? <img src={URL.createObjectURL(logoFile)} alt={settings.journal_name} className="h-full w-full object-cover" /> : settings.logo_path ? <img src={resolveApiAssetUrl(settings.logo_path)} alt={settings.journal_name} className="h-full w-full object-cover" /> : <span className="display-acronym text-3xl text-jostum-700">{settings.journal_acronym}</span>}</div><div><p className="font-semibold text-slate-900">{settings.journal_name}</p><p className="text-sm text-slate-500">{settings.journal_acronym}</p></div><FileDropzone label="Journal logo" accept="image/png,image/jpeg,image/webp" helperText="Accepted: PNG, JPG, WEBP. Maximum 5MB." file={logoFile} error={logoError} progress={logoUploadProgress} progressLabel="Uploading journal logo" onFileSelect={(file)=>{ if (!file) { setLogoFile(null); setLogoError(""); return } const error = validateUploadFile(file, ["image/png", "image/jpeg", "image/webp"], "Journal logo", 5 * 1024 * 1024); if (error) { setLogoFile(null); setLogoError(error); return } setLogoFile(file); setLogoError("") }} onRemove={()=>{ setLogoFile(null); setLogoError(""); setLogoUploadProgress(0) }} /><Button type="button" disabled={uploading || !logoFile} onClick={async ()=>{ if (!logoFile) return; setUploading(true); setLogoUploadProgress(0); try { await uploadJournalLogo(logoFile, { onProgress: setLogoUploadProgress }); await onRefresh(); setLogoFile(null); setLogoError(""); toast.success("Journal logo updated.") } catch (error) { toast.error(errorText(error, "Unable to upload logo.")) } finally { setUploading(false); setTimeout(() => setLogoUploadProgress(0), 500) } }}>{uploading ? "Uploading..." : "Update logo"}</Button></div><div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm font-semibold text-slate-900">Public page media uploads</p><p className="text-xs leading-6 text-slate-500">Homepage and public feature images are upload-only. URL textboxes have been removed.</p><div className="space-y-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Discover Open Access</p><div className="h-28 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">{mediaFiles.discover ? <img src={URL.createObjectURL(mediaFiles.discover)} alt="Discover Open Access" className="h-full w-full object-cover" /> : settings.discover_open_access_image ? <img src={resolveApiAssetUrl(settings.discover_open_access_image)} alt="Discover Open Access" className="h-full w-full object-cover" /> : null}</div><FileDropzone label="Discover Open Access image" accept="image/png,image/jpeg,image/webp" helperText="Accepted: PNG, JPG, WEBP. Maximum 5MB." file={mediaFiles.discover} error={mediaErrors.discover} onFileSelect={(file)=>assignMedia("discover", file)} onRemove={()=>assignMedia("discover", null)} /></div><div className="space-y-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Publish with Us</p><div className="h-28 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">{mediaFiles.publish ? <img src={URL.createObjectURL(mediaFiles.publish)} alt="Publish with Us" className="h-full w-full object-cover" /> : settings.publish_with_us_image ? <img src={resolveApiAssetUrl(settings.publish_with_us_image)} alt="Publish with Us" className="h-full w-full object-cover" /> : null}</div><FileDropzone label="Publish with Us image" accept="image/png,image/jpeg,image/webp" helperText="Accepted: PNG, JPG, WEBP. Maximum 5MB." file={mediaFiles.publish} error={mediaErrors.publish} onFileSelect={(file)=>assignMedia("publish", file)} onRemove={()=>assignMedia("publish", null)} /></div><div className="space-y-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Track Your Research</p><div className="h-28 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">{mediaFiles.track ? <img src={URL.createObjectURL(mediaFiles.track)} alt="Track Your Research" className="h-full w-full object-cover" /> : settings.track_research_image ? <img src={resolveApiAssetUrl(settings.track_research_image)} alt="Track Your Research" className="h-full w-full object-cover" /> : null}</div><FileDropzone label="Track Your Research image" accept="image/png,image/jpeg,image/webp" helperText="Accepted: PNG, JPG, WEBP. Maximum 5MB." file={mediaFiles.track} error={mediaErrors.track} onFileSelect={(file)=>assignMedia("track", file)} onRemove={()=>assignMedia("track", null)} /></div></div></div><form className="space-y-5" onSubmit={async (e)=>{ e.preventDefault(); setSaving(true); setSettingsUploadProgress(0); try { const payload = new FormData(); payload.append("journal_name", form.journal_name); payload.append("journal_acronym", form.journal_acronym); payload.append("homepage_tagline", form.homepage_tagline); payload.append("homepage_intro", form.homepage_intro); payload.append("home_topbar_text", form.home_topbar_text); payload.append("featured_articles_title", form.featured_articles_title); payload.append("featured_articles_description", form.featured_articles_description); payload.append("research_pathways_title", form.research_pathways_title); payload.append("call_for_papers_title", form.call_for_papers_title); payload.append("call_for_papers_description", form.call_for_papers_description); payload.append("call_for_papers_cta_title", form.call_for_papers_cta_title); payload.append("call_for_papers_cta_body", form.call_for_papers_cta_body); payload.append("call_for_papers_notes", JSON.stringify(parseLines(form.callForPapersNotesText))); payload.append("trending_research_title", form.trending_research_title); payload.append("trending_research_description", form.trending_research_description); payload.append("publishing_overview_title", form.publishing_overview_title); payload.append("publishing_overview_description", form.publishing_overview_description); payload.append("workflow_snapshot_title", form.workflow_snapshot_title); payload.append("workflow_snapshot_description", form.workflow_snapshot_description); payload.append("discover_open_access_title", form.discover_open_access_title); payload.append("discover_open_access_body", form.discover_open_access_body); payload.append("discover_open_access_points", JSON.stringify(parseLines(form.discoverOpenAccessPointsText))); payload.append("publish_with_us_title", form.publish_with_us_title); payload.append("publish_with_us_body", form.publish_with_us_body); payload.append("publish_with_us_points", JSON.stringify(parseLines(form.publishWithUsPointsText))); payload.append("track_research_title", form.track_research_title); payload.append("track_research_body", form.track_research_body); payload.append("call_for_papers", JSON.stringify(parseCalls(form.callForPapersText))); payload.append("trending_research", JSON.stringify(parseTrending(form.trendingResearchText))); payload.append("aims", JSON.stringify(parseLines(form.aimsText))); payload.append("scope", JSON.stringify(parseLines(form.scopeText))); payload.append("objectives", JSON.stringify(parseLines(form.objectivesText))); payload.append("review_specializations", JSON.stringify(parseLines(form.reviewSpecializationsText))); payload.append("footer_summary", form.footer_summary); payload.append("footer_bottom_text", form.footer_bottom_text); payload.append("footer_bottom_tagline", form.footer_bottom_tagline); if (mediaFiles.discover) payload.append("discover_open_access_image", mediaFiles.discover); if (mediaFiles.publish) payload.append("publish_with_us_image", mediaFiles.publish); if (mediaFiles.track) payload.append("track_research_image", mediaFiles.track); await updateAdminSettings(payload, { onProgress: setSettingsUploadProgress }); await onRefresh(); setMediaFiles({ discover: null, publish: null, track: null }); setMediaErrors({ discover: "", publish: "", track: "" }); toast.success("System settings updated.") } catch (error) { toast.error(errorText(error, "Unable to update settings.")) } finally { setSaving(false); setTimeout(() => setSettingsUploadProgress(0), 500) } }}><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Journal name</Label><Input value={form.journal_name} onChange={(e)=>setForm((p)=>({...p, journal_name: e.target.value}))} /></div><div className="space-y-2"><Label>Journal acronym</Label><Input value={form.journal_acronym} onChange={(e)=>setForm((p)=>({...p, journal_acronym: e.target.value}))} /></div></div><div className="space-y-2"><Label>Top bar text</Label><Input value={form.home_topbar_text} onChange={(e)=>setForm((p)=>({...p, home_topbar_text: e.target.value}))} /></div><div className="space-y-2"><Label>Homepage tagline</Label><Textarea rows={3} value={form.homepage_tagline} onChange={(e)=>setForm((p)=>({...p, homepage_tagline: e.target.value}))} /></div><div className="space-y-2"><Label>Homepage introduction</Label><Textarea rows={4} value={form.homepage_intro} onChange={(e)=>setForm((p)=>({...p, homepage_intro: e.target.value}))} /></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Featured Articles title</Label><Input value={form.featured_articles_title} onChange={(e)=>setForm((p)=>({...p, featured_articles_title: e.target.value}))} /></div><div className="space-y-2"><Label>Featured Articles description</Label><Input value={form.featured_articles_description} onChange={(e)=>setForm((p)=>({...p, featured_articles_description: e.target.value}))} /></div></div><div className="space-y-2"><Label>Research pathways title</Label><Input value={form.research_pathways_title} onChange={(e)=>setForm((p)=>({...p, research_pathways_title: e.target.value}))} /></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Call for Papers section title</Label><Input value={form.call_for_papers_title} onChange={(e)=>setForm((p)=>({...p, call_for_papers_title: e.target.value}))} /></div><div className="space-y-2"><Label>Trending Research section title</Label><Input value={form.trending_research_title} onChange={(e)=>setForm((p)=>({...p, trending_research_title: e.target.value}))} /></div></div><div className="space-y-2"><Label>Call for Papers section description</Label><Textarea rows={3} value={form.call_for_papers_description} onChange={(e)=>setForm((p)=>({...p, call_for_papers_description: e.target.value}))} /></div><div className="space-y-2"><Label>Trending Research section description</Label><Textarea rows={3} value={form.trending_research_description} onChange={(e)=>setForm((p)=>({...p, trending_research_description: e.target.value}))} /></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Publishing overview title</Label><Input value={form.publishing_overview_title} onChange={(e)=>setForm((p)=>({...p, publishing_overview_title: e.target.value}))} /></div><div className="space-y-2"><Label>Workflow snapshot title</Label><Input value={form.workflow_snapshot_title} onChange={(e)=>setForm((p)=>({...p, workflow_snapshot_title: e.target.value}))} /></div></div><div className="space-y-2"><Label>Publishing overview description</Label><Textarea rows={3} value={form.publishing_overview_description} onChange={(e)=>setForm((p)=>({...p, publishing_overview_description: e.target.value}))} /></div><div className="space-y-2"><Label>Workflow snapshot description</Label><Textarea rows={3} value={form.workflow_snapshot_description} onChange={(e)=>setForm((p)=>({...p, workflow_snapshot_description: e.target.value}))} /></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Discover Open Access title</Label><Input value={form.discover_open_access_title} onChange={(e)=>setForm((p)=>({...p, discover_open_access_title: e.target.value}))} /></div><div className="space-y-2"><Label>Publish with Us title</Label><Input value={form.publish_with_us_title} onChange={(e)=>setForm((p)=>({...p, publish_with_us_title: e.target.value}))} /></div></div><div className="space-y-2"><Label>Discover Open Access body</Label><Textarea rows={4} value={form.discover_open_access_body} onChange={(e)=>setForm((p)=>({...p, discover_open_access_body: e.target.value}))} /></div><div className="space-y-2"><Label>Discover Open Access detail points</Label><Textarea rows={4} value={form.discoverOpenAccessPointsText} onChange={(e)=>setForm((p)=>({...p, discoverOpenAccessPointsText: e.target.value}))} /><p className="text-xs text-slate-500">One point per line.</p></div><div className="space-y-2"><Label>Publish with Us body</Label><Textarea rows={4} value={form.publish_with_us_body} onChange={(e)=>setForm((p)=>({...p, publish_with_us_body: e.target.value}))} /></div><div className="space-y-2"><Label>Publish with Us detail points</Label><Textarea rows={4} value={form.publishWithUsPointsText} onChange={(e)=>setForm((p)=>({...p, publishWithUsPointsText: e.target.value}))} /><p className="text-xs text-slate-500">One point per line.</p></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Track Your Research title</Label><Input value={form.track_research_title} onChange={(e)=>setForm((p)=>({...p, track_research_title: e.target.value}))} /></div><div className="space-y-2"><Label>Track Your Research body</Label><Textarea rows={3} value={form.track_research_body} onChange={(e)=>setForm((p)=>({...p, track_research_body: e.target.value}))} /></div></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Call for Papers CTA title</Label><Input value={form.call_for_papers_cta_title} onChange={(e)=>setForm((p)=>({...p, call_for_papers_cta_title: e.target.value}))} /></div><div className="space-y-2"><Label>Call for Papers CTA body</Label><Textarea rows={3} value={form.call_for_papers_cta_body} onChange={(e)=>setForm((p)=>({...p, call_for_papers_cta_body: e.target.value}))} /></div></div><div className="space-y-2"><Label>Call for Papers notes</Label><Textarea rows={4} value={form.callForPapersNotesText} onChange={(e)=>setForm((p)=>({...p, callForPapersNotesText: e.target.value}))} /><p className="text-xs text-slate-500">One note per line.</p></div><div className="space-y-2"><Label>Reviewer specialization areas</Label><Textarea rows={6} value={form.reviewSpecializationsText} onChange={(e)=>setForm((p)=>({...p, reviewSpecializationsText: e.target.value}))} /><p className="text-xs text-slate-500">One specialization area per line. Reviewers will be able to select more than one area during onboarding.</p></div><div className="space-y-2"><Label>Call for Papers entries</Label><Textarea rows={6} value={form.callForPapersText} onChange={(e)=>setForm((p)=>({...p, callForPapersText: e.target.value}))} /><p className="text-xs text-slate-500">Format each line as: Title | YYYY-MM-DD | Summary</p></div><div className="space-y-2"><Label>Trending Research entries</Label><Textarea rows={6} value={form.trendingResearchText} onChange={(e)=>setForm((p)=>({...p, trendingResearchText: e.target.value}))} /><p className="text-xs text-slate-500">Format each line as: Title | Area | Summary</p></div><div className="space-y-2"><Label>Aims</Label><Textarea rows={5} value={form.aimsText} onChange={(e)=>setForm((p)=>({...p, aimsText: e.target.value}))} /></div><div className="space-y-2"><Label>Scope</Label><Textarea rows={6} value={form.scopeText} onChange={(e)=>setForm((p)=>({...p, scopeText: e.target.value}))} /></div><div className="space-y-2"><Label>Objectives</Label><Textarea rows={5} value={form.objectivesText} onChange={(e)=>setForm((p)=>({...p, objectivesText: e.target.value}))} /></div><div className="space-y-2"><Label>Footer summary</Label><Textarea rows={3} value={form.footer_summary} onChange={(e)=>setForm((p)=>({...p, footer_summary: e.target.value}))} /></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Footer bottom text</Label><Input value={form.footer_bottom_text} onChange={(e)=>setForm((p)=>({...p, footer_bottom_text: e.target.value}))} /></div><div className="space-y-2"><Label>Footer bottom tagline</Label><Input value={form.footer_bottom_tagline} onChange={(e)=>setForm((p)=>({...p, footer_bottom_tagline: e.target.value}))} /></div></div>{settingsUploadProgress > 0 ? <div className="space-y-2"><div className="flex items-center justify-between text-xs text-slate-500"><span>Uploading settings media</span><span>{settingsUploadProgress}%</span></div><div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-jostum-700 transition-all" style={{ width: `${Math.min(settingsUploadProgress, 100)}%` }} /></div></div> : null}<Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save settings"}</Button></form></CardContent></Card>
}
function AdminOverviewPanel({ workspace, onSaved }: { workspace: WorkspacePayload; onSaved: () => Promise<void> }) {
  const users = asArray(workspace.admin?.users)
  const journals = asArray(workspace.admin?.journals)
  const issues = asArray(workspace.admin?.issues)
  const manuscripts = asArray(workspace.admin?.manuscripts)
  const [manuscriptSearch, setManuscriptSearch] = React.useState("")
  const normalize = (value: unknown) => String(value ?? "").toLowerCase()
  const filteredManuscripts = manuscriptSearch.trim() === ""
    ? manuscripts
    : manuscripts.filter((entry) => {
        const q = manuscriptSearch.toLowerCase()
        return normalize(entry.reference_number).includes(q)
          || normalize(entry.manuscript_id).includes(q)
          || normalize(entry.title).includes(q)
          || normalize(entry.article_type).includes(q)
      })
  const messages = asArray(workspace.messages)
  return <div className="grid gap-6"><div className="grid gap-4 md:grid-cols-2">{[{ label: "Users", value: users.length }, { label: "Journals", value: journals.length }, { label: "Issues", value: issues.length }, { label: "Messages", value: messages.length }].map((item) => <Card key={item.label} className="border-white/70 bg-white/85 backdrop-blur"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</p><p className="mt-2 text-3xl font-semibold text-slate-950">{item.value}</p></CardContent></Card>)}</div><ManualPlagiarismScorePanel entries={filteredManuscripts} title="Manual Plagiarism Score" description="Administrators can record or correct manuscript scores across the journal workspace." emptyMessage="No manuscripts are available for plagiarism score updates yet." onSaved={onSaved} /><Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><CardHeading icon={<Users className="h-5 w-5" />} title="Recent Platform Users" /><Input className="max-w-xs" placeholder="Search ref #, ID, or title" value={manuscriptSearch} onChange={(e)=>setManuscriptSearch(e.target.value)} /></CardHeader><CardContent><Table rows={filteredManuscripts} /></CardContent></Card></div>
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
  if (role === "author") { if (section === "profile") return <ProfileCard user={user} onSaved={onRefresh} />; if (section === "communication") return <MessagesCard workspace={workspace} user={user} onSaved={onRefresh} />; return <AuthorPanels section={section} workspace={workspace} onSaved={onRefresh} /> }
  if (role === "reviewer") {
    if (!workspace.reviewer?.onboarding?.completed) return <ReviewerOnboardingCard onboarding={workspace.reviewer?.onboarding} user={user} onSaved={onRefresh} />
    if (section === "communication") return <MessagesCard workspace={workspace} user={user} onSaved={onRefresh} />
    return <ReviewerPanels section={section} workspace={workspace} onSaved={onRefresh} />
  }
  if (resolveWorkspaceRole(role) === "editor") {
    if (section === "profile") return <EditorOnboardingCard onboarding={workspace.editor?.onboarding} user={user} onSaved={onRefresh} />
    if (!workspace.editor?.onboarding?.completed) return <EditorOnboardingCard onboarding={workspace.editor?.onboarding} user={user} onSaved={onRefresh} />
    if (section === "communication") return <MessagesCard workspace={workspace} user={user} onSaved={onRefresh} />
    return <EditorPanels section={section} workspace={workspace} onSaved={onRefresh} />
  }
  if (role === "editor_in_chief") return <EicPanels section={section} workspace={workspace} onSaved={onRefresh} />
  if (role === "admin") { if (section === "overview") return <AdminOverviewPanel workspace={workspace} onSaved={onRefresh} />; if (section === "applications") return <ApplicationsReview onSaved={onRefresh} />; if (section === "users") return <AdminUsersPanel workspace={workspace} onSaved={onRefresh} />; if (section === "settings") return <SettingsPanel settings={settings} onRefresh={onRefresh} />; if (section === "integrations") return <AdminInfrastructurePanel />; if (section === "monitoring") return <AdminMonitoringPanel workspace={workspace} />; return <Card className="border-white/70 bg-white/85 backdrop-blur"><CardHeader><CardTitle>{section.replaceAll("-"," ")}</CardTitle></CardHeader><CardContent><Table rows={[]} /></CardContent></Card> }
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
  const [loggingOut, setLoggingOut] = React.useState(false)
  const [loadError, setLoadError] = React.useState("")
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
      const firstRole = normalizedRoles[0] ?? ""
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
      if (requestedSection && activeConfig.sections.some((entry)=> entry.id===requestedSection)) {
        return requestedSection
      }
      if (["author", "reviewer", "editor"].includes(resolvedActiveRole)) {
        return defaultRoleSection
      }
      return current && activeConfig.sections.some((entry)=> entry.id===current) ? current : activeConfig.sections[0]?.id ?? ""
    })
  }, [activeConfig, defaultRoleSection, requestedSection, resolvedActiveRole])
  React.useEffect(() => {
    if (!activeRole || !activeSection) return
    const next = new URLSearchParams(searchParams)
    if (next.get("role") === activeRole && next.get("section") === activeSection) return
    next.set("role", activeRole)
    next.set("section", activeSection)
    setSearchParams(next, { replace: true })
  }, [activeRole, activeSection, searchParams, setSearchParams])
  if (!loading && !workspace) return <div className="relative min-h-screen overflow-hidden px-4 py-16 sm:px-6 lg:px-8"><div className="absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_top_left,rgba(11,111,164,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(31,107,92,0.14),transparent_24%)]" /><div className="mx-auto max-w-3xl"><Card className="surface-panel-strong"><CardHeader><Badge className="w-fit bg-[#edf5f9] text-[#0b6fa4]">Workspace error</Badge><CardTitle className="display-section text-slate-950">Unable to open workspace</CardTitle><CardDescription>{loadError || "The dashboard session could not be loaded."}</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3"><Button onClick={()=>void refresh()}>Retry workspace</Button><Link to="/login/author" className={cn(buttonVariants({ variant: "outline" }))}>Return to login</Link></CardContent></Card></div></div>
  if (!loading && workspace && (!workspace.roles || workspace.roles.length === 0)) return <div className="relative min-h-screen overflow-hidden px-4 py-16 sm:px-6 lg:px-8"><div className="absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_top_left,rgba(11,111,164,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(31,107,92,0.14),transparent_24%)]" /><div className="mx-auto max-w-3xl"><Card className="surface-panel-strong"><CardHeader><Badge className="w-fit bg-[#edf5f9] text-[#0b6fa4]">Access issue</Badge><CardTitle className="display-section text-slate-950">No workspace roles available</CardTitle><CardDescription>Your account is authenticated, but no journal role is assigned for dashboard access.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3"><Button onClick={()=>void refresh()}>Reload workspace</Button><Link to="/login/author" className={cn(buttonVariants({ variant: "outline" }))}>Return to login</Link></CardContent></Card></div></div>
  const user = workspace?.user
  const statsSource = resolvedActiveRole && workspace ? (workspace as Record<string, unknown>)[resolvedActiveRole] : null
  const currentStats = statsSource && typeof statsSource === "object" ? (statsSource as Record<string, unknown>).overview ?? (statsSource as Record<string, unknown>) : null
  const currentSectionConfig = activeConfig?.sections.find((section)=>section.id===activeSection)
  const headerTitleLines = splitHeaderTitle(settings.journal_name)
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
        <div className="mx-auto w-full max-w-none px-3 py-3 sm:px-6 sm:py-4 lg:px-8 2xl:px-10">
          <div className="surface-panel-strong grid gap-3 p-3.5 sm:p-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="flex min-w-0 items-center gap-3.5 sm:gap-4.5 max-md:flex-col max-md:text-center">
              <div className="flex h-[4.1rem] w-[4.1rem] shrink-0 items-center justify-center overflow-hidden rounded-[1.35rem] border border-white/80 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.12)] sm:h-[4.9rem] sm:w-[4.9rem] sm:rounded-[1.55rem]">
                {settings.logo_path ? (
                  <img src={resolveApiAssetUrl(settings.logo_path)} alt={settings.journal_name} className="h-full w-full object-cover" />
                ) : (
                  <span className="display-acronym text-[1.9rem] text-jostum-700 sm:text-[2.2rem]">{settings.journal_acronym}</span>
                )}
              </div>
              <div className="min-w-0 flex max-w-[34rem] flex-none flex-col items-center text-center sm:max-w-[36rem] max-md:max-w-full">
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center rounded-full border border-jostum-100 bg-[#edf5f9] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-jostum-700 shadow-sm sm:text-[11px]">
                    {settings.journal_acronym} Workspace
                  </span>
                </div>
                <h1
                  title={settings.journal_name}
                  className="display-workspace mt-2 w-full text-balance text-center text-[clamp(1rem,0.1vw,1rem)] leading-[1.08] tracking-[-0.03em] text-slate-950"
                >
                  {headerTitleLines.map((line, index) => <span key={`${line}-${index}`} className="block">{line}</span>)}
                </h1>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center justify-center gap-1.5 sm:gap-2 xl:w-auto xl:flex-nowrap xl:justify-end">
              <Link to="/" aria-label="Public Site" title="Public Site" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:border-jostum-300 hover:text-jostum-700 sm:w-auto sm:gap-2 sm:px-4">
                <Globe2 className="h-4 w-4" />
                <span className="hidden sm:inline">Public Site</span>
              </Link>
              {user ? <ProfileMenu user={user} onSaved={refresh} onLogout={handleLogout} loggingOut={loggingOut} /> : null}
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-none gap-4 px-3 py-4 sm:px-6 lg:gap-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:px-8 xl:py-6 2xl:px-10">
        <aside className="self-start xl:sticky xl:top-28">
          <div className="workspace-sidebar-scroll surface-panel space-y-3 p-3 lg:max-h-[calc(100vh-7.75rem)] lg:space-y-4 lg:overflow-y-auto lg:p-3.5 lg:pr-2">
            <div>
              <p className="px-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Role spaces</p>
              <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1 xl:grid xl:overflow-visible xl:pb-0">
                {(workspace?.roles ?? []).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setActiveRole(role)}
                    className={cn(
                      "flex min-w-max items-center gap-3 rounded-[1.15rem] px-3.5 py-2.5 text-left text-[13px] font-semibold leading-5 whitespace-nowrap transition xl:w-full xl:min-w-0",
                      activeRole === role
                        ? "bg-[linear-gradient(135deg,#0b6fa4_0%,#1f6b5c_100%)] text-white shadow-[0_16px_28px_rgba(11,111,164,0.18)]"
                        : "bg-slate-50/90 text-slate-600 hover:bg-white hover:text-slate-900",
                    )}
                  >
                    {roleIcons[role] ?? <BarChart3 className="h-4 w-4" />}
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
                      {section.id === "settings" ? <Settings2 className="h-4 w-4" />
                        : section.id === "communication" ? <Mail className="h-4 w-4" />
                          : section.id === "profile" ? <LayoutDashboard className="h-4 w-4" />
                            : section.id === "selection" ? <Microscope className="h-4 w-4" />
                              : section.id === "decisions" || section.id === "final-decisions" ? <FileClock className="h-4 w-4" />
                                : section.id === "monitoring" ? <BarChart3 className="h-4 w-4" />
                                  : section.id === "revision" ? <Upload className="h-4 w-4" />
                                    : section.id === "tracker" || section.id === "deadlines" ? <Workflow className="h-4 w-4" />
                                      : section.id === "impact" ? <Globe2 className="h-4 w-4" />
                                        : section.id === "integrations" ? <Settings2 className="h-4 w-4" />
                                          : section.id === "submission" || section.id === "assignments" ? <FileText className="h-4 w-4" />
                                            : <ShieldCheck className="h-4 w-4" />}
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
            <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.15rem] bg-[linear-gradient(135deg,rgba(11,111,164,0.14),rgba(31,107,92,0.18))] text-jostum-700">
                  {sectionIconMap[activeSection] ?? <LayoutDashboard className="h-4.5 w-4.5" />}
                </div>
                <div className="min-w-0">
                  <Badge className="w-fit bg-[#edf5f9] px-3 py-1 text-[10px] tracking-[0.16em] text-[#0b6fa4]">{activeConfig?.title ?? "Loading"}</Badge>
                  <h2 className="mt-1.5 font-display text-[clamp(1.15rem,4.6vw,2.03rem)] font-semibold leading-[1] tracking-[-0.04em] text-slate-950 md:whitespace-nowrap">
                    {currentSectionConfig?.label ?? activeConfig?.title ?? "Loading workspace..."}
                  </h2>
                  <p className="mt-1.5 max-w-3xl text-[12px] leading-5 text-slate-600 sm:mt-2 sm:text-sm sm:leading-6">
                    {currentSectionConfig?.description ?? activeConfig?.intro ?? "Loading role workspace."}
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
      <Toaster position="top-right" />
    </div>
  )
}
