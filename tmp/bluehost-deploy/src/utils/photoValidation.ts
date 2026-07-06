import { FaceDetector } from "@mediapipe/tasks-vision"
import {
  computeBrightness,
  computeEdgeDensityOutsideFace,
  computeLaplacianVariance,
  getImageData,
} from "@/utils/imageProcessing"

type PhotoValidationResult = {
  pass: boolean
  reasons: string[]
  faceBox?: { x: number; y: number; width: number; height: number }
}

export function validatePhoto(
  img: HTMLImageElement,
  detector: FaceDetector | null
): PhotoValidationResult {
  const reasons: string[] = []
  if (!detector) {
    reasons.push("Face detection is unavailable. Please retry.")
  }

  const detectionResults = detector ? detector.detect(img) : null
  const detections = detectionResults?.detections ?? []
  if (detections.length !== 1) {
    reasons.push("Exactly one face must be detected.")
  }

  const bbox = detections[0]?.boundingBox
  if (!bbox?.width || !bbox?.height) {
    reasons.push("Face region could not be measured.")
  }

  if (bbox?.width && bbox?.height) {
    const centerX = (bbox.originX ?? 0) + bbox.width / 2
    const centerY = (bbox.originY ?? 0) + bbox.height / 2
    const offsetX = Math.abs(centerX - img.width / 2) / img.width
    const offsetY = Math.abs(centerY - img.height / 2) / img.height
    if (offsetX > 0.12 || offsetY > 0.12) {
      reasons.push("Face must be centered within 12% of the frame.")
    }
    const faceHeightRatio = bbox.height / img.height
    if (faceHeightRatio < 0.4 || faceHeightRatio > 0.5) {
      reasons.push("Face height should be 40%-50% of image height.")
    }
  }

  const { data, width, height } = getImageData(img)
  const laplacianVariance = computeLaplacianVariance(data, width, height)
  if (laplacianVariance < 80) {
    reasons.push("Image appears blurry. Use a sharper photo.")
  }

  const brightness = computeBrightness(data)
  if (brightness < 70 || brightness > 200) {
    reasons.push("Lighting must be even. Avoid very dark or bright images.")
  }

  if (bbox?.width && bbox?.height) {
    const edgeDensity = computeEdgeDensityOutsideFace(
      data,
      width,
      height,
      bbox.originX ?? 0,
      bbox.originY ?? 0,
      bbox.width,
      bbox.height
    )
    if (edgeDensity > 0.12) {
      reasons.push("Background is too busy. Use a plain background.")
    }
  }

  return {
    pass: reasons.length === 0,
    reasons,
    faceBox: bbox
      ? {
          x: bbox.originX ?? 0,
          y: bbox.originY ?? 0,
          width: bbox.width ?? 0,
          height: bbox.height ?? 0,
        }
      : undefined,
  }
}
