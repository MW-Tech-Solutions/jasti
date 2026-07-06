import * as React from "react"
import ReactCrop, { type PercentCrop } from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import { ChevronLeft, ChevronRight, Edit2, FileDown, Loader2, Printer, X } from "lucide-react"
import { toast } from "sonner"

import { IdCardBackPreview } from "@/components/IdCardBackPreview"
import { IdCardPreview } from "@/components/IdCardPreview"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { resolveApiAssetUrl } from "@/lib/studentApi"

import type { Department, Student } from "@/admin/types"

type CardEntryForm = {
  matric: string
  firstName: string
  otherName: string
  lastName: string
  departmentId: string
  departmentName: string
  graduationYear: string
  passport: string
  signature: string
  jambRegNumber: string
  email: string
}

type CardsTabProps = {
  cardSearch: string
  setCardSearch: (value: string) => void
  handleCardSearch: () => void
  printLoading: boolean
  pdfExporting: boolean
  selectedStudent: Student | null
  searchPerformed: boolean
  lastSearch: string
  bulkDept: string
  setBulkDept: (value: string) => void
  bulkPrintStatus: "printed" | "not_printed"
  setBulkPrintStatus: (value: "printed" | "not_printed") => void
  departments: Department[]
  bulkLoading: boolean
  bulkDepartmentName: string
  bulkGeneratedCount: number
  bulkCardsPerPage: number
  setBulkCardsPerPage: (value: number) => void
  bulkCurrentPage: number
  bulkTotalPages: number
  bulkPageStudents: Student[]
  bulkSelectedIds: Set<string>
  onBulkSelectionChange: (id: string, checked: boolean) => void
  onBulkStudentImageUpdate: (
    student: Student,
    payload: {
      passport?: string
      signature?: string
    }
  ) => Promise<void>
  handleBulkPageChange: (page: number) => void
  handleBulkPrint: () => void
  handlePrintBulkPage: () => void
  handlePrintSelectedCard: () => void
  cardEntryForm: CardEntryForm
  cardEntryLoading: boolean
  cardEntrySaving: boolean
  onCardEntryChange: React.Dispatch<React.SetStateAction<CardEntryForm>>
  onCardEntryFetch: () => void
  onCardEntryFile: (field: "passport" | "signature") => (file?: File | null) => Promise<void>
  onCardEntrySaveAndPrint: () => void
}

type DragCropState = {
  crop: PercentCrop
}

const createInitialPassportEditorState = (): DragCropState => ({
  crop: { unit: "%", x: 10, y: 5, width: 80, height: 90 },
})

const createInitialSignatureEditorState = (): DragCropState => ({
  crop: { unit: "%", x: 5, y: 20, width: 90, height: 60 },
})

const isInlineImageSource = (value?: string | null) => {
  const raw = String(value ?? "").trim()
  return /^data:image\//i.test(raw) || /^blob:/i.test(raw)
}

const cropImageByArea = async (
  source: string,
  cropPercent: PercentCrop,
  options?: { mimeType?: "image/jpeg" | "image/png"; quality?: number }
) => {
  const raw = source.trim()
  if (!raw) {
    throw new Error("No image selected.")
  }
  const resolvedSource = isInlineImageSource(raw) ? raw : resolveApiAssetUrl(raw)
  const image = new Image()
  image.crossOrigin = "anonymous"
  image.src = resolvedSource
  await image.decode()

  const imageWidth = image.naturalWidth || image.width
  const imageHeight = image.naturalHeight || image.height
  if (!imageWidth || !imageHeight) {
    throw new Error("Unable to read image size.")
  }

  const normalizePercent = (value: number | undefined, fallback: number) => {
    if (!Number.isFinite(value)) return fallback
    return Math.min(100, Math.max(0, Number(value)))
  }

  const xPercent = normalizePercent(cropPercent.x, 0)
  const yPercent = normalizePercent(cropPercent.y, 0)
  const widthPercent = normalizePercent(cropPercent.width, 100)
  const heightPercent = normalizePercent(cropPercent.height, 100)

  let cropX = Math.round((xPercent / 100) * imageWidth)
  let cropY = Math.round((yPercent / 100) * imageHeight)
  let cropWidth = Math.max(1, Math.round((widthPercent / 100) * imageWidth))
  let cropHeight = Math.max(1, Math.round((heightPercent / 100) * imageHeight))
  if (cropX + cropWidth > imageWidth) cropWidth = imageWidth - cropX
  if (cropY + cropHeight > imageHeight) cropHeight = imageHeight - cropY

  if (cropWidth < 1 || cropHeight < 1) {
    cropX = 0
    cropY = 0
    cropWidth = imageWidth
    cropHeight = imageHeight
  }

  const canvas = document.createElement("canvas")
  canvas.width = cropWidth
  canvas.height = cropHeight
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Canvas is not supported.")
  context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

  const mimeType = options?.mimeType ?? "image/png"
  const quality = options?.quality ?? 0.92
  return canvas.toDataURL(mimeType, quality)
}

export function CardsTab({
  cardSearch,
  setCardSearch,
  handleCardSearch,
  printLoading,
  pdfExporting,
  selectedStudent,
  searchPerformed,
  lastSearch,
  bulkDept,
  setBulkDept,
  bulkPrintStatus,
  setBulkPrintStatus,
  departments,
  bulkLoading,
  bulkDepartmentName,
  bulkGeneratedCount,
  bulkCardsPerPage,
  setBulkCardsPerPage,
  bulkCurrentPage,
  bulkTotalPages,
  bulkPageStudents,
  bulkSelectedIds,
  onBulkSelectionChange,
  onBulkStudentImageUpdate,
  handleBulkPageChange,
  handleBulkPrint,
  handlePrintBulkPage,
  handlePrintSelectedCard,
  cardEntryForm,
  cardEntryLoading,
  cardEntrySaving,
  onCardEntryChange,
  onCardEntryFetch,
  onCardEntryFile,
  onCardEntrySaveAndPrint,
}: CardsTabProps) {
  const [cardsView, setCardsView] = React.useState<"print" | "request">("print")
  const canOpenSinglePdf = selectedStudent?.isSubmitted !== false
  const [bulkEditState, setBulkEditState] = React.useState<{
    open: boolean
    student: Student | null
    passport: string
    signature: string
    originalPassport: string
    originalSignature: string
    passportEditor: DragCropState
    signatureEditor: DragCropState
    saving: boolean
    croppingField: "passport" | "signature" | null
  }>({
    open: false,
    student: null,
    passport: "",
    signature: "",
    originalPassport: "",
    originalSignature: "",
    passportEditor: createInitialPassportEditorState(),
    signatureEditor: createInitialSignatureEditorState(),
    saving: false,
    croppingField: null,
  })

  const closeBulkEditModal = React.useCallback(() => {
    setBulkEditState({
      open: false,
      student: null,
      passport: "",
      signature: "",
      originalPassport: "",
      originalSignature: "",
      passportEditor: createInitialPassportEditorState(),
      signatureEditor: createInitialSignatureEditorState(),
      saving: false,
      croppingField: null,
    })
  }, [])

  const openBulkEditModal = React.useCallback((student: Student) => {
    const passport = resolveApiAssetUrl(student.passport ?? "")
    const signature = resolveApiAssetUrl(student.signature ?? "")
    setBulkEditState({
      open: true,
      student,
      passport,
      signature,
      originalPassport: passport,
      originalSignature: signature,
      passportEditor: createInitialPassportEditorState(),
      signatureEditor: createInitialSignatureEditorState(),
      saving: false,
      croppingField: null,
    })
  }, [])

  React.useEffect(() => {
    if (!bulkEditState.open) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (bulkEditState.saving) return
      closeBulkEditModal()
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [bulkEditState.open, bulkEditState.saving, closeBulkEditModal])

  const handleBulkEditFile = React.useCallback(
    (field: "passport" | "signature") => (file?: File | null) => {
      if (!file) return
      if (!file.type.startsWith("image/")) {
        toast.error("Upload an image file.")
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result !== "string") return
        setBulkEditState((prev) => ({
          ...prev,
          [field]: reader.result,
          ...(field === "passport"
            ? { passportEditor: createInitialPassportEditorState() }
            : { signatureEditor: createInitialSignatureEditorState() }),
        }))
      }
      reader.readAsDataURL(file)
    },
    []
  )

  const handleBulkCropChange = React.useCallback((field: "passport" | "signature", crop: PercentCrop) => {
    setBulkEditState((prev) => ({
      ...prev,
      ...(field === "passport"
        ? {
            passportEditor: {
              ...prev.passportEditor,
              crop,
            },
          }
        : {
            signatureEditor: {
              ...prev.signatureEditor,
              crop,
            },
          }),
    }))
  }, [])

  const handleApplyBulkCrop = React.useCallback(
    async (field: "passport" | "signature") => {
      const source = field === "passport" ? bulkEditState.passport : bulkEditState.signature
      if (!source.trim()) {
        toast.error(`No ${field} image available to crop.`)
        return
      }
      const editor = field === "passport" ? bulkEditState.passportEditor : bulkEditState.signatureEditor
      const hasValidCrop = Number(editor.crop.width) > 0 && Number(editor.crop.height) > 0
      if (!hasValidCrop) {
        toast.error(`Adjust the ${field} crop area before applying.`)
        return
      }

      setBulkEditState((prev) => ({ ...prev, croppingField: field }))
      try {
        const cropped = await cropImageByArea(
          source,
          editor.crop,
          {
            mimeType: field === "passport" ? "image/jpeg" : "image/png",
          }
        )
        setBulkEditState((prev) => ({
          ...prev,
          [field]: cropped,
          ...(field === "passport"
            ? { passportEditor: createInitialPassportEditorState() }
            : { signatureEditor: createInitialSignatureEditorState() }),
        }))
        toast.success(`${field === "passport" ? "Passport" : "Signature"} crop applied.`)
      } catch (error) {
        console.error(`Failed to crop ${field}`, error)
        toast.error(`Unable to crop ${field}. Ensure the image is accessible and try again.`)
      } finally {
        setBulkEditState((prev) => ({ ...prev, croppingField: null }))
      }
    },
    [bulkEditState.passport, bulkEditState.passportEditor, bulkEditState.signature, bulkEditState.signatureEditor]
  )

  const handleSaveBulkImageEdits = React.useCallback(async () => {
    if (!bulkEditState.student) return
    const nextPassport = bulkEditState.passport.trim()
    const nextSignature = bulkEditState.signature.trim()
    const originalPassport = bulkEditState.originalPassport.trim()
    const originalSignature = bulkEditState.originalSignature.trim()
    const passportChanged = nextPassport && nextPassport !== originalPassport
    const signatureChanged = nextSignature && nextSignature !== originalSignature

    if (!passportChanged && !signatureChanged) {
      toast.info("No image changes to save.")
      closeBulkEditModal()
      return
    }

    setBulkEditState((prev) => ({ ...prev, saving: true }))
    try {
      await onBulkStudentImageUpdate(bulkEditState.student, {
        passport: passportChanged ? nextPassport : undefined,
        signature: signatureChanged ? nextSignature : undefined,
      })
      toast.success("Student card images updated.")
      closeBulkEditModal()
    } catch (error) {
      console.error("Failed to save bulk image edits", error)
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Failed to update student card images."
      )
      setBulkEditState((prev) => ({ ...prev, saving: false }))
    }
  }, [bulkEditState, closeBulkEditModal, onBulkStudentImageUpdate])

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Cards & Printing</CardTitle>
        <CardDescription>Search and print cards.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={cardsView === "print" ? "default" : "outline"}
            onClick={() => setCardsView("print")}
          >
            Cards & Printing
          </Button>
          <Button
            variant={cardsView === "request" ? "default" : "outline"}
            onClick={() => setCardsView("request")}
          >
            Request Card
          </Button>
        </div>

        {cardsView === "print" && (
          <>
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            placeholder="Search by matric number"
            value={cardSearch}
            onChange={(e) => setCardSearch(e.target.value)}
          />
          <Button onClick={handleCardSearch} disabled={printLoading} className="w-full md:w-auto">
            <Printer className="h-4 w-4" /> Find Single
          </Button>
        </div>
        {selectedStudent ? (
          <div className="mt-3 space-y-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
            <div>
              <p className="font-semibold text-slate-800">
                {selectedStudent.firstName} {selectedStudent.otherName} {selectedStudent.lastName}
              </p>
              <p className="text-xs text-slate-500">
                {selectedStudent.matric} - {selectedStudent.email}
              </p>
              <p className="text-xs text-slate-500">
                Dept: {selectedStudent.departmentId} - Grad: {selectedStudent.graduationYear}
              </p>
            </div>
            <div className="admin-hide-on-print flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => openBulkEditModal(selectedStudent)}
                disabled={bulkEditState.saving}
                className="w-full sm:w-auto"
              >
                <Edit2 className="h-4 w-4" /> Edit Images
              </Button>
              <Button
                onClick={handlePrintSelectedCard}
                disabled={pdfExporting || !canOpenSinglePdf}
                className="w-full sm:w-auto"
              >
                <Printer className="h-4 w-4" /> {pdfExporting ? "Generating PDF..." : "Open PDF (2 Pages)"}
              </Button>
            </div>
            <div
              id="admin-card-print-region"
              className="flex gap-3 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-3"
            >
              <div className="admin-card-print-page min-w-[320px] flex-1">
                <div className="admin-card-print-item overflow-hidden rounded-md border border-slate-200 bg-white">
                  <IdCardPreview
                    data={{
                      matric: selectedStudent.matric,
                      first_name: selectedStudent.firstName,
                      other_name: selectedStudent.otherName ?? "",
                      last_name: selectedStudent.lastName,
                      department: selectedStudent.departmentId,
                      graduation_year: selectedStudent.graduationYear,
                      photoProcessed: selectedStudent.passport,
                      signatureProcessed: selectedStudent.signature,
                    }}
                    size="full"
                    textBoxOffsetY={2}
                  />
                </div>
              </div>
              <div className="admin-card-print-page min-w-[320px] flex-1">
                <div className="admin-card-print-item admin-card-back overflow-hidden rounded-md border border-slate-200 bg-white">
                  <IdCardBackPreview size="full" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          searchPerformed && (
            <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              No student found for "{lastSearch}".
            </div>
          )
        )}
        <Separator />
        <div className="flex flex-col gap-3 md:flex-row">
          <select
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            value={bulkDept}
            onChange={(e) => setBulkDept(e.target.value)}
          >
            <option value="">Select department</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            value={bulkPrintStatus}
            onChange={(e) => setBulkPrintStatus(e.target.value as "printed" | "not_printed")}
          >
            <option value="not_printed">Not printed</option>
            <option value="printed">Printed</option>
          </select>
          <select
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            value={bulkCardsPerPage}
            onChange={(e) => {
              const next = Number.parseInt(e.target.value, 10)
              if (!Number.isFinite(next)) return
              setBulkCardsPerPage(next)
              handleBulkPageChange(1)
            }}
          >
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={30}>30 per page</option>
            <option value={40}>40 per page</option>
            <option value={50}>50 per page</option>
          </select>
          <Button onClick={handleBulkPrint} disabled={bulkLoading} className="w-full md:w-auto">
            <FileDown className="h-4 w-4" /> {bulkLoading ? "Generating..." : "Generate Bulk Cards"}
          </Button>
        </div>
        {bulkGeneratedCount > 0 && (
          <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-slate-700">
                Generated {bulkGeneratedCount} students for {bulkDepartmentName}. Page {bulkCurrentPage} of{" "}
                {bulkTotalPages}. Showing up to {bulkCardsPerPage} per page.
              </div>
              <div className="admin-hide-on-print flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkPageChange(bulkCurrentPage - 1)}
                  disabled={bulkCurrentPage <= 1}
                  className="w-full sm:w-auto"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkPageChange(bulkCurrentPage + 1)}
                  disabled={bulkCurrentPage >= bulkTotalPages}
                  className="w-full sm:w-auto"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={handlePrintBulkPage}
                  disabled={pdfExporting}
                  className="w-full sm:w-auto"
                >
                  <Printer className="h-4 w-4" /> {pdfExporting ? "Generating PDF..." : "Open This Page PDF"}
                </Button>
              </div>
            </div>

            <div id="admin-bulk-print-region" className="space-y-4">
              {bulkPageStudents.map((student) => (
                <div
                  key={student.id}
                  data-student-id={student.id}
                  className={`admin-bulk-student-preview space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3 ${
                    bulkSelectedIds.has(student.id) ? "" : "admin-exclude-from-print"
                  }`}
                >
                  <div className="admin-bulk-preview-meta text-xs text-slate-600">
                    {student.firstName} {student.otherName} {student.lastName} - {student.matric}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={bulkSelectedIds.has(student.id)}
                      onChange={(event) => onBulkSelectionChange(student.id, event.target.checked)}
                    />
                    Include in print
                  </label>
                  <div className="admin-hide-on-print flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openBulkEditModal(student)}
                    >
                      <Edit2 className="h-4 w-4" /> Edit Images
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="admin-card-print-page">
                      <div className="admin-card-print-item overflow-hidden rounded-md border border-slate-200 bg-white">
                        <IdCardPreview
                          data={{
                            matric: student.matric,
                            first_name: student.firstName,
                            other_name: student.otherName ?? "",
                            last_name: student.lastName,
                            department: student.departmentId,
                            graduation_year: student.graduationYear,
                            photoProcessed: student.passport,
                            signatureProcessed: student.signature,
                          }}
                          size="full"
                          textBoxOffsetY={2}
                        />
                      </div>
                    </div>
                    <div className="admin-card-print-page">
                      <div className="admin-card-print-item admin-card-back relative overflow-hidden rounded-md border border-slate-200 bg-white">
                        <IdCardBackPreview size="full" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
          </>
        )}

        {cardsView === "request" && (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="md:max-w-[430px]">
                  <p className="text-sm font-semibold text-slate-800">Manual Student Card</p>
                  <p className="text-xs text-slate-500">
                    Enter matric to fetch details. If found, only passport and signature are required. If not found, fill
                    required fields (including JAMB number) and upload images before printing.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row md:items-end">
                  <Input
                    className="md:w-[240px]"
                    placeholder="Matric number"
                    value={cardEntryForm.matric}
                    onChange={(e) =>
                      onCardEntryChange((prev) => ({ ...prev, matric: e.target.value }))
                    }
                  />
                  <Button
                    variant="outline"
                    onClick={onCardEntryFetch}
                    disabled={cardEntryLoading}
                    className="w-full sm:w-auto"
                  >
                    {cardEntryLoading ? "Fetching..." : "Fetch"}
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Input
                  placeholder="First name (required if new)"
                  value={cardEntryForm.firstName}
                  onChange={(e) =>
                    onCardEntryChange((prev) => ({ ...prev, firstName: e.target.value }))
                  }
                />
                <Input
                  placeholder="Other name (optional)"
                  value={cardEntryForm.otherName}
                  onChange={(e) =>
                    onCardEntryChange((prev) => ({ ...prev, otherName: e.target.value }))
                  }
                />
                <Input
                  placeholder="Last name (required if new)"
                  value={cardEntryForm.lastName}
                  onChange={(e) =>
                    onCardEntryChange((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                />
              <select
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={cardEntryForm.departmentId}
                onChange={(e) =>
                  onCardEntryChange((prev) => {
                    const nextId = e.target.value
                    const nextName =
                      departments.find((dept) => dept.id === nextId)?.name ?? nextId
                    return { ...prev, departmentId: nextId, departmentName: nextName }
                  })
                }
              >
                <option value="">Department (required if new)</option>
                {cardEntryForm.departmentId &&
                  !departments.some((dept) => dept.id === cardEntryForm.departmentId) && (
                    <option value={cardEntryForm.departmentId}>
                      {cardEntryForm.departmentName || cardEntryForm.departmentId}
                    </option>
                  )}
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
                </select>
                <Input
                  placeholder="Graduation year (optional)"
                  value={cardEntryForm.graduationYear}
                  onChange={(e) =>
                    onCardEntryChange((prev) => ({ ...prev, graduationYear: e.target.value }))
                  }
                />
                <Input
                  placeholder="JAMB Reg Number (required if new)"
                  value={cardEntryForm.jambRegNumber}
                  onChange={(e) =>
                    onCardEntryChange((prev) => ({ ...prev, jambRegNumber: e.target.value }))
                  }
                />
                {/* <Input
                  placeholder="Email (optional)"
                  value={cardEntryForm.email}
                  onChange={(e) =>
                    onCardEntryChange((prev) => ({ ...prev, email: e.target.value }))
                  }
                /> */}
                <div className="space-y-1 md:col-span-3">
                  <label className="text-xs text-slate-600">Passport (image)</label>
                  <Input type="file" accept="image/*" onChange={(e) => void onCardEntryFile("passport")(e.target.files?.[0])} />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <label className="text-xs text-slate-600">Signature (image)</label>
                  <Input type="file" accept="image/*" onChange={(e) => void onCardEntryFile("signature")(e.target.files?.[0])} />
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  onClick={onCardEntrySaveAndPrint}
                  disabled={cardEntrySaving || pdfExporting}
                  className="w-full sm:w-auto"
                >
                  {cardEntrySaving ? "Saving..." : pdfExporting ? "Generating PDF..." : "Save & Open PDF"}
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Preview</p>
              <div className="mt-3">
                <IdCardPreview
                  data={{
                    matric: cardEntryForm.matric,
                    first_name: cardEntryForm.firstName,
                    other_name: cardEntryForm.otherName,
                    last_name: cardEntryForm.lastName,
                    department: cardEntryForm.departmentName || cardEntryForm.departmentId,
                    graduation_year: cardEntryForm.graduationYear,
                    photoProcessed: cardEntryForm.passport,
                    signatureProcessed: cardEntryForm.signature,
                  }}
                  size="compact"
                  textBoxOffsetY={2}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    {bulkEditState.open && bulkEditState.student && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3"
        onClick={() => {
          if (bulkEditState.saving) return
          closeBulkEditModal()
        }}
      >
        <div
          className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Edit Card Images</p>
              <p className="truncate text-xs text-slate-500">
                {bulkEditState.student.firstName} {bulkEditState.student.otherName} {bulkEditState.student.lastName} -{" "}
                {bulkEditState.student.matric}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={closeBulkEditModal}
              disabled={bulkEditState.saving}
              aria-label="Close image editor"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-[80vh] overflow-y-auto p-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-800">Passport</p>
                <div className="min-h-[15rem] overflow-hidden rounded-md border border-slate-200 bg-white">
                  {bulkEditState.passport ? (
                    <ReactCrop
                      crop={bulkEditState.passportEditor.crop}
                      onChange={(_, percentCrop: PercentCrop) =>
                        handleBulkCropChange("passport", percentCrop)
                      }
                      minWidth={90}
                      minHeight={90}
                      keepSelection
                    >
                      <img
                        src={resolveApiAssetUrl(bulkEditState.passport)}
                        alt={`${bulkEditState.student.firstName} passport`}
                        className="max-h-[20rem] w-full object-contain"
                      />
                    </ReactCrop>
                  ) : (
                    <div className="flex min-h-[15rem] items-center justify-center">
                      <p className="text-xs text-slate-500">No passport image</p>
                    </div>
                  )}
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    handleBulkEditFile("passport")(event.target.files?.[0])
                    event.currentTarget.value = ""
                  }}
                  disabled={bulkEditState.saving}
                />
                <p className="text-xs text-slate-500">
                  Drag and resize the crop box directly on the image, then confirm crop.
                </p>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleApplyBulkCrop("passport")}
                    disabled={bulkEditState.saving || bulkEditState.croppingField !== null}
                  >
                    {bulkEditState.croppingField === "passport" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Edit2 className="h-4 w-4" />
                    )}
                    Confirm Passport Crop
                  </Button>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-800">Signature</p>
                <div className="min-h-[15rem] overflow-hidden rounded-md border border-slate-200 bg-white">
                  {bulkEditState.signature ? (
                    <ReactCrop
                      crop={bulkEditState.signatureEditor.crop}
                      onChange={(_, percentCrop: PercentCrop) =>
                        handleBulkCropChange("signature", percentCrop)
                      }
                      minWidth={90}
                      minHeight={40}
                      keepSelection
                    >
                      <img
                        src={resolveApiAssetUrl(bulkEditState.signature)}
                        alt={`${bulkEditState.student.firstName} signature`}
                        className="max-h-[20rem] w-full object-contain"
                      />
                    </ReactCrop>
                  ) : (
                    <div className="flex min-h-[15rem] items-center justify-center">
                      <p className="text-xs text-slate-500">No signature image</p>
                    </div>
                  )}
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    handleBulkEditFile("signature")(event.target.files?.[0])
                    event.currentTarget.value = ""
                  }}
                  disabled={bulkEditState.saving}
                />
                <p className="text-xs text-slate-500">
                  Drag and resize the crop box directly on the image, then confirm crop.
                </p>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleApplyBulkCrop("signature")}
                    disabled={bulkEditState.saving || bulkEditState.croppingField !== null}
                  >
                    {bulkEditState.croppingField === "signature" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Edit2 className="h-4 w-4" />
                    )}
                    Confirm Signature Crop
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={closeBulkEditModal}
              disabled={bulkEditState.saving}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveBulkImageEdits()}
              disabled={bulkEditState.saving}
              className="w-full sm:w-auto"
            >
              {bulkEditState.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {bulkEditState.saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
