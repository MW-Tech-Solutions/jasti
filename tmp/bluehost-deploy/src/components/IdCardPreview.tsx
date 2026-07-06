import * as React from "react"
import templateImage from "@/assets/template.jpeg"
import { resolveApiAssetUrl } from "@/lib/studentApi"

type IdCardPreviewProps = {
  data: {
    matric: string
    fullName?: string
    first_name?: string | null
    other_name?: string | null
    last_name?: string | null
    department?: string | null
    phone?: string
    photoProcessed?: string
    signatureProcessed?: string
    validity?: string | number
    graduation_year?: string | number
  }
  size?: "compact" | "full"
  textBoxOffsetY?: number
  forceScale?: number
}

type OverlayBox = {
  left: number
  top: number
  width: number
  height: number
}

const TEMPLATE_WIDTH = 1019
const TEMPLATE_HEIGHT = 659

const PHOTO_BOX: OverlayBox = { left: 689, top: 105, width: 255, height: 282 }
const NAME_BOX: OverlayBox = { left: 578, top: 419, width: 426, height: 32 }
const DEPARTMENT_BOX: OverlayBox = { left: 564, top: 463, width: 436, height: 32 }
const MATRIC_BOX: OverlayBox = { left: 620, top: 507, width: 397, height: 33 }
const VALIDITY_BOX: OverlayBox = { left: 650, top: 551, width: 361, height: 33 }
const SIGNATURE_BOX: OverlayBox = { left: 675, top: 602, width: 300, height: 30 }
const NAME_MIN_FONT_SIZE = 19
const NAME_MAX_FONT_SIZE = 32
const NAME_PADDING_LEFT = 4
const NAME_FIT_SAFE_MARGIN = 8
const NAME_TARGET_WIDTH_RATIO = 0.92
const NAME_MAX_STRETCH_LETTER_SPACING = 0.08
const NAME_LETTER_SPACING_CANDIDATES = [0.03, 0.025, 0.02, 0.015, 0.01, 0.005, 0]

type NameFitResult = {
  text: string
  fontSize: number
  letterSpacingEm: number
}

function normalizeField(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function fitField(value: string) {
  return normalizeField(value).toUpperCase()
}

function abbreviateMiddleNames(value: string) {
  const parts = normalizeField(value).split(" ").filter(Boolean)
  if (parts.length <= 2) return normalizeField(value)
  const [firstName, ...rest] = parts
  const lastName = rest.pop() ?? ""
  const middleInitials = rest
    .map((part) => (part[0] ? `${part[0]}.` : ""))
    .filter(Boolean)
  return [firstName, ...middleInitials, lastName].join(" ").trim()
}

let measurementCanvas: HTMLCanvasElement | null = null

function getMeasurementContext() {
  if (typeof document === "undefined") return null
  if (!measurementCanvas) {
    measurementCanvas = document.createElement("canvas")
  }
  return measurementCanvas.getContext("2d")
}

function measureNameWidth(text: string, fontSize: number, letterSpacingEm: number) {
  if (!text) return 0
  const context = getMeasurementContext()
  if (!context) {
    // Fallback estimate for non-browser environments.
    const estimatedGlyphWidth = text.length * fontSize * 0.62
    const letterSpacingWidth = Math.max(0, text.length - 1) * letterSpacingEm * fontSize
    return estimatedGlyphWidth + letterSpacingWidth
  }
  context.font = `700 ${fontSize}px "Bebas Neue", sans-serif`
  const glyphWidth = context.measureText(text).width
  const letterSpacingWidth = Math.max(0, text.length - 1) * letterSpacingEm * fontSize
  return glyphWidth + letterSpacingWidth
}

function measureNameGlyphWidth(text: string, fontSize: number) {
  if (!text) return 0
  const context = getMeasurementContext()
  if (!context) {
    return text.length * fontSize * 0.62
  }
  context.font = `700 ${fontSize}px "Bebas Neue", sans-serif`
  return context.measureText(text).width
}

function findLargestFittingFontSize(
  text: string,
  availableWidth: number,
  letterSpacingEm: number
) {
  for (let size = NAME_MAX_FONT_SIZE; size >= NAME_MIN_FONT_SIZE; size -= 0.25) {
    if (measureNameWidth(text, size, letterSpacingEm) <= availableWidth) {
      return Number(size.toFixed(2))
    }
  }
  return NAME_MIN_FONT_SIZE
}

function stretchLetterSpacing(
  text: string,
  fontSize: number,
  baseLetterSpacingEm: number,
  availableWidth: number
) {
  const slots = Math.max(0, text.length - 1)
  if (slots <= 0) return baseLetterSpacingEm

  const glyphWidth = measureNameGlyphWidth(text, fontSize)
  const currentWidth = glyphWidth + slots * baseLetterSpacingEm * fontSize
  const targetWidth = Math.min(availableWidth, availableWidth * NAME_TARGET_WIDTH_RATIO)
  if (currentWidth >= targetWidth) return baseLetterSpacingEm

  const idealSpacing = (targetWidth - glyphWidth) / (slots * fontSize)
  const clampedIdeal = Math.max(
    baseLetterSpacingEm,
    Math.min(NAME_MAX_STRETCH_LETTER_SPACING, idealSpacing)
  )
  const maxSpacingThatFits = (availableWidth - glyphWidth) / (slots * fontSize)
  const clampedMaxFit = Math.max(
    baseLetterSpacingEm,
    Math.min(NAME_MAX_STRETCH_LETTER_SPACING, maxSpacingThatFits)
  )
  return Math.min(clampedIdeal, clampedMaxFit)
}

function fitNameIntoBox(rawName: string, boxWidth: number): NameFitResult {
  const normalizedName = fitField(rawName)
  if (!normalizedName) {
    return { text: "", fontSize: NAME_MAX_FONT_SIZE, letterSpacingEm: 0.03 }
  }

  const availableWidth = Math.max(50, boxWidth - NAME_PADDING_LEFT - NAME_FIT_SAFE_MARGIN)
  const abbreviatedName = fitField(abbreviateMiddleNames(normalizedName))
  const candidates = abbreviatedName && abbreviatedName !== normalizedName
    ? [normalizedName, abbreviatedName]
    : [normalizedName]

  let bestResult: NameFitResult | null = null

  for (const candidate of candidates) {
    for (const letterSpacingEm of NAME_LETTER_SPACING_CANDIDATES) {
      const fontSize = findLargestFittingFontSize(candidate, availableWidth, letterSpacingEm)
      const width = measureNameWidth(candidate, fontSize, letterSpacingEm)
      const fits = width <= availableWidth + 0.25
      if (!fits && fontSize <= NAME_MIN_FONT_SIZE) continue

      const nextResult: NameFitResult = {
        text: candidate,
        fontSize,
        letterSpacingEm,
      }

      const isBetter =
        !bestResult ||
        nextResult.fontSize > bestResult.fontSize ||
        (nextResult.fontSize === bestResult.fontSize && nextResult.text.length > bestResult.text.length)

      if (isBetter) {
        bestResult = nextResult
      }
    }
  }

  if (bestResult) {
    return {
      ...bestResult,
      letterSpacingEm: stretchLetterSpacing(
        bestResult.text,
        bestResult.fontSize,
        bestResult.letterSpacingEm,
        availableWidth
      ),
    }
  }

  // Last-resort fallback: enforce single-line fit with ellipsis at minimum readable size.
  const ellipsis = "…"
  let trimmed = normalizedName
  while (
    trimmed.length > 1 &&
    measureNameWidth(`${trimmed}${ellipsis}`, NAME_MIN_FONT_SIZE, 0.005) > availableWidth
  ) {
    trimmed = trimmed.slice(0, -1).trimEnd()
  }
  return {
    text: `${trimmed}${ellipsis}`,
    fontSize: NAME_MIN_FONT_SIZE,
    letterSpacingEm: 0.005,
  }
}

function toPx(value: number) {
  return `${value}px`
}

function toBoxStyle(box: OverlayBox) {
  return {
    left: toPx(box.left),
    top: toPx(box.top),
    width: toPx(box.width),
    height: toPx(box.height),
  } as const
}

function toBoxStyleWithOffset(box: OverlayBox, offsetY: number) {
  return {
    left: toPx(box.left),
    top: toPx(box.top + offsetY),
    width: toPx(box.width),
    height: toPx(box.height),
  } as const
}

export function IdCardPreview({
  data,
  size = "full",
  textBoxOffsetY = 0,
  forceScale,
}: IdCardPreviewProps) {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = React.useState(forceScale ?? 1)
  const [fontMeasurementReady, setFontMeasurementReady] = React.useState(false)

  React.useEffect(() => {
    if (typeof forceScale === "number" && Number.isFinite(forceScale) && forceScale > 0) {
      setScale(forceScale)
      return
    }

    const wrapper = wrapperRef.current
    if (!wrapper) return

    const syncScale = () => {
      const nextScale = wrapper.clientWidth / TEMPLATE_WIDTH
      if (Number.isFinite(nextScale) && nextScale > 0) {
        setScale(nextScale)
      }
    }

    syncScale()
    window.addEventListener("resize", syncScale)
    window.addEventListener("beforeprint", syncScale)

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(syncScale)
      observer.observe(wrapper)
    }

    return () => {
      window.removeEventListener("resize", syncScale)
      window.removeEventListener("beforeprint", syncScale)
      observer?.disconnect()
    }
  }, [])

  React.useEffect(() => {
    if (typeof document === "undefined" || !("fonts" in document)) {
      setFontMeasurementReady(true)
      return
    }

    let cancelled = false
    void document.fonts.ready
      .then(() => {
        if (!cancelled) setFontMeasurementReady(true)
      })
      .catch(() => {
        if (!cancelled) setFontMeasurementReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Build full name from API fields when available. Prefer API first_name/other_name/last_name,
  // fall back to `fullName` if present for backward compatibility. Do not invent values.
  const nameParts = [data.first_name, data.other_name, data.last_name].filter(Boolean) as string[]
  const fullName = nameParts.length > 0 ? nameParts.join(" ") : (data.fullName ?? "")

  // Prefer explicit validity/graduation_year from API. Do not compute a default year.
  const validity = data.validity ?? data.graduation_year ?? ""
  const nameFit = React.useMemo(
    () => fitNameIntoBox(fullName, NAME_BOX.width),
    [fontMeasurementReady, fullName]
  )
  const displayName = nameFit.text
  const displayDepartment = fitField(data.department ?? "")
  const displayMatric = fitField(data.matric || "--")
  const displayValidity = fitField(String(validity ?? ""))
  const detailTextStyle = {
    fontFamily: '"Bebas Neue", sans-serif',
    fontSize: toPx(30),
    paddingLeft: toPx(4),
  } as const
  const departmentLength = displayDepartment.length
  const departmentFontSize = departmentLength > 24 ? 24 : departmentLength > 20 ? 26 : 30
  const departmentLetterSpacing =
    departmentLength > 24 ? "0.05em" : departmentLength > 20 ? "0.04em" : "0.03em"
  const matricLetterSpacing = "0.08em"
  const validityLetterSpacing = "0.1em"
  const matricFontSize = 30
  const validityFontSize = 30
  const detailTextClassName =
    "id-card-text absolute flex items-center overflow-hidden text-ellipsis whitespace-nowrap font-bold uppercase leading-none tracking-[0.01em] text-black"

  const wrapperMaxWidthClass =
    size === "compact" ? "max-w-full sm:max-w-[620px]" : "max-w-full sm:max-w-[820px]"
  const scaledHeight = TEMPLATE_HEIGHT * scale
  const photoSrc = resolveApiAssetUrl(data.photoProcessed)
  const signatureSrc = resolveApiAssetUrl(data.signatureProcessed)
  const [photoLoadFailed, setPhotoLoadFailed] = React.useState(false)
  const [signatureLoadFailed, setSignatureLoadFailed] = React.useState(false)

  React.useEffect(() => {
    setPhotoLoadFailed(false)
  }, [photoSrc])

  React.useEffect(() => {
    setSignatureLoadFailed(false)
  }, [signatureSrc])

  const effectivePhotoSrc = photoLoadFailed ? "" : photoSrc
  const effectiveSignatureSrc = signatureLoadFailed ? "" : signatureSrc

  return (
    <div
      ref={wrapperRef}
      className={`mx-auto w-full ${forceScale ? "" : wrapperMaxWidthClass}`}
      style={forceScale ? { width: toPx(TEMPLATE_WIDTH) } : undefined}
    >
      <div
        className="relative w-full overflow-hidden"
        style={{ height: toPx(scaledHeight) }}
        data-id-card-frame="true"
      >
        <div
          data-id-card-canvas="true"
          className="absolute left-0 top-0 origin-top-left overflow-hidden bg-white"
          style={{
            width: toPx(TEMPLATE_WIDTH),
            height: toPx(TEMPLATE_HEIGHT),
            transform: `scale(${scale})`,
          }}
        >
          <img
            src={templateImage}
            alt="Student ID template"
            className="absolute inset-0 h-full w-full object-fill"
            style={{ zIndex: 0 }}
          />

          <div className="absolute overflow-hidden" style={{ ...toBoxStyle(PHOTO_BOX), zIndex: 1 }}>
            {effectivePhotoSrc ? (
              <img
                src={effectivePhotoSrc}
                alt="Student portrait"
                crossOrigin="anonymous"
                onError={() => setPhotoLoadFailed(true)}
                className="h-full w-full bg-white object-fill"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white/70 text-[10px] text-slate-500">
                --
              </div>
            )}
          </div>

          <div
            data-id-card-field="name"
            data-base-top={NAME_BOX.top}
            className={detailTextClassName}
            style={{
              ...detailTextStyle,
              ...toBoxStyleWithOffset(NAME_BOX, textBoxOffsetY),
              fontSize: toPx(nameFit.fontSize),
              letterSpacing: `${nameFit.letterSpacingEm}em`,
              zIndex: 2,
            }}
            title={fullName}
          >
            <span>{displayName}</span>
          </div>
          <div
            data-id-card-field="department"
            data-base-top={DEPARTMENT_BOX.top}
            className={detailTextClassName}
            style={{
              ...detailTextStyle,
              ...toBoxStyleWithOffset(DEPARTMENT_BOX, textBoxOffsetY),
              fontSize: toPx(departmentFontSize),
              letterSpacing: departmentLetterSpacing,
              zIndex: 2,
            }}
            title={data.department ?? ""}
          >
            <span>{displayDepartment}</span>
          </div>
          <div
            data-id-card-field="matric"
            data-base-top={MATRIC_BOX.top}
            className={detailTextClassName}
            style={{
              ...detailTextStyle,
              ...toBoxStyleWithOffset(MATRIC_BOX, textBoxOffsetY),
              zIndex: 2,
            }}
            title={data.matric || "--"}
          >
            <span style={{ fontSize: toPx(matricFontSize), letterSpacing: matricLetterSpacing }}>
              {displayMatric}
            </span>
          </div>
          <div
            data-id-card-field="validity"
            data-base-top={VALIDITY_BOX.top}
            className={detailTextClassName}
            style={{
              ...detailTextStyle,
              ...toBoxStyleWithOffset(VALIDITY_BOX, textBoxOffsetY),
              zIndex: 2,
            }}
            title={String(validity ?? "")}
          >
            <span style={{ fontSize: toPx(validityFontSize), letterSpacing: validityLetterSpacing }}>
              {displayValidity}
            </span>
          </div>

          <div className="absolute overflow-hidden" style={{ ...toBoxStyle(SIGNATURE_BOX), zIndex: 2 }}>
            {effectiveSignatureSrc ? (
              <img
                src={effectiveSignatureSrc}
                alt="Signature"
                crossOrigin="anonymous"
                onError={() => setSignatureLoadFailed(true)}
                className="h-full w-full bg-white object-fill"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                --
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
