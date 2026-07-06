import * as React from "react"
import { isAxiosError } from "axios"
import { toast } from "sonner"
import { Loader2, Plus, Save, Trash2, Upload } from "lucide-react"

import { AccordionItem } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  getCampaignAdmin,
  saveCampaignAdmin,
  uploadCampaignMedia,
  type CampaignAdminPayload,
  type CampaignMediaMeta,
} from "@/lib/journalApi"

function errorText(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message
    return message || error.message || fallback
  }
  return (error as Error)?.message || fallback
}

function normalizeNumber(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-600">
      <input type="checkbox" className="h-4 w-4" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {checked ? "Active" : "Inactive"}
    </label>
  )
}

function MediaSelect({
  label,
  media,
  value,
  onChange,
  allowNone = true,
}: {
  label: string
  media: CampaignMediaMeta[]
  value: number | null
  onChange: (value: number | null) => void
  allowNone?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <select
        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
        value={value ? String(value) : ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      >
        {allowNone ? <option value="">None</option> : null}
        {media.map((m) => (
          <option key={String(m.media_id)} value={String(m.media_id)}>
            #{m.media_id} ? {m.filename} ? {Math.round((m.byte_size || 0) / 1024)}KB
          </option>
        ))}
      </select>
    </div>
  )
}

function RowActions({ onDelete }: { onDelete: () => void }) {
  return (
    <Button type="button" variant="outline" className="h-9 gap-2" onClick={onDelete}>
      <Trash2 className="h-4 w-4" />
      Remove
    </Button>
  )
}

export default function CampaignCmsPanel() {
  const [data, setData] = React.useState<CampaignAdminPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [savingKey, setSavingKey] = React.useState<string | null>(null)

  const [upload, setUpload] = React.useState({
    file: null as File | null,
    media_id: "",
    media_type: "image",
    filename: "",
    alt_text: "",
    progress: 0,
  })

  const reload = React.useCallback(async () => {
    setLoading(true)
    try {
      const payload = await getCampaignAdmin()
      setData(payload)
    } catch (error) {
      toast.error(errorText(error, "Unable to load campaign CMS."))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void reload()
  }, [reload])

  const save = React.useCallback(
    async (key: string, payload: Record<string, unknown>) => {
      setSavingKey(key)
      try {
        const result = await saveCampaignAdmin(payload)
        toast.success(result.message || "Saved.")
        await reload()
      } catch (error) {
        toast.error(errorText(error, "Unable to save."))
      } finally {
        setSavingKey(null)
      }
    },
    [reload]
  )

  if (loading) {
    return (
      <Card className="border-white/70 bg-white/85 backdrop-blur">
        <CardContent className="flex items-center gap-3 p-6 text-sm text-slate-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Campaign CMS?
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="border-white/70 bg-white/85 backdrop-blur">
        <CardHeader>
          <CardTitle>Campaign CMS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>No campaign CMS data yet. Run `database/romeo_campaign_cms_migration.sql` in your MySQL server.</p>
          <Button onClick={() => void reload()} className="rounded-full">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const media = data.media || []

  return (
    <div className="grid gap-6">
      <Card className="border-white/70 bg-white/85 backdrop-blur">
        <CardHeader>
          <CardTitle>Campaign CMS</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          Manage the campaign landing page content (text + images stored in the database as BLOBs).
        </CardContent>
      </Card>

      <AccordionItem title="Media Library (upload images/files)" defaultOpen>
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="border-slate-200 lg:col-span-5">
            <CardHeader>
              <CardTitle className="text-base">Upload / Replace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>File</Label>
                <Input type="file" onChange={(e) => setUpload((p) => ({ ...p, file: e.target.files?.[0] ?? null }))} />
                <p className="text-xs text-slate-500">Uploads are stored into `campaign_media.bytes`.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Replace media ID (optional)</Label>
                  <Input value={upload.media_id} onChange={(e) => setUpload((p) => ({ ...p, media_id: e.target.value }))} placeholder="e.g. 12" />
                </div>
                <div className="space-y-2">
                  <Label>Media type</Label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    value={upload.media_type}
                    onChange={(e) => setUpload((p) => ({ ...p, media_type: e.target.value }))}
                  >
                    <option value="image">Image</option>
                    <option value="file">File</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Filename (optional)</Label>
                <Input value={upload.filename} onChange={(e) => setUpload((p) => ({ ...p, filename: e.target.value }))} placeholder="e.g. hero-slide.jpg" />
              </div>

              <div className="space-y-2">
                <Label>Alt text (optional)</Label>
                <Input value={upload.alt_text} onChange={(e) => setUpload((p) => ({ ...p, alt_text: e.target.value }))} placeholder="Short description for accessibility" />
              </div>

              {upload.progress > 0 ? (
                <div className="space-y-2">
                  <Label>Upload progress</Label>
                  <Progress value={upload.progress} />
                </div>
              ) : null}

              <Button
                className="gap-2"
                disabled={!upload.file || savingKey === "upload-media"}
                onClick={async () => {
                  if (!upload.file) return
                  setSavingKey("upload-media")
                  setUpload((p) => ({ ...p, progress: 1 }))
                  try {
                    const payload = new FormData()
                    payload.append("file", upload.file)
                    if (upload.media_id.trim()) payload.append("media_id", upload.media_id.trim())
                    if (upload.filename.trim()) payload.append("filename", upload.filename.trim())
                    if (upload.alt_text.trim()) payload.append("alt_text", upload.alt_text.trim())
                    payload.append("media_type", upload.media_type)

                    const result = await uploadCampaignMedia(payload, {
                      onProgress: (progress) => setUpload((p) => ({ ...p, progress })),
                    })
                    toast.success(result.message || "Media saved.")
                    setUpload({ file: null, media_id: "", media_type: "image", filename: "", alt_text: "", progress: 0 })
                    await reload()
                  } catch (error) {
                    toast.error(errorText(error, "Unable to upload."))
                    setUpload((p) => ({ ...p, progress: 0 }))
                  } finally {
                    setSavingKey(null)
                  }
                }}
              >
                <Upload className="h-4 w-4" />
                {savingKey === "upload-media" ? "Uploading?" : "Upload"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200 lg:col-span-7">
            <CardHeader>
              <CardTitle className="text-base">Available media</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {media.length ? (
                <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2">ID</th>
                        <th className="px-3 py-2">Filename</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Size</th>
                        <th className="px-3 py-2">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {media.map((m) => (
                        <tr key={String(m.media_id)} className="border-t border-slate-200">
                          <td className="px-3 py-2 font-semibold text-slate-900">{m.media_id}</td>
                          <td className="px-3 py-2 text-slate-700">{m.filename}</td>
                          <td className="px-3 py-2 text-slate-600">{m.media_type}</td>
                          <td className="px-3 py-2 text-slate-600">{Math.round((m.byte_size || 0) / 1024)}KB</td>
                          <td className="px-3 py-2 text-slate-600">{m.created_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No media uploaded yet.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </AccordionItem>

      <AccordionItem title="Site / Footer / Newsletter">
        <SiteEditor data={data} setData={setData} savingKey={savingKey} onSave={() => void save("site", { action: "upsert_site", site: data.site ?? {} })} />
      </AccordionItem>

      <AccordionItem title="Navigation links">
        <NavEditor data={data} setData={setData} savingKey={savingKey} onSave={() => void save("nav", { action: "set_nav_links", nav_links: data.nav_links })} />
      </AccordionItem>

      <AccordionItem title="Social links (icon buttons)">
        <SocialEditor data={data} setData={setData} savingKey={savingKey} onSave={() => void save("social", { action: "set_social_links", social_links: data.social_links })} />
      </AccordionItem>

      <AccordionItem title="Hero slides">
        <HeroEditor media={media} data={data} setData={setData} savingKey={savingKey} onSave={() => void save("slides", { action: "save_collection", collection: "hero_slides", items: data.hero_slides })} />
      </AccordionItem>

      <AccordionItem title="Priorities (Areas / Agenda)">
        <PrioritiesEditor data={data} setData={setData} savingKey={savingKey} onSave={() => void save("priorities", { action: "save_collection", collection: "priorities", items: data.priorities })} />
      </AccordionItem>

      <AccordionItem title="Message (Give Voice to the Masses)">
        <MessageEditor media={media} data={data} setData={setData} savingKey={savingKey} onSave={() => void save("message", { action: "upsert_message", message: data.message ?? {} })} />
      </AccordionItem>

      <AccordionItem title="Press releases">
        <CollectionEditor kind="press_releases" media={media} savingKey={savingKey} items={data.press_releases} onChange={(items) => setData((p) => (p ? { ...p, press_releases: items } : p))} onAdd={() => setData((p) => p ? ({ ...p, press_releases: [...p.press_releases, { press_id: 0, title: "New press release", date_published: "2026-03-03", body: "", media_id: null, display_order: p.press_releases.length + 1, is_active: 1 }] }) : p)} onSave={onSaveFactory(savingKey, "press_releases", onSave=onSaveFactory)} />
      </AccordionItem>
    </div>
  )
}
