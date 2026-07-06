import { jsPDF } from "jspdf"

export type IdCardStudent = {
  matric: string
  firstName: string
  lastName: string
  otherName?: string
  departmentName?: string
  departmentId?: string
  graduationYear?: string
  passport?: string
  signature?: string
}

const CARD_PDF_WIDTH_MM = 101.9
const CARD_PDF_HEIGHT_MM = 65.9
const PX_PER_MM = 10

const mm = (px: number) => px / PX_PER_MM

const isDataUrl = (value: string) => value.startsWith("data:image/")

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { mode: "cors", cache: "no-cache" })
  if (!res.ok) throw new Error(`Failed to load image: ${url}`)
  const contentType = res.headers.get("content-type") || ""
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`Non-image response for ${url} (${contentType || "unknown content-type"})`)
  }
  const blob = await res.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Failed to convert image to base64"))
    reader.readAsDataURL(blob)
  })
}

async function ensureDataUrl(src?: string): Promise<string | null> {
  if (!src) return null
  if (isDataUrl(src)) return src
  return await urlToDataUrl(src)
}

type NormalizedImageData = {
  dataUrl: string
  format: "PNG" | "JPEG"
  width: number
  height: number
}

export const PDF_BLOB_URL_REVOKE_DELAY_MS = 60_000

async function normalizeImageDataUrl(src?: string | null): Promise<NormalizedImageData | null> {
  if (!src) return null
  let dataUrl: string
  try {
    dataUrl = await ensureDataUrl(src)
  } catch (error) {
    console.warn("Failed to load image source", error)
    return null
  }
  if (!dataUrl) return null

  const image = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
  if (!image) return null

  const canvas = document.createElement("canvas")
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  ctx.drawImage(image, 0, 0)

  return {
    dataUrl: canvas.toDataURL("image/png"),
    format: "PNG",
    width: canvas.width,
    height: canvas.height,
  }
}

/** object-contain equivalent */
function addContainedImage({
  pdf,
  image,
  x,
  y,
  width,
  height,
}: {
  pdf: jsPDF
  image: NormalizedImageData
  x: number
  y: number
  width: number
  height: number
}) {
  const sourceWidth = Number(image.width) || 1
  const sourceHeight = Number(image.height) || 1
  const scale = Math.min(width / sourceWidth, height / sourceHeight)
  const renderWidth = sourceWidth * scale
  const renderHeight = sourceHeight * scale
  const offsetX = x + (width - renderWidth) / 2
  const offsetY = y + (height - renderHeight) / 2

  pdf.addImage(image.dataUrl, image.format, offsetX, offsetY, renderWidth, renderHeight, undefined, "FAST")
}

/** object-fill equivalent (stretch to fill box) */
function addFilledImage({
  pdf,
  image,
  x,
  y,
  width,
  height,
}: {
  pdf: jsPDF
  image: NormalizedImageData
  x: number
  y: number
  width: number
  height: number
}) {
  pdf.addImage(image.dataUrl, image.format, x, y, width, height, undefined, "FAST")
}

/** object-cover equivalent (crop to fill box) */
async function addCoveredImage({
  pdf,
  image,
  x,
  y,
  width,
  height,
}: {
  pdf: jsPDF
  image: NormalizedImageData
  x: number
  y: number
  width: number
  height: number
}) {
  const sourceWidth = Number(image.width) || 1
  const sourceHeight = Number(image.height) || 1
  const targetAspect = width / height
  const sourceAspect = sourceWidth / sourceHeight

  let sourceX = 0
  let sourceY = 0
  let sourceCropWidth = sourceWidth
  let sourceCropHeight = sourceHeight

  if (sourceAspect > targetAspect) {
    sourceCropWidth = sourceHeight * targetAspect
    sourceX = (sourceWidth - sourceCropWidth) / 2
  } else {
    sourceCropHeight = sourceWidth / targetAspect
    sourceY = (sourceHeight - sourceCropHeight) / 2
  }

  const imageElement = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = image.dataUrl
  })

  if (!imageElement) {
    addContainedImage({ pdf, image, x, y, width, height })
    return
  }

  const cropCanvas = document.createElement("canvas")
  cropCanvas.width = Math.max(1, Math.round(sourceCropWidth))
  cropCanvas.height = Math.max(1, Math.round(sourceCropHeight))
  const cropContext = cropCanvas.getContext("2d")
  if (!cropContext) {
    addContainedImage({ pdf, image, x, y, width, height })
    return
  }

  cropContext.drawImage(
    imageElement,
    sourceX,
    sourceY,
    sourceCropWidth,
    sourceCropHeight,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height,
  )

  pdf.addImage(cropCanvas.toDataURL("image/png"), "PNG", x, y, width, height, undefined, "FAST")
}

function safeUpper(value?: string) {
  return (value ?? "").toString().trim().toUpperCase()
}

function joinName(s: IdCardStudent) {
  return [s.firstName, s.otherName, s.lastName].filter(Boolean).join(" ").trim()
}

type GenerateIdCardPdfParams = {
  student: IdCardStudent
  templateFrontUrl: string
  templateBackUrl: string
  resolveAssetUrl?: (pathOrUrl: string) => string
  fileName?: string
  download?: boolean
}

type GenerateBulkParams = {
  students: IdCardStudent[]
  templateFrontUrl: string
  templateBackUrl: string
  resolveAssetUrl?: (pathOrUrl: string) => string
  fileName?: string
  download?: boolean
}

const defaultPassportBox = {
  xPx: 689,
  yPx: 105,
  wPx: 255,
  hPx: 282,
}

const defaultSignatureBox = {
  xPx: 710,
  yPx: 595,
  wPx: 280,
  hPx: 45,
}

const defaultTextLayout = {
  xBasePx: 580 + 70,
  xNameOffsetPx: -70,
  xDeptOffsetPx: -74,
  xMatOffsetPx: -35,
  xValOffsetPx: 0,
  rowNameYPx: 430 + 6,
  rowDeptYPx: 470 + 10,
  rowMatYPx: 520 + 5,
  rowValYPx: 560 + 6,
  nameFontSize: 10,
  deptFontSize: 10,
  matFontSize: 10,
  valFontSize: 10,
  nameWidthPx: 426,
  deptWidthPx: 436,
  matWidthPx: 397,
  valWidthPx: 361,
}

const textMaxWidth = {
  name: mm(defaultTextLayout.nameWidthPx),
  dept: mm(defaultTextLayout.deptWidthPx),
  mat: mm(defaultTextLayout.matWidthPx),
  val: mm(defaultTextLayout.valWidthPx),
}

const BEBAS_FONT_NAME = "BebasNeue"
const BEBAS_FONT_STYLE = "normal"
const DEFAULT_BEBAS_FONT_URL = "/fonts/BebasNeue-Regular.ttf"
let cachedBebasFontBase64: string | null = null

async function loadBebasFont(pdf: jsPDF, fontUrl = DEFAULT_BEBAS_FONT_URL) {
  if (!cachedBebasFontBase64) {
    const res = await fetch(fontUrl, { mode: "cors", cache: "no-cache" })
    if (!res.ok) {
      console.error("Bebas font fetch failed", res.status, fontUrl)
      throw new Error(`Failed to load Bebas Neue font from ${fontUrl}`)
    }
    const buffer = await res.arrayBuffer()
    if (!buffer || buffer.byteLength === 0) {
      console.error("Bebas font empty response", fontUrl)
      throw new Error(`Empty Bebas Neue font response from ${fontUrl}`)
    }
    const bytes = new Uint8Array(buffer)
    let binary = ""
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
    cachedBebasFontBase64 = btoa(binary)
  }
  pdf.addFileToVFS("BebasNeue-Regular.ttf", cachedBebasFontBase64)
  pdf.addFont("BebasNeue-Regular.ttf", BEBAS_FONT_NAME, BEBAS_FONT_STYLE)
}

function drawFittedText({
  pdf,
  text,
  x,
  y,
  maxWidth,
  fontSize,
}: {
  pdf: jsPDF
  text: string
  x: number
  y: number
  maxWidth: number
  fontSize: number
  bold?: boolean
}) {
  const value = text?.trim() || "--"
  pdf.setFont(BEBAS_FONT_NAME, BEBAS_FONT_STYLE)
  let size = fontSize
  pdf.setFontSize(size)
  if (maxWidth > 0) {
    let width = pdf.getTextWidth(value)
    while (width > maxWidth && size > 6) {
      size -= 0.5
      pdf.setFontSize(size)
      width = pdf.getTextWidth(value)
    }
  }
  pdf.text(value, x, y, { baseline: "middle" })
}

async function drawFrontPage({
  pdf,
  student,
  templateFrontUrl,
  resolveAssetUrl,
}: {
  pdf: jsPDF
  student: IdCardStudent
  templateFrontUrl: string
  resolveAssetUrl?: (pathOrUrl: string) => string
}) {
  await loadBebasFont(pdf)

  const templateImage = await normalizeImageDataUrl(templateFrontUrl)
  if (!templateImage) throw new Error("Template image missing.")
  pdf.addImage(
    templateImage.dataUrl,
    templateImage.format,
    0,
    0,
    CARD_PDF_WIDTH_MM,
    CARD_PDF_HEIGHT_MM,
    undefined,
    "FAST",
  )

  const passportSrc = student.passport ? (resolveAssetUrl ? resolveAssetUrl(student.passport) : student.passport) : ""
  const signatureSrc = student.signature ? (resolveAssetUrl ? resolveAssetUrl(student.signature) : student.signature) : ""

  const passportImage = await normalizeImageDataUrl(passportSrc || undefined)
  const signatureImage = await normalizeImageDataUrl(signatureSrc || undefined)

  // ✅ PASSPORT: object-fill (stretch) — replace with addCoveredImage for cover, addContainedImage for contain
  if (passportImage) {
    addFilledImage({
      pdf,
      image: passportImage,
      x: mm(defaultPassportBox.xPx),
      y: mm(defaultPassportBox.yPx),
      width: mm(defaultPassportBox.wPx),
      height: mm(defaultPassportBox.hPx),
    })
  }

  // Signature: object-fill (stretch to fill signature box)
  if (signatureImage) {
    addFilledImage({
      pdf,
      image: signatureImage,
      x: mm(defaultSignatureBox.xPx),
      y: mm(defaultSignatureBox.yPx),
      width: mm(defaultSignatureBox.wPx),
      height: mm(defaultSignatureBox.hPx),
    })
  }

  const name = safeUpper(joinName(student))
  const dept = safeUpper(student.departmentName || student.departmentId)
  const matric = safeUpper(student.matric)
  const validity = student.graduationYear?.trim() ? safeUpper(student.graduationYear) : ""

  pdf.setTextColor(0, 0, 0)

  drawFittedText({
    pdf,
    text: name,
    x: mm(defaultTextLayout.xBasePx + defaultTextLayout.xNameOffsetPx),
    y: mm(defaultTextLayout.rowNameYPx),
    maxWidth: textMaxWidth.name,
    fontSize: defaultTextLayout.nameFontSize,
  })
  drawFittedText({
    pdf,
    text: dept,
    x: mm(defaultTextLayout.xBasePx + defaultTextLayout.xDeptOffsetPx),
    y: mm(defaultTextLayout.rowDeptYPx),
    maxWidth: textMaxWidth.dept,
    fontSize: defaultTextLayout.deptFontSize,
  })
  drawFittedText({
    pdf,
    text: matric,
    x: mm(defaultTextLayout.xBasePx + defaultTextLayout.xMatOffsetPx),
    y: mm(defaultTextLayout.rowMatYPx),
    maxWidth: textMaxWidth.mat,
    fontSize: defaultTextLayout.matFontSize,
  })
  if (validity) {
    drawFittedText({
      pdf,
      text: validity,
      x: mm(defaultTextLayout.xBasePx + defaultTextLayout.xValOffsetPx),
      y: mm(defaultTextLayout.rowValYPx),
      maxWidth: textMaxWidth.val,
      fontSize: defaultTextLayout.valFontSize,
    })
  }
}

async function drawBackPage({
  pdf,
  templateBackUrl,
}: {
  pdf: jsPDF
  templateBackUrl: string
}) {
  const templateImage = await normalizeImageDataUrl(templateBackUrl)
  if (!templateImage) throw new Error("Back template image missing.")
  pdf.addImage(templateImage.dataUrl, templateImage.format, 0, 0, CARD_PDF_WIDTH_MM, CARD_PDF_HEIGHT_MM, undefined, "FAST")
}

export async function generateIdCardPdf({
  student,
  templateFrontUrl,
  templateBackUrl,
  resolveAssetUrl,
  fileName,
  download = false,
}: GenerateIdCardPdfParams): Promise<string | void> {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [CARD_PDF_WIDTH_MM, CARD_PDF_HEIGHT_MM],
    compress: true,
  })

  await drawFrontPage({ pdf, student, templateFrontUrl, resolveAssetUrl })
  pdf.addPage([CARD_PDF_WIDTH_MM, CARD_PDF_HEIGHT_MM], "landscape")
  await drawBackPage({ pdf, templateBackUrl })

  const outName = fileName?.trim() || `id-card-${student.matric || "student"}.pdf`
  if (download) {
    pdf.save(outName)
    return
  }
  return URL.createObjectURL(pdf.output("blob"))
}

export async function generateBulkIdCardsPdf({
  students,
  templateFrontUrl,
  templateBackUrl,
  resolveAssetUrl,
  fileName,
  download = false,
}: GenerateBulkParams): Promise<string | void> {
  if (students.length === 0) throw new Error("No students to export")

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [CARD_PDF_WIDTH_MM, CARD_PDF_HEIGHT_MM],
    compress: true,
  })

  for (let i = 0; i < students.length; i += 1) {
    const student = students[i]

    if (i > 0) {
      pdf.addPage([CARD_PDF_WIDTH_MM, CARD_PDF_HEIGHT_MM], "landscape")
    }
    await drawFrontPage({ pdf, student, templateFrontUrl, resolveAssetUrl })

    pdf.addPage([CARD_PDF_WIDTH_MM, CARD_PDF_HEIGHT_MM], "landscape")
    await drawBackPage({ pdf, templateBackUrl })
  }

  const outName = fileName?.trim() || "bulk-id-cards.pdf"
  if (download) {
    pdf.save(outName)
    return
  }
  return URL.createObjectURL(pdf.output("blob"))
}







// import { jsPDF } from "jspdf"

// export type IdCardStudent = {
//   matric: string
//   firstName: string
//   lastName: string
//   otherName?: string
//   departmentName?: string
//   departmentId?: string
//   graduationYear?: string
//   passport?: string
//   signature?: string
// }

// const CARD_PDF_WIDTH_MM = 101.9
// const CARD_PDF_HEIGHT_MM = 65.9
// const PX_PER_MM = 10

// const mm = (px: number) => px / PX_PER_MM

// const isDataUrl = (value: string) => value.startsWith("data:image/")
// const dataUrlMime = (value: string) => {
//   const match = value.match(/^data:([^;]+);base64,/i)
//   return match ? match[1].toLowerCase() : ""
// }

// async function urlToDataUrl(url: string): Promise<string> {
//   const res = await fetch(url, { mode: "cors", cache: "no-cache" })
//   if (!res.ok) throw new Error(`Failed to load image: ${url}`)
//   const contentType = res.headers.get("content-type") || ""
//   if (!contentType.toLowerCase().startsWith("image/")) {
//     throw new Error(`Non-image response for ${url} (${contentType || "unknown content-type"})`)
//   }
//   const blob = await res.blob()
//   return await new Promise<string>((resolve, reject) => {
//     const reader = new FileReader()
//     reader.onload = () => resolve(String(reader.result))
//     reader.onerror = () => reject(new Error("Failed to convert image to base64"))
//     reader.readAsDataURL(blob)
//   })
// }

// async function ensureDataUrl(src?: string): Promise<string | null> {
//   if (!src) return null
//   if (isDataUrl(src)) return src
//   return await urlToDataUrl(src)
// }

// type NormalizedImageData = {
//   dataUrl: string
//   format: "PNG" | "JPEG"
//   width: number
//   height: number
// }

// export const PDF_BLOB_URL_REVOKE_DELAY_MS = 60_000

// async function normalizeImageDataUrl(src?: string | null): Promise<NormalizedImageData | null> {
//   if (!src) return null
//   let dataUrl: string
//   try {
//     dataUrl = await ensureDataUrl(src)
//   } catch (error) {
//     console.warn("Failed to load image source", error)
//     return null
//   }
//   if (!dataUrl) return null

//   const image = await new Promise<HTMLImageElement | null>((resolve) => {
//     const img = new Image()
//     img.onload = () => resolve(img)
//     img.onerror = () => resolve(null)
//     img.src = dataUrl
//   })
//   if (!image) return null
//   const canvas = document.createElement("canvas")
//   canvas.width = image.naturalWidth || image.width
//   canvas.height = image.naturalHeight || image.height
//   const ctx = canvas.getContext("2d")
//   if (!ctx) return null
//   ctx.drawImage(image, 0, 0)
//   return {
//     dataUrl: canvas.toDataURL("image/png"),
//     format: "PNG",
//     width: canvas.width,
//     height: canvas.height,
//   }
// }

// function addContainedImage({
//   pdf,
//   image,
//   x,
//   y,
//   width,
//   height,
// }: {
//   pdf: jsPDF
//   image: NormalizedImageData
//   x: number
//   y: number
//   width: number
//   height: number
// }) {
//   const sourceWidth = Number(image.width) || 1
//   const sourceHeight = Number(image.height) || 1
//   const scale = Math.min(width / sourceWidth, height / sourceHeight)
//   const renderWidth = sourceWidth * scale
//   const renderHeight = sourceHeight * scale
//   const offsetX = x + (width - renderWidth) / 2
//   const offsetY = y + (height - renderHeight) / 2

//   pdf.addImage(
//     image.dataUrl,
//     image.format,
//     offsetX,
//     offsetY,
//     renderWidth,
//     renderHeight,
//     undefined,
//     "FAST",
//   )
// }

// async function addCoveredImage({
//   pdf,
//   image,
//   x,
//   y,
//   width,
//   height,
// }: {
//   pdf: jsPDF
//   image: NormalizedImageData
//   x: number
//   y: number
//   width: number
//   height: number
// }) {
//   const sourceWidth = Number(image.width) || 1
//   const sourceHeight = Number(image.height) || 1
//   const targetAspect = width / height
//   const sourceAspect = sourceWidth / sourceHeight

//   let sourceX = 0
//   let sourceY = 0
//   let sourceCropWidth = sourceWidth
//   let sourceCropHeight = sourceHeight

//   if (sourceAspect > targetAspect) {
//     sourceCropWidth = sourceHeight * targetAspect
//     sourceX = (sourceWidth - sourceCropWidth) / 2
//   } else {
//     sourceCropHeight = sourceWidth / targetAspect
//     sourceY = (sourceHeight - sourceCropHeight) / 2
//   }

//   const imageElement = await new Promise<HTMLImageElement | null>((resolve) => {
//     const img = new Image()
//     img.onload = () => resolve(img)
//     img.onerror = () => resolve(null)
//     img.src = image.dataUrl
//   })

//   if (!imageElement) {
//     addContainedImage({ pdf, image, x, y, width, height })
//     return
//   }

//   const cropCanvas = document.createElement("canvas")
//   cropCanvas.width = Math.max(1, Math.round(sourceCropWidth))
//   cropCanvas.height = Math.max(1, Math.round(sourceCropHeight))
//   const cropContext = cropCanvas.getContext("2d")
//   if (!cropContext) {
//     addContainedImage({ pdf, image, x, y, width, height })
//     return
//   }

//   cropContext.drawImage(
//     imageElement,
//     sourceX,
//     sourceY,
//     sourceCropWidth,
//     sourceCropHeight,
//     0,
//     0,
//     cropCanvas.width,
//     cropCanvas.height,
//   )

//   pdf.addImage(
//     cropCanvas.toDataURL("image/png"),
//     "PNG",
//     x,
//     y,
//     width,
//     height,
//     undefined,
//     "FAST",
//   )
// }

// function safeUpper(value?: string) {
//   return (value ?? "").toString().trim().toUpperCase()
// }

// function joinName(s: IdCardStudent) {
//   return [s.firstName, s.otherName, s.lastName].filter(Boolean).join(" ").trim()
// }

// type GenerateIdCardPdfParams = {
//   student: IdCardStudent
//   templateFrontUrl: string
//   templateBackUrl: string
//   resolveAssetUrl?: (pathOrUrl: string) => string
//   fileName?: string
//   download?: boolean
// }

// type GenerateBulkParams = {
//   students: IdCardStudent[]
//   templateFrontUrl: string
//   templateBackUrl: string
//   resolveAssetUrl?: (pathOrUrl: string) => string
//   fileName?: string
//   download?: boolean
// }

// const defaultPassportBox = {
//   xPx: 689,
//   yPx: 105,
//   wPx: 255,
//   hPx: 282,
// }

// const defaultSignatureBox = {
//   xPx: 710,
//   yPx: 595,
//   wPx: 280,
//   hPx: 45,
// }

// const defaultTextLayout = {
//   xBasePx: 580 + 70,
//   xNameOffsetPx: -70,
//   xDeptOffsetPx: -74,
//   xMatOffsetPx: -35,
//   xValOffsetPx: 0,
//   rowNameYPx: 430 + 6,
//   rowDeptYPx: 470 + 10,
//   rowMatYPx: 520 + 5,
//   rowValYPx: 560 + 6,
//   nameFontSize: 10,
//   deptFontSize: 10,
//   matFontSize: 10,
//   valFontSize: 10,
//   nameWidthPx: 426,
//   deptWidthPx: 436,
//   matWidthPx: 397,
//   valWidthPx: 361,
// }

// const textMaxWidth = {
//   name: mm(defaultTextLayout.nameWidthPx),
//   dept: mm(defaultTextLayout.deptWidthPx),
//   mat: mm(defaultTextLayout.matWidthPx),
//   val: mm(defaultTextLayout.valWidthPx),
// }

// const BEBAS_FONT_NAME = "BebasNeue"
// const BEBAS_FONT_STYLE = "normal"
// const DEFAULT_BEBAS_FONT_URL = "/fonts/BebasNeue-Regular.ttf"
// let cachedBebasFontBase64: string | null = null

// async function loadBebasFont(pdf: jsPDF, fontUrl = DEFAULT_BEBAS_FONT_URL) {
//   if (!cachedBebasFontBase64) {
//     const res = await fetch(fontUrl, { mode: "cors", cache: "no-cache" })
//     if (!res.ok) {
//       console.error("Bebas font fetch failed", res.status, fontUrl)
//       throw new Error(`Failed to load Bebas Neue font from ${fontUrl}`)
//     }
//     const buffer = await res.arrayBuffer()
//     if (!buffer || buffer.byteLength === 0) {
//       console.error("Bebas font empty response", fontUrl)
//       throw new Error(`Empty Bebas Neue font response from ${fontUrl}`)
//     }
//     const bytes = new Uint8Array(buffer)
//     let binary = ""
//     for (let i = 0; i < bytes.length; i += 1) {
//       binary += String.fromCharCode(bytes[i])
//     }
//     cachedBebasFontBase64 = btoa(binary)
//   }
//   pdf.addFileToVFS("BebasNeue-Regular.ttf", cachedBebasFontBase64)
//   pdf.addFont("BebasNeue-Regular.ttf", BEBAS_FONT_NAME, BEBAS_FONT_STYLE)
// }

// function drawFittedText({
//   pdf,
//   text,
//   x,
//   y,
//   maxWidth,
//   fontSize,
//   bold = false,
// }: {
//   pdf: jsPDF
//   text: string
//   x: number
//   y: number
//   maxWidth: number
//   fontSize: number
//   bold?: boolean
// }) {
//   const value = text?.trim() || "--"
//   pdf.setFont(BEBAS_FONT_NAME, BEBAS_FONT_STYLE)
//   let size = fontSize
//   pdf.setFontSize(size)
//   if (maxWidth > 0) {
//     let width = pdf.getTextWidth(value)
//     while (width > maxWidth && size > 6) {
//       size -= 0.5
//       pdf.setFontSize(size)
//       width = pdf.getTextWidth(value)
//     }
//   }
//   pdf.text(value, x, y, { baseline: "middle" })
// }

// async function drawFrontPage({
//   pdf,
//   student,
//   templateFrontUrl,
//   resolveAssetUrl,
// }: {
//   pdf: jsPDF
//   student: IdCardStudent
//   templateFrontUrl: string
//   resolveAssetUrl?: (pathOrUrl: string) => string
// }) {
//   await loadBebasFont(pdf)
//   const templateImage = await normalizeImageDataUrl(templateFrontUrl)
//   if (!templateImage) throw new Error("Template image missing.")
//   pdf.addImage(templateImage.dataUrl, templateImage.format, 0, 0, CARD_PDF_WIDTH_MM, CARD_PDF_HEIGHT_MM, undefined, "FAST")

//   const passportSrc = student.passport ? (resolveAssetUrl ? resolveAssetUrl(student.passport) : student.passport) : ""
//   const signatureSrc = student.signature ? (resolveAssetUrl ? resolveAssetUrl(student.signature) : student.signature) : ""

//   const passportImage = await normalizeImageDataUrl(passportSrc || undefined)
//   const signatureImage = await normalizeImageDataUrl(signatureSrc || undefined)

//   if (passportImage) {
//     await addCoveredImage({
//       pdf,
//       image: passportImage,
//       x: mm(defaultPassportBox.xPx),
//       y: mm(defaultPassportBox.yPx),
//       width: mm(defaultPassportBox.wPx),
//       height: mm(defaultPassportBox.hPx),
//     })
//   }

//   if (signatureImage) {
//     addContainedImage({
//       pdf,
//       image: signatureImage,
//       x: mm(defaultSignatureBox.xPx),
//       y: mm(defaultSignatureBox.yPx),
//       width: mm(defaultSignatureBox.wPx),
//       height: mm(defaultSignatureBox.hPx),
//     })
//   }

//   const name = safeUpper(joinName(student))
//   const dept = safeUpper(student.departmentName || student.departmentId)
//   const matric = safeUpper(student.matric)
//   const validity = student.graduationYear?.trim() ? safeUpper(student.graduationYear) : ""

//   pdf.setTextColor(0, 0, 0)
//   drawFittedText({
//     pdf,
//     text: name,
//     x: mm(defaultTextLayout.xBasePx + defaultTextLayout.xNameOffsetPx),
//     y: mm(defaultTextLayout.rowNameYPx),
//     maxWidth: textMaxWidth.name,
//     fontSize: defaultTextLayout.nameFontSize,
//     bold: false,
//   })
//   drawFittedText({
//     pdf,
//     text: dept,
//     x: mm(defaultTextLayout.xBasePx + defaultTextLayout.xDeptOffsetPx),
//     y: mm(defaultTextLayout.rowDeptYPx),
//     maxWidth: textMaxWidth.dept,
//     fontSize: defaultTextLayout.deptFontSize,
//     bold: false,
//   })
//   drawFittedText({
//     pdf,
//     text: matric,
//     x: mm(defaultTextLayout.xBasePx + defaultTextLayout.xMatOffsetPx),
//     y: mm(defaultTextLayout.rowMatYPx),
//     maxWidth: textMaxWidth.mat,
//     fontSize: defaultTextLayout.matFontSize,
//     bold: false,
//   })
//   if (validity) {
//     drawFittedText({
//       pdf,
//       text: validity,
//       x: mm(defaultTextLayout.xBasePx + defaultTextLayout.xValOffsetPx),
//       y: mm(defaultTextLayout.rowValYPx),
//       maxWidth: textMaxWidth.val,
//       fontSize: defaultTextLayout.valFontSize,
//       bold: false,
//     })
//   }
// }

// async function drawBackPage({
//   pdf,
//   templateBackUrl,
// }: {
//   pdf: jsPDF
//   templateBackUrl: string
// }) {
//   const templateImage = await normalizeImageDataUrl(templateBackUrl)
//   if (!templateImage) throw new Error("Back template image missing.")
//   pdf.addImage(templateImage.dataUrl, templateImage.format, 0, 0, CARD_PDF_WIDTH_MM, CARD_PDF_HEIGHT_MM, undefined, "FAST")
// }

// export async function generateIdCardPdf({
//   student,
//   templateFrontUrl,
//   templateBackUrl,
//   resolveAssetUrl,
//   fileName,
//   download = false,
// }: GenerateIdCardPdfParams): Promise<string | void> {
//   const pdf = new jsPDF({
//     orientation: "landscape",
//     unit: "mm",
//     format: [CARD_PDF_WIDTH_MM, CARD_PDF_HEIGHT_MM],
//     compress: true,
//   })

//   await drawFrontPage({ pdf, student, templateFrontUrl, resolveAssetUrl })
//   pdf.addPage([CARD_PDF_WIDTH_MM, CARD_PDF_HEIGHT_MM], "landscape")
//   await drawBackPage({ pdf, templateBackUrl })

//   const outName = fileName?.trim() || `id-card-${student.matric || "student"}.pdf`
//   if (download) {
//     pdf.save(outName)
//     return
//   }
//   return URL.createObjectURL(pdf.output("blob"))
// }

// export async function generateBulkIdCardsPdf({
//   students,
//   templateFrontUrl,
//   templateBackUrl,
//   resolveAssetUrl,
//   fileName,
//   download = false,
// }: GenerateBulkParams): Promise<string | void> {
//   if (students.length === 0) throw new Error("No students to export")

//   const pdf = new jsPDF({
//     orientation: "landscape",
//     unit: "mm",
//     format: [CARD_PDF_WIDTH_MM, CARD_PDF_HEIGHT_MM],
//     compress: true,
//   })

//   for (let i = 0; i < students.length; i += 1) {
//     const student = students[i]
//     if (i > 0) {
//       pdf.addPage([CARD_PDF_WIDTH_MM, CARD_PDF_HEIGHT_MM], "landscape")
//     }
//     await drawFrontPage({ pdf, student, templateFrontUrl, resolveAssetUrl })

//     pdf.addPage([CARD_PDF_WIDTH_MM, CARD_PDF_HEIGHT_MM], "landscape")
//     await drawBackPage({ pdf, templateBackUrl })
//   }

//   const outName = fileName?.trim() || "bulk-id-cards.pdf"
//   if (download) {
//     pdf.save(outName)
//     return
//   }
//   return URL.createObjectURL(pdf.output("blob"))
// }
