export function getImageData(img: HTMLImageElement) {
  const canvas = document.createElement("canvas")
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas not supported.")
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return { data: imageData.data, width: canvas.width, height: canvas.height }
}

export function computeBrightness(data: Uint8ClampedArray) {
  let sum = 0
  for (let i = 0; i < data.length; i += 4) {
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3
  }
  return sum / (data.length / 4)
}

export function computeLaplacianVariance(
  data: Uint8ClampedArray,
  width: number,
  height: number
) {
  const gray = new Float32Array(width * height)
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  const laplacian = new Float32Array(width * height)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const value =
        gray[idx - width] +
        gray[idx - 1] +
        gray[idx + 1] +
        gray[idx + width] -
        gray[idx] * 4
      laplacian[idx] = value
    }
  }
  let mean = 0
  for (let i = 0; i < laplacian.length; i++) {
    mean += laplacian[i]
  }
  mean /= laplacian.length
  let variance = 0
  for (let i = 0; i < laplacian.length; i++) {
    const diff = laplacian[i] - mean
    variance += diff * diff
  }
  return variance / laplacian.length
}

export function computeEdgeDensityOutsideFace(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  faceX: number,
  faceY: number,
  faceW: number,
  faceH: number
) {
  const gray = new Float32Array(width * height)
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  let edgeCount = 0
  let totalCount = 0
  const threshold = 20
  const startX = Math.max(1, Math.floor(faceX))
  const startY = Math.max(1, Math.floor(faceY))
  const endX = Math.min(width - 2, Math.ceil(faceX + faceW))
  const endY = Math.min(height - 2, Math.ceil(faceY + faceH))
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const insideFace =
        x >= startX && x <= endX && y >= startY && y <= endY
      if (insideFace) continue
      const idx = y * width + x
      const dx = gray[idx + 1] - gray[idx - 1]
      const dy = gray[idx + width] - gray[idx - width]
      const magnitude = Math.sqrt(dx * dx + dy * dy)
      totalCount++
      if (magnitude > threshold) edgeCount++
    }
  }
  return totalCount === 0 ? 0 : edgeCount / totalCount
}

export function cropSquareAroundFace(
  img: HTMLImageElement,
  faceX: number,
  faceY: number,
  faceW: number,
  faceH: number,
  margin = 0.35
) {
  const faceCenterX = faceX + faceW / 2
  const faceCenterY = faceY + faceH / 2
  const squareSide = Math.min(
    Math.max(faceW, faceH) * (1 + margin * 2),
    Math.min(img.width, img.height)
  )
  let cropX = faceCenterX - squareSide / 2
  let cropY = faceCenterY - squareSide / 2
  cropX = Math.max(0, Math.min(cropX, img.width - squareSide))
  cropY = Math.max(0, Math.min(cropY, img.height - squareSide))
  return { cropX, cropY, size: squareSide }
}

export function compressToTarget(
  canvas: HTMLCanvasElement,
  minKb: number,
  maxKb: number
) {
  let quality = 0.92
  let dataUrl = canvas.toDataURL("image/jpeg", quality)
  let sizeKb = dataUrlSizeKb(dataUrl)
  while (sizeKb > maxKb && quality > 0.6) {
    quality -= 0.06
    dataUrl = canvas.toDataURL("image/jpeg", quality)
    sizeKb = dataUrlSizeKb(dataUrl)
  }
  if (sizeKb < minKb && quality < 0.95) {
    const boosted = canvas.toDataURL("image/jpeg", 0.95)
    if (dataUrlSizeKb(boosted) <= maxKb * 1.2) {
      dataUrl = boosted
    }
  }
  return dataUrl
}

export function dataUrlSizeKb(dataUrl: string) {
  const base64Length = dataUrl.split(",")[1]?.length ?? 0
  return (base64Length * 3) / 4 / 1024
}

export function clamp(value: number) {
  return Math.max(0, Math.min(255, value))
}
