import * as React from "react"
import { FaceDetector } from "@mediapipe/tasks-vision"
import {
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { validatePhoto } from "@/utils/photoValidation"
import { cropSquareAroundFace, compressToTarget } from "@/utils/imageProcessing"
import {
  compressImageDataUrlIfNeeded,
  IMAGE_UPLOAD_MAX_BYTES,
} from "@/utils/imageCompression"

type PhotoStatus = {
  state: "idle" | "processing" | "ready" | "error"
  compliant?: boolean
  reasons?: string[]
  message?: string
}

type PhotoStepProps = {
  data: {
    photoProcessed?: string
  }
  onChange: React.Dispatch<React.SetStateAction<any>>
  onBack: () => void
  onNext: () => void
  detector: React.RefObject<FaceDetector | null>
  detectorLoading: boolean
  detectorError: string | null
  onRetry: () => void
}

export function PhotoStep({
  data,
  onChange,
  onBack,
  onNext,
  detector,
  detectorLoading,
  detectorError,
  onRetry,
}: PhotoStepProps) {
  const [status, setStatus] = React.useState<PhotoStatus>({ state: "idle" })
  const [cameraActive, setCameraActive] = React.useState(false)
  const [isSwitching, setIsSwitching] = React.useState(false)
  const [needsUserGesture, setNeedsUserGesture] = React.useState(false)
  const [permissionState, setPermissionState] = React.useState<
    "unknown" | "granted" | "denied" | "prompt"
  >("unknown")

  const statusRef = React.useRef<PhotoStatus>({ state: "idle" })
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const frameCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const lastCheckRef = React.useRef(0)
  const checkingRef = React.useRef(false)
  const capturedRef = React.useRef(false)
  const currentFacingRef = React.useRef<"environment">("environment")

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }, [])

  const startCamera = React.useCallback(
    async () => {
      try {
        const desired = currentFacingRef.current
        if (cameraActive) {
          return
        }
        if (navigator.permissions?.query) {
          const perm = await navigator.permissions.query({
            name: "camera" as PermissionName,
          })
          setPermissionState(perm.state)
        }
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { exact: "environment" },
          },
        }
        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints)
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
          })
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        capturedRef.current = false
        setCameraActive(true)
        setPermissionState("granted")
        setNeedsUserGesture(false)
      } catch (error) {
        const err = error as DOMException
        if (err?.name === "NotAllowedError") {
          setNeedsUserGesture(true)
          setPermissionState("prompt")
          return
        }
        setPermissionState("denied")
        toast.error("Unable to access camera. Please enable permission.")
      }
    },
    [cameraActive, stopCamera]
  )

  React.useEffect(() => {
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "camera" as PermissionName })
        .then((perm) => {
          setPermissionState(perm.state)
        })
        .catch(() => setPermissionState("unknown"))
    }
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  React.useEffect(() => {
    if (!cameraActive || !streamRef.current || !videoRef.current) return
    videoRef.current.srcObject = streamRef.current
    void videoRef.current.play()
  }, [cameraActive])

  const setStatusSafe = React.useCallback((next: PhotoStatus) => {
    const prev = statusRef.current
    const same =
      prev.state === next.state &&
      prev.compliant === next.compliant &&
      prev.message === next.message &&
      JSON.stringify(prev.reasons ?? []) === JSON.stringify(next.reasons ?? [])
    if (same) return
    statusRef.current = next
    setStatus(next)
  }, [])

  const processPhoto = React.useCallback(
    async (imageSource: string, silent = false) => {
      if (statusRef.current.state !== "processing") {
        setStatusSafe({ ...statusRef.current, state: "processing" })
      }
      try {
        const img = new Image()
        img.src = imageSource
        await img.decode()

        const validation = validatePhoto(img, detector.current)
        if (!validation.pass || !validation.faceBox) {
          onChange((prev: any) => ({ ...prev, photoProcessed: undefined }))
          setStatusSafe({
            state: "ready",
            compliant: false,
            reasons: validation.reasons,
            message: "Adjust your position to meet the requirements.",
          })
          if (!silent) {
            toast.error("Photo failed compliance checks.")
          }
          return false
        }

        const { cropX, cropY, size } = cropSquareAroundFace(
          img,
          validation.faceBox.x,
          validation.faceBox.y,
          validation.faceBox.width,
          validation.faceBox.height
        )

        const canvas = document.createElement("canvas")
        const targetSize = 900
        canvas.width = targetSize
        canvas.height = targetSize
        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error("Canvas not supported.")
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, targetSize, targetSize)
        ctx.drawImage(img, cropX, cropY, size, size, 0, 0, targetSize, targetSize)

        const compressed = compressToTarget(canvas, 150, 300)
        const optimizedPhoto = await compressImageDataUrlIfNeeded(compressed, {
          maxBytes: IMAGE_UPLOAD_MAX_BYTES,
          fileName: "passport",
          preferredType: "image/jpeg",
          allowJpegFallback: true,
          maxWidthOrHeight: targetSize,
        })
        onChange((prev: any) => ({ ...prev, photoProcessed: optimizedPhoto.value }))
        setStatusSafe({
          state: "ready",
          compliant: true,
          reasons: [],
          message: "Photo accepted and locked in.",
        })
        if (!silent) {
          if (optimizedPhoto.compressed) {
            toast.info("Passport compressed below 100KB.")
          }
          toast.success("Photo accepted and optimized.")
        }
        return true
      } catch {
        setStatusSafe({
          state: "error",
          message: "Unable to process photo. Please try again.",
        })
        if (!silent) {
          toast.error("Unable to process photo.")
        }
        return false
      }
    },
    [detector, onChange, setStatusSafe]
  )

  React.useEffect(() => {
    if (!cameraActive || detectorLoading) return
    let rafId = 0

    const loop = async (time: number) => {
      if (!videoRef.current) {
        rafId = requestAnimationFrame(loop)
        return
      }
      if (capturedRef.current) return
      if (time - lastCheckRef.current < 900) {
        rafId = requestAnimationFrame(loop)
        return
      }
      if (checkingRef.current) {
        rafId = requestAnimationFrame(loop)
        return
      }
      const video = videoRef.current
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        rafId = requestAnimationFrame(loop)
        return
      }
      checkingRef.current = true
      lastCheckRef.current = time
      try {
        if (!frameCanvasRef.current) {
          frameCanvasRef.current = document.createElement("canvas")
        }
        const canvas = frameCanvasRef.current
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error("Canvas not supported.")
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9)
        const passed = await processPhoto(dataUrl, true)
        if (passed) {
          capturedRef.current = true
          stopCamera()
          toast.success("Perfect! Photo captured automatically.")
        }
      } finally {
        checkingRef.current = false
        if (!capturedRef.current) {
          rafId = requestAnimationFrame(loop)
        }
      }
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [cameraActive, detectorLoading, processPhoto, stopCamera])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capture Passport Photograph</CardTitle>
        <CardDescription>
          The camera is live. We will auto-capture once your photo meets the
          requirements.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {detectorLoading && (
          <Alert>
            <AlertTitle>Loading face detection</AlertTitle>
            <AlertDescription>
              Preparing compliance checks. This takes a few seconds.
            </AlertDescription>
          </Alert>
        )}
        {detectorError && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-800">
            <AlertTitle>Face detection unavailable</AlertTitle>
            <AlertDescription>
              {detectorError}{" "}
              <Button
                variant="ghost"
                className="ml-2 h-auto px-2 py-1 text-amber-700"
                onClick={onRetry}
              >
                <RefreshCw className="h-4 w-4" /> Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 sm:p-4">
          {!cameraActive && (
            <div className="flex flex-col items-center gap-3 text-center">
              <Camera className="h-8 w-8 text-slate-500" />
              <p className="text-sm text-slate-600">
                Enable your camera to continue. The system will capture
                automatically.
              </p>
              {needsUserGesture && (
                <p className="text-xs text-slate-500">
                  Tap Enable Camera to start the live capture.
                </p>
              )}
              {permissionState === "denied" && (
                <p className="text-xs text-amber-700">
                  Camera access is blocked. Allow it in your browser/site
                  settings and refresh this page.
                </p>
              )}
              {permissionState === "prompt" && (
                <p className="text-xs text-slate-500">
                  Your browser will ask for camera permission.
                </p>
              )}
              <Button
                variant="secondary"
                onClick={() => void startCamera()}
                disabled={isSwitching}
                className="w-full sm:w-auto"
              >
                Enable Camera
              </Button>
            </div>
          )}
          {cameraActive && (
            <div className="space-y-3">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full rounded-md border border-slate-200"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={stopCamera} disabled={isSwitching} className="w-full sm:w-auto">
                  Pause Camera
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void startCamera()}
                  disabled={isSwitching}
                  className="w-full sm:w-auto"
                >
                  Resume Camera
                </Button>
              </div>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
            <p className="text-sm font-semibold text-slate-800">Compliance status</p>
            {status.state === "processing" && (
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking live frame...
              </div>
            )}
            {status.state === "ready" && (
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {status.compliant ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-amber-600" />
                  )}
                  <span
                    className={
                      status.compliant ? "text-emerald-700" : "text-amber-700"
                    }
                  >
                    {status.message}
                  </span>
                </div>
                {status.reasons && status.reasons.length > 0 && (
                  <ul className="list-disc pl-5 text-xs text-slate-600">
                    {status.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {status.state === "error" && (
              <p className="mt-2 text-sm text-red-600">{status.message}</p>
            )}
          </div>
        </div>

        <Alert>
          <AlertTitle>Live guidance for a perfect capture</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 text-xs text-slate-600 sm:text-sm">
              <li>Move the phone slightly backward or forward until your face fills the frame.</li>
              <li>Keep your face centered and level (no tilt).</li>
              <li>Use a plain background with even lighting.</li>
              <li>Remove caps, headphones, or tinted glasses.</li>
              <li>Face should not be too close to the camera.</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Alert className="border-slate-200 bg-white">
          <AlertTitle>Permission Help (Mobile)</AlertTitle>
          <AlertDescription>
            <div className="space-y-3 text-xs text-slate-600 sm:text-sm">
              <div>
                <p className="font-semibold text-slate-800">Chrome / Android</p>
                <ul className="list-disc pl-5">
                  <li>Tap the lock icon in the address bar.</li>
                  <li>Set Camera to Allow.</li>
                  <li>Reload the page and tap Enable Camera.</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Safari / iOS</p>
                <ul className="list-disc pl-5">
                  <li>Open Settings &rarr; Safari &rarr; Camera.</li>
                  <li>Select Allow, then return to this page.</li>
                  <li>Reload the page to prompt permission.</li>
                </ul>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter className="flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
          Back
        </Button>
        <Button onClick={onNext} disabled={!data.photoProcessed} className="w-full sm:w-auto">
          Next
        </Button>
      </CardFooter>
    </Card>
  )
}
