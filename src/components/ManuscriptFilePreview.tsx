import * as React from "react"
import { createPortal } from "react-dom"
import { FileText, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { resolveApiAssetUrl } from "@/lib/journalApi"

export type ManuscriptFileEntry = {
  label: string
  path: string
  fileName: string
  url: string
  extension: string
}

function extractStorageFileName(path: string) {
  const normalized = path.split("#")[0]?.split("?")[0] ?? path
  const segments = normalized.split("/").filter(Boolean)
  return segments[segments.length - 1] ?? normalized
}

function fileExtension(path: string) {
  const fileName = extractStorageFileName(path)
  const dotIndex = fileName.lastIndexOf(".")
  if (dotIndex < 0) return ""
  return fileName.slice(dotIndex + 1).toLowerCase()
}

function previewPriority(entry: ManuscriptFileEntry) {
  const label = entry.label.toLowerCase()
  const extension = entry.extension
  let score = 0

  if (label.includes("revised_manuscript")) score += 6
  if (label.includes("manuscript")) score += 5
  if (extension === "pdf") score += 4
  if (["png", "jpg", "jpeg", "webp"].includes(extension)) score += 3
  if (label.includes("supplementary")) score -= 1

  return score
}

function isPreviewable(extension: string) {
  return ["pdf", "png", "jpg", "jpeg", "webp", "gif", "txt"].includes(extension)
}

export function parseManuscriptFileBundle(value: unknown): ManuscriptFileEntry[] {
  return String(value ?? "")
    .split("||")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const separatorIndex = entry.indexOf(":")
      const label = separatorIndex >= 0 ? entry.slice(0, separatorIndex).trim() : `file ${index + 1}`
      const path = separatorIndex >= 0 ? entry.slice(separatorIndex + 1).trim() : entry
      const extension = fileExtension(path)

      return {
        label,
        path,
        fileName: extractStorageFileName(path),
        url: resolveApiAssetUrl(path),
        extension,
      }
    })
    .sort((left, right) => previewPriority(right) - previewPriority(left))
}

function ManuscriptPreviewModal({
  entry,
  onClose,
}: {
  entry: ManuscriptFileEntry
  onClose: () => void
}) {
  const previewable = isPreviewable(entry.extension)

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-950">{entry.label.replaceAll("_", " ")}</p>
              <p className="text-xs text-slate-500">{entry.fileName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Close manuscript preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-[76vh] bg-slate-50">
          {previewable ? (
            <iframe title={`${entry.fileName} preview`} src={entry.url} className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <p className="text-lg font-semibold text-slate-950">Inline preview is not available for this file type.</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Use the open action below to view or download the manuscript file in a new browser tab.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <Button variant="outline" onClick={() => window.open(entry.url, "_blank", "noreferrer")}>
            Open in new tab
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

export function ManuscriptFileBundlePreview({
  value,
  compact = false,
  emptyMessage = "No manuscript file bundle available yet.",
}: {
  value: unknown
  compact?: boolean
  emptyMessage?: string
}) {
  const [previewEntry, setPreviewEntry] = React.useState<ManuscriptFileEntry | null>(null)
  const entries = React.useMemo(() => parseManuscriptFileBundle(value), [value])

  const openPreview = (entry: ManuscriptFileEntry) => {
    setPreviewEntry(entry)
  }

  const closePreview = () => {
    setPreviewEntry(null)
  }

  if (!entries.length) {
    return compact ? <span>{emptyMessage}</span> : <p className="text-sm text-slate-500">{emptyMessage}</p>
  }

  return (
    <>
      {previewEntry && typeof document !== "undefined"
        ? createPortal(<ManuscriptPreviewModal entry={previewEntry} onClose={closePreview} />, document.body)
        : null}
      <div className={compact ? "space-y-2" : "space-y-3"}>
        {entries.map((entry) => (
          <div key={`${entry.label}:${entry.path}`} className={compact ? "rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2" : "rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3"}>
            <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"}>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{entry.label.replaceAll("_", " ")}</p>
                <p className={compact ? "mt-1 break-all text-[12px] leading-5 text-slate-700" : "mt-1 break-all text-sm leading-6 text-slate-700"}>
                  {entry.fileName}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openPreview(entry)}>
                  Preview
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.open(entry.url, "_blank", "noreferrer")}>
                  Open
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
