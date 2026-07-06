import * as React from "react"
import { isAxiosError } from "axios"
import { FileText, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  approveEditorOnboarding,
  approveReviewerOnboarding,
  getEditorOnboardingApplications,
  getReviewerOnboardingApplications,
  rejectEditorOnboarding,
  rejectReviewerOnboarding,
  resolveApiAssetUrl,
  type EditorOnboardingApplication,
  type ReviewerOnboardingApplication,
} from "@/lib/journalApi"

function errorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    const payload = error.response?.data as { message?: string; error?: string } | undefined
    if (payload?.message) return payload.message
    if (payload?.error) return payload.error
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

type ApplicationsReviewProps = {
  onSaved: () => Promise<void> | void
}

type CvModalState =
  | null
  | {
      title: string
      url: string
    }

function ApplicationCard({
  title,
  subtitle,
  meta,
  onViewCv,
  onApprove,
  onReject,
  approving,
  rejecting,
  hasCv,
}: {
  title: string
  subtitle: string
  meta: string[]
  onViewCv: () => void
  onApprove: () => void
  onReject: () => void
  approving: boolean
  rejecting: boolean
  hasCv: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="text-sm text-slate-600">{subtitle}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.filter(Boolean).map((item) => (
              <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onViewCv} disabled={!hasCv}>
            View CV
          </Button>
          <Button size="sm" onClick={onApprove} disabled={!hasCv || approving}>
            {approving ? "Approving..." : "Approve"}
          </Button>
          <Button size="sm" variant="outline" onClick={onReject} disabled={rejecting}>
            {rejecting ? "Rejecting..." : "Reject"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function ApplicationsReview({ onSaved }: ApplicationsReviewProps) {
  const [tab, setTab] = React.useState<"reviewers" | "editors">("reviewers")
  const [loading, setLoading] = React.useState(false)
  const [cvModal, setCvModal] = React.useState<CvModalState>(null)
  const [reviewerApps, setReviewerApps] = React.useState<ReviewerOnboardingApplication[]>([])
  const [editorApps, setEditorApps] = React.useState<EditorOnboardingApplication[]>([])
  const [decisionNotes, setDecisionNotes] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState<Record<string, "approve" | "reject" | null>>({})

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [reviewersResult, editorsResult] = await Promise.allSettled([
        getReviewerOnboardingApplications({ status: "pending", completed_only: true, limit: 100, offset: 0 }),
        getEditorOnboardingApplications({ status: "pending", completed_only: true, limit: 100, offset: 0 }),
      ])

      if (reviewersResult.status === "fulfilled") {
        setReviewerApps(reviewersResult.value.applications ?? [])
      } else {
        setReviewerApps([])
        toast.error(errorMessage(reviewersResult.reason, "Unable to load reviewer applications."))
      }

      if (editorsResult.status === "fulfilled") {
        setEditorApps(editorsResult.value.applications ?? [])
      } else {
        setEditorApps([])
        toast.error(errorMessage(editorsResult.reason, "Unable to load editor applications."))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const openCv = (title: string, path?: string | null) => {
    if (!path) {
      toast.error("No CV uploaded yet.")
      return
    }
    setCvModal({ title, url: resolveApiAssetUrl(path) })
  }

  const approveReviewer = async (app: ReviewerOnboardingApplication) => {
    const key = `reviewer:${app.reviewer_id}`
    setBusy((prev) => ({ ...prev, [key]: "approve" }))
    try {
      await approveReviewerOnboarding({ reviewer_id: app.reviewer_id, notes: decisionNotes[key] || undefined })
      toast.success("Reviewer approved.")
      await load()
      await onSaved()
    } catch (error) {
      toast.error(errorMessage(error, "Unable to approve reviewer."))
    } finally {
      setBusy((prev) => ({ ...prev, [key]: null }))
    }
  }

  const rejectReviewer = async (app: ReviewerOnboardingApplication) => {
    const key = `reviewer:${app.reviewer_id}`
    const reason = (decisionNotes[key] || "").trim()
    if (!reason) {
      toast.error("Enter a rejection reason first.")
      return
    }
    setBusy((prev) => ({ ...prev, [key]: "reject" }))
    try {
      await rejectReviewerOnboarding({ reviewer_id: app.reviewer_id, reason })
      toast.success("Reviewer rejected.")
      await load()
      await onSaved()
    } catch (error) {
      toast.error(errorMessage(error, "Unable to reject reviewer."))
    } finally {
      setBusy((prev) => ({ ...prev, [key]: null }))
    }
  }

  const approveEditor = async (app: EditorOnboardingApplication) => {
    const key = `editor:${app.editor_id}`
    setBusy((prev) => ({ ...prev, [key]: "approve" }))
    try {
      await approveEditorOnboarding({ editor_id: app.editor_id, notes: decisionNotes[key] || undefined })
      toast.success("Editor approved.")
      await load()
      await onSaved()
    } catch (error) {
      toast.error(errorMessage(error, "Unable to approve editor."))
    } finally {
      setBusy((prev) => ({ ...prev, [key]: null }))
    }
  }

  const rejectEditor = async (app: EditorOnboardingApplication) => {
    const key = `editor:${app.editor_id}`
    const reason = (decisionNotes[key] || "").trim()
    if (!reason) {
      toast.error("Enter a rejection reason first.")
      return
    }
    setBusy((prev) => ({ ...prev, [key]: "reject" }))
    try {
      await rejectEditorOnboarding({ editor_id: app.editor_id, reason })
      toast.success("Editor rejected.")
      await load()
      await onSaved()
    } catch (error) {
      toast.error(errorMessage(error, "Unable to reject editor."))
    } finally {
      setBusy((prev) => ({ ...prev, [key]: null }))
    }
  }

  const activeApps = tab === "reviewers" ? reviewerApps : editorApps

  return (
    <div className="grid gap-6">
      {cvModal ? (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-950">{cvModal.title}</p>
                  <p className="text-xs text-slate-500">PDF preview</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCvModal(null)}
                className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                aria-label="Close CV preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-[76vh] bg-slate-50">
              <iframe title="CV preview" src={cvModal.url} className="h-full w-full" />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <Button variant="outline" onClick={() => window.open(cvModal.url, "_blank", "noreferrer")}>
                Open in new tab
              </Button>
              <Button onClick={() => setCvModal(null)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}

      <Card className="min-w-0 border-white/70 bg-white/85 backdrop-blur">
        <CardHeader>
          <CardTitle>Application Review</CardTitle>
          <CardDescription>Admin and Editor-in-Chief can review onboarding applications and CV PDFs before approval.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={tab === "reviewers" ? "default" : "outline"} onClick={() => setTab("reviewers")}>
              Reviewers ({reviewerApps.length})
            </Button>
            <Button variant={tab === "editors" ? "default" : "outline"} onClick={() => setTab("editors")}>
              Editors ({editorApps.length})
            </Button>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Loading applications...</div>
          ) : activeApps.length ? (
            <div className="space-y-4">
              {tab === "reviewers"
                ? reviewerApps.map((app) => {
                    const key = `reviewer:${app.reviewer_id}`
                    const hasCv = Boolean(app.cv_file)
                    return (
                      <div key={key} className="space-y-3">
                        <ApplicationCard
                          title={app.name}
                          subtitle={app.email}
                          meta={[app.institution || "", app.country || "", app.position || ""]}
                          hasCv={hasCv}
                          onViewCv={() => openCv(`Reviewer CV: ${app.name}`, app.cv_file)}
                          onApprove={() => void approveReviewer(app)}
                          onReject={() => void rejectReviewer(app)}
                          approving={busy[key] === "approve"}
                          rejecting={busy[key] === "reject"}
                        />
                        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <Label className="text-xs text-slate-600">Approval notes / rejection reason</Label>
                          <Input
                            value={decisionNotes[key] ?? ""}
                            onChange={(e) => setDecisionNotes((prev) => ({ ...prev, [key]: e.target.value }))}
                            placeholder="Type a note (for approve) or reason (for reject)"
                          />
                        </div>
                      </div>
                    )
                  })
                : editorApps.map((app) => {
                    const key = `editor:${app.editor_id}`
                    const hasCv = Boolean(app.cv_file)
                    return (
                      <div key={key} className="space-y-3">
                        <ApplicationCard
                          title={app.name}
                          subtitle={`${app.email}${app.editor_role ? ` • ${app.editor_role}` : ""}`}
                          meta={[app.institution || "", app.country || "", app.position || ""]}
                          hasCv={hasCv}
                          onViewCv={() => openCv(`Editor CV: ${app.name}`, app.cv_file)}
                          onApprove={() => void approveEditor(app)}
                          onReject={() => void rejectEditor(app)}
                          approving={busy[key] === "approve"}
                          rejecting={busy[key] === "reject"}
                        />
                        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <Label className="text-xs text-slate-600">Approval notes / rejection reason</Label>
                          <Input
                            value={decisionNotes[key] ?? ""}
                            onChange={(e) => setDecisionNotes((prev) => ({ ...prev, [key]: e.target.value }))}
                            placeholder="Type a note (for approve) or reason (for reject)"
                          />
                        </div>
                      </div>
                    )
                  })}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No pending applications found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
