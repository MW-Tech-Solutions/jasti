import { clamp } from "@/utils/imageProcessing"

type SignatureResult = {
  processed: string
}

export async function processSignature(dataUrl: string): Promise<SignatureResult> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()

  const canvas = document.createElement("canvas")
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas not supported.")

  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  const gray = new Uint8ClampedArray(canvas.width * canvas.height)
  const alpha = new Uint8ClampedArray(canvas.width * canvas.height)
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    alpha[j] = data[i + 3]
  }

  const integral = new Uint32Array((canvas.width + 1) * (canvas.height + 1))
  for (let y = 1; y <= canvas.height; y++) {
    let rowSum = 0
    for (let x = 1; x <= canvas.width; x++) {
      const idx = (y - 1) * canvas.width + (x - 1)
      rowSum += gray[idx]
      integral[y * (canvas.width + 1) + x] =
        integral[(y - 1) * (canvas.width + 1) + x] + rowSum
    }
  }

  const bg = estimateBorderBackground(data, canvas.width, canvas.height)
  const bgGray = Math.round(0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b)

  const radius = 9
  const offset = 10
  const mask = new Uint8ClampedArray(canvas.width * canvas.height)

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const x1 = Math.max(0, x - radius)
      const y1 = Math.max(0, y - radius)
      const x2 = Math.min(canvas.width - 1, x + radius)
      const y2 = Math.min(canvas.height - 1, y + radius)
      const area = (x2 - x1 + 1) * (y2 - y1 + 1)
      const sum =
        integral[(y2 + 1) * (canvas.width + 1) + (x2 + 1)] -
        integral[y1 * (canvas.width + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (canvas.width + 1) + x1] +
        integral[y1 * (canvas.width + 1) + x1]
      const mean = sum / area
      const g = gray[y * canvas.width + x]
      const idx = y * canvas.width + x
      const sourceAlpha = alpha[idx]
      const i = idx * 4
      const colorDistance = Math.sqrt(
        (data[i] - bg.r) * (data[i] - bg.r) +
          (data[i + 1] - bg.g) * (data[i + 1] - bg.g) +
          (data[i + 2] - bg.b) * (data[i + 2] - bg.b)
      )

      const localAdaptive = g < mean - offset
      const bgContrast = g < bgGray - 14
      const colorContrast = colorDistance > 26 && g < 245
      const transparentInk = sourceAlpha > 0 && sourceAlpha < 245 && g < 245
      mask[idx] = localAdaptive || bgContrast || colorContrast || transparentInk ? 255 : 0
    }
  }

  const cleaned = removeSmallConnectedRegions(mask, canvas.width, canvas.height, 14)
  const closed = closeMask(cleaned, canvas.width, canvas.height)
  const thickened = dilateMask(dilateMask(closed, canvas.width, canvas.height), canvas.width, canvas.height)

  const bounds = findMaskBounds(thickened, canvas.width, canvas.height)

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    if (thickened[j] > 0) {
      const boosted = clamp((gray[j] - 128) * 1.35 + 112)
      data[i] = boosted
      data[i + 1] = boosted
      data[i + 2] = boosted
      data[i + 3] = 255
    } else {
      data[i + 3] = 0
    }
  }

  const smooth = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const smoothData = smooth.data
  const copy = new Uint8ClampedArray(data)
  for (let y = 1; y < canvas.height - 1; y++) {
    for (let x = 1; x < canvas.width - 1; x++) {
      const idx = (y * canvas.width + x) * 4 + 3
      let alphaSum = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const kidx = ((y + ky) * canvas.width + (x + kx)) * 4 + 3
          alphaSum += copy[kidx]
        }
      }
      smoothData[idx] = Math.round(alphaSum / 9)
      smoothData[idx - 3] = copy[idx - 3]
      smoothData[idx - 2] = copy[idx - 2]
      smoothData[idx - 1] = copy[idx - 1]
    }
  }

  ctx.putImageData(smooth, 0, 0)
  const cropped = cropToBounds(canvas, bounds)
  return { processed: cropped.toDataURL("image/png") }
}

export async function cropSignature(
  dataUrl: string,
  crop: { top: number; right: number; bottom: number; left: number }
) {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const canvas = document.createElement("canvas")
  const cropLeft = Math.round((crop.left / 100) * img.width)
  const cropRight = Math.round((crop.right / 100) * img.width)
  const cropTop = Math.round((crop.top / 100) * img.height)
  const cropBottom = Math.round((crop.bottom / 100) * img.height)
  const width = Math.max(10, img.width - cropLeft - cropRight)
  const height = Math.max(10, img.height - cropTop - cropBottom)
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return dataUrl
  ctx.drawImage(img, cropLeft, cropTop, width, height, 0, 0, width, height)
  return canvas.toDataURL("image/png")
}

function closeMask(mask: Uint8ClampedArray, width: number, height: number) {
  const dilated = dilateMask(mask, width, height)
  return erodeMask(dilated, width, height)
}

function estimateBorderBackground(data: Uint8ClampedArray, width: number, height: number) {
  const borderBand = Math.max(2, Math.floor(Math.min(width, height) * 0.03))
  let rSum = 0
  let gSum = 0
  let bSum = 0
  let count = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const onBorder =
        x < borderBand || y < borderBand || x >= width - borderBand || y >= height - borderBand
      if (!onBorder) continue
      const idx = (y * width + x) * 4
      const a = data[idx + 3]
      if (a === 0) continue
      rSum += data[idx]
      gSum += data[idx + 1]
      bSum += data[idx + 2]
      count++
    }
  }

  if (count === 0) return { r: 255, g: 255, b: 255 }
  return {
    r: Math.round(rSum / count),
    g: Math.round(gSum / count),
    b: Math.round(bSum / count),
  }
}

function removeSmallConnectedRegions(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  minPixels: number
) {
  const visited = new Uint8Array(mask.length)
  const out = new Uint8ClampedArray(mask)
  const qx = new Int32Array(mask.length)
  const qy = new Int32Array(mask.length)
  const region = new Int32Array(mask.length)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x
      if (mask[start] === 0 || visited[start] === 1) continue

      let head = 0
      let tail = 0
      let regionCount = 0
      qx[tail] = x
      qy[tail] = y
      tail++
      visited[start] = 1

      while (head < tail) {
        const cx = qx[head]
        const cy = qy[head]
        head++
        const idx = cy * width + cx
        region[regionCount++] = idx

        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (ox === 0 && oy === 0) continue
            const nx = cx + ox
            const ny = cy + oy
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
            const nIdx = ny * width + nx
            if (visited[nIdx] === 1 || mask[nIdx] === 0) continue
            visited[nIdx] = 1
            qx[tail] = nx
            qy[tail] = ny
            tail++
          }
        }
      }

      if (regionCount < minPixels) {
        for (let i = 0; i < regionCount; i++) {
          out[region[i]] = 0
        }
      }
    }
  }

  return out
}

function dilateMask(mask: Uint8ClampedArray, width: number, height: number) {
  const out = new Uint8ClampedArray(mask.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let max = 0
      for (let ky = -1; ky <= 1; ky++) {
        const ny = y + ky
        if (ny < 0 || ny >= height) continue
        for (let kx = -1; kx <= 1; kx++) {
          const nx = x + kx
          if (nx < 0 || nx >= width) continue
          const v = mask[ny * width + nx]
          if (v > max) max = v
        }
      }
      out[y * width + x] = max
    }
  }
  return out
}

function erodeMask(mask: Uint8ClampedArray, width: number, height: number) {
  const out = new Uint8ClampedArray(mask.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let min = 255
      for (let ky = -1; ky <= 1; ky++) {
        const ny = y + ky
        if (ny < 0 || ny >= height) continue
        for (let kx = -1; kx <= 1; kx++) {
          const nx = x + kx
          if (nx < 0 || nx >= width) continue
          const v = mask[ny * width + nx]
          if (v < min) min = v
        }
      }
      out[y * width + x] = min
    }
  }
  return out
}

function findMaskBounds(mask: Uint8ClampedArray, width: number, height: number) {
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  let hasPixel = false
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] > 0) {
        hasPixel = true
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  if (!hasPixel) {
    return { x: 0, y: 0, w: width, h: height }
  }
  const padding = 12
  const x = Math.max(0, minX - padding)
  const y = Math.max(0, minY - padding)
  const w = Math.min(width - x, maxX - minX + padding * 2)
  const h = Math.min(height - y, maxY - minY + padding * 2)
  return { x, y, w, h }
}

function cropToBounds(canvas: HTMLCanvasElement, bounds: { x: number; y: number; w: number; h: number }) {
  const out = document.createElement("canvas")
  out.width = bounds.w
  out.height = bounds.h
  const ctx = out.getContext("2d")
  if (!ctx) return canvas
  ctx.drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h)
  return out
}
