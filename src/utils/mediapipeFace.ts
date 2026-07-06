import * as React from "react"
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision"

let detectorPromise: Promise<FaceDetector> | null = null

async function createDetector() {
  const fileset = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  )
  return FaceDetector.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
    },
    runningMode: "IMAGE",
  })
}

export function useFaceDetector() {
  const detectorRef = React.useRef<FaceDetector | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const initialize = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!detectorPromise) {
        detectorPromise = createDetector()
      }
      detectorRef.current = await detectorPromise
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load face detection.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void initialize()
  }, [initialize])

  return { detectorRef, loading, error, retry: initialize }
}
