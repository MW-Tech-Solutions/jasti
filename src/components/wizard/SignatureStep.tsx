import * as React from "react"
import ReactCrop, { type PercentCrop } from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import { CheckCircle2, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { resolveApiAssetUrl } from "@/lib/studentApi"
import {
  compressImageDataUrlIfNeeded,
  IMAGE_UPLOAD_MAX_BYTES,
} from "@/utils/imageCompression"
import { processSignature } from "@/utils/signatureProcessing"

type SignatureStepProps = {
  data: {
    signatureProcessed?: string
    signatureOriginal?: string
  }
  onChange: React.Dispatch<React.SetStateAction<any>>
  onBack: () => void
  onNext: () => void
}

type Status = "idle" | "processing" | "ready" | "error"

const createInitialSignatureCrop = (): PercentCrop => ({
  unit: "%",
  x: 5,
  y: 20,
  width: 90,
  height: 60,
})

const isInlineImageSource = (value?: string | null) => {
  const raw = String(value ?? "").trim()
  return /^data:image\//i.test(raw) || /^blob:/i.test(raw)
}

const cropImageByArea = async (source: string, cropPercent: PercentCrop) => {
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
  return canvas.toDataURL("image/png", 0.92)
}

export function SignatureStep({ data, onChange, onBack, onNext }: SignatureStepProps) {
  const [status, setStatus] = React.useState<Status>("idle")
  const [crop, setCrop] = React.useState<PercentCrop>(createInitialSignatureCrop())
  const [isApplyingCrop, setIsApplyingCrop] = React.useState(false)

  const handleFile = async (file?: File | null) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file.")
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      if (typeof reader.result !== "string") return
      onChange((prev: any) => ({ ...prev, signatureOriginal: reader.result }))
      setCrop(createInitialSignatureCrop())
      await runProcessing(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const runProcessing = async (source: string) => {
    setStatus("processing")
    try {
      const result = await processSignature(source)
      const optimizedSignature = await compressImageDataUrlIfNeeded(result.processed, {
        maxBytes: IMAGE_UPLOAD_MAX_BYTES,
        fileName: "signature",
        preferredType: "image/png",
        allowJpegFallback: false,
        maxWidthOrHeight: 1200,
      })
      onChange((prev: any) => ({ ...prev, signatureProcessed: optimizedSignature.value }))
      setCrop(createInitialSignatureCrop())
      setStatus("ready")
      if (optimizedSignature.compressed) {
        toast.info("Signature compressed below 100KB.")
      }
      toast.success("Signature cleaned and saved.")
    } catch {
      setStatus("error")
      toast.error("Unable to process this signature image.")
    }
  }

  const applyCrop = async () => {
    const source = data.signatureProcessed?.trim()
    if (!source) return
    const hasValidCrop = Number(crop.width) > 0 && Number(crop.height) > 0
    if (!hasValidCrop) {
      toast.error("Adjust the signature crop area before applying.")
      return
    }
    setIsApplyingCrop(true)
    setStatus("processing")
    try {
      const cropped = await cropImageByArea(source, crop)
      const optimizedSignature = await compressImageDataUrlIfNeeded(cropped, {
        maxBytes: IMAGE_UPLOAD_MAX_BYTES,
        fileName: "signature",
        preferredType: "image/png",
        allowJpegFallback: false,
        maxWidthOrHeight: 1200,
      })
      onChange((prev: any) => ({ ...prev, signatureProcessed: optimizedSignature.value }))
      setCrop(createInitialSignatureCrop())
      setStatus("ready")
      if (optimizedSignature.compressed) {
        toast.info("Signature compressed below 100KB.")
      }
      toast.success("Signature crop applied.")
    } catch {
      setStatus("error")
      toast.error("Unable to crop signature.")
    } finally {
      setIsApplyingCrop(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Signature</CardTitle>
        <CardDescription>
          Upload any signature image format. It will be converted to a fresh PNG, background removed, and strokes enhanced automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <Upload className="h-8 w-8 text-slate-500" />
            <p className="text-sm text-slate-600">Accepted formats: any image type.</p>
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-800">Before</p>
            <div className="mt-3 flex h-28 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50">
              {data.signatureOriginal ? (
                <img
                  src={data.signatureOriginal}
                  alt="Signature before"
                  className="h-full w-full object-contain"
                />
              ) : (
                <p className="text-xs text-slate-400">Original signature</p>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-800">After</p>
            <div className="mt-3 flex h-28 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50">
              {data.signatureProcessed ? (
                <img
                  src={data.signatureProcessed}
                  alt="Signature after"
                  className="h-full w-full object-contain"
                />
              ) : (
                <p className="text-xs text-slate-400">Processed signature</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-800">Processing status</p>
          {status === "processing" && (
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isApplyingCrop
                ? "Applying signature crop..."
                : "Removing background and enhancing signature..."}
            </div>
          )}
          {status === "ready" && (
            <div className="mt-2 flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Signature cleaned with transparent background.
            </div>
          )}
          {status === "error" && (
            <p className="mt-2 text-sm text-red-600">Unable to process signature.</p>
          )}
        </div>

        {data.signatureProcessed && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-800">Adjust crop</p>
            <div className="mt-3 min-h-[14rem] overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-2">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop: PercentCrop) => setCrop(percentCrop)}
                minWidth={90}
                minHeight={40}
                keepSelection
              >
                <img
                  src={resolveApiAssetUrl(data.signatureProcessed)}
                  alt="Signature crop preview"
                  className="max-h-[16rem] w-full object-contain"
                />
              </ReactCrop>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Drag and resize the crop box directly on the image, then confirm crop.
            </p>
            <div className="mt-3 flex justify-end">
              <Button variant="secondary" onClick={applyCrop} disabled={isApplyingCrop || status === "processing"}>
                {isApplyingCrop ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isApplyingCrop ? "Applying..." : "Confirm Crop"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
          Back
        </Button>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button
            variant="secondary"
            onClick={() => data.signatureOriginal && runProcessing(data.signatureOriginal)}
            disabled={!data.signatureOriginal}
            className="w-full sm:w-auto"
          >
            Reprocess
          </Button>
          <Button onClick={onNext} disabled={!data.signatureProcessed} className="w-full sm:w-auto">
            Save & Continue
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
