import * as XLSX from "xlsx"

import type { UploadedStudent } from "@/admin/types"

const normalize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "")

const normalizeDepartmentName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*&\s*/g, " and ")

const deriveGraduationYearByDepartment = (departmentName: string) => {
  const currentYear = new Date().getFullYear()
  const department = normalizeDepartmentName(departmentName)

  if (department === "veterinary") {
    return String(currentYear + 6)
  }

  if (department === "food science and technology") {
    return String(currentYear + 5)
  }

  if (department.includes("engineering")) {
    return String(currentYear + 5)
  }

  return String(currentYear + 4)
}

const splitFullName = (rawName: string) => {
  const parts = rawName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 3) {
    return {
      firstName: parts[0] ?? "",
      otherName: parts.slice(1, -1).join(" "),
      lastName: parts[parts.length - 1] ?? "",
    }
  }
  if (parts.length === 2) {
    return {
      firstName: parts[0],
      otherName: "",
      lastName: parts[1],
    }
  }
  return {
    firstName: parts[0] ?? "",
    otherName: "",
    lastName: "",
  }
}

const pickFromHeaders = (row: unknown[], headerMap: string[], ...keys: string[]) => {
  for (const key of keys) {
    const keyNorm = normalize(key)
    const colIndex = headerMap.findIndex((header) => header === keyNorm || header.includes(keyNorm))
    if (colIndex >= 0) {
      const value = row[colIndex]
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim()
      }
    }
  }
  return ""
}

const mapCsv = (text: string): UploadedStudent[] => {
  const rows = text.split(/\r?\n/).filter(Boolean)
  const header = rows.shift()?.split(",").map((value) => value.trim()) ?? []
  const headerMap = header.map((item) => normalize(item))

  return rows.map((row) => {
    const cells = row.split(",").map((cell) => cell.trim())
    const fullName = pickFromHeaders(cells, headerMap, "NAME", "FULL NAME", "STUDENT NAME")
    const splitName = splitFullName(fullName)
    return {
      matric: pickFromHeaders(cells, headerMap, "MATRICULATION NUMBER", "MATRIC", "MATRIC NO"),
      jambRegNumber: pickFromHeaders(
        cells,
        headerMap,
        "JAMB REG NUMBER",
        "JAMB REG. NUMBER",
        "JAMB REG NO",
        "JAMB NUMBER",
        "JAMB NO"
      ),
      firstName: pickFromHeaders(cells, headerMap, "FIRST NAME") || splitName.firstName,
      lastName: pickFromHeaders(cells, headerMap, "LAST NAME", "SURNAME") || splitName.lastName,
      otherName: pickFromHeaders(cells, headerMap, "MIDDLE NAME", "OTHER NAME") || splitName.otherName,
      email: pickFromHeaders(cells, headerMap, "EMAIL"),
      phone: pickFromHeaders(cells, headerMap, "PHONE", "PHONE NUMBER"),
      departmentId: pickFromHeaders(cells, headerMap, "COURSE OF STUDY", "DEPARTMENT", "DEPT", "COURSE"),
      graduationYear: pickFromHeaders(cells, headerMap, "GRADUATION YEAR"),
      passport: "",
      signature: "",
    }
  })
}

const findHeaderRowIndex = (rows: unknown[][]) => {
  for (let i = 0; i < Math.min(rows.length, 60); i += 1) {
    const normalizedRow = (rows[i] ?? []).map((cell) => normalize(String(cell ?? "")))
    const hasMatric = normalizedRow.some(
      (cell) => cell.includes("MATRICULATIONNUMBER") || cell === "MATRIC" || cell.includes("MATRICNO")
    )
    const hasName = normalizedRow.some(
      (cell) => cell === "NAME" || cell.includes("FULLNAME") || cell.includes("STUDENTNAME")
    )
    const hasCourse = normalizedRow.some(
      (cell) => cell.includes("COURSEOFSTUDY") || cell.includes("DEPARTMENT") || cell === "DEPT"
    )
    if (hasMatric && (hasName || hasCourse)) return i
  }
  return -1
}

const mapExcel = (buffer: ArrayBuffer): UploadedStudent[] => {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
  if (workbook.SheetNames.length === 0) {
    throw new Error("No sheets found in Excel file.")
  }

  const aggregated: UploadedStudent[] = []
  let foundAnySheet = false

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    const sheetRows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: "",
      dateNF: "yyyy-mm-dd",
    }) as unknown[][]

    const headerIndex = findHeaderRowIndex(sheetRows)
    if (headerIndex < 0) continue

    foundAnySheet = true
    const rawHeaders = (sheetRows[headerIndex] ?? []).map((item) => String(item ?? "").trim())
    const headers = rawHeaders.map((item, index) => (item ? item : `COLUMN_${index + 1}`))
    const headerMap = headers.map((item) => normalize(item))
    const dataRows = sheetRows
      .slice(headerIndex + 1)
      .filter((row) => (row ?? []).some((cell) => String(cell ?? "").trim() !== ""))

    const sheetMapped = dataRows.map((row) => {
      const parsedName = splitFullName(pickFromHeaders(row, headerMap, "NAME", "FULL NAME", "STUDENT NAME"))
      const departmentId = pickFromHeaders(row, headerMap, "COURSE OF STUDY", "DEPARTMENT", "DEPT", "COURSE")
      return {
        matric: pickFromHeaders(row, headerMap, "MATRICULATION NUMBER", "MATRIC", "MATRIC NO"),
        jambRegNumber: pickFromHeaders(
          row,
          headerMap,
          "JAMB REG NUMBER",
          "JAMB REG. NUMBER",
          "JAMB REG NO",
          "JAMB NUMBER",
          "JAMB NO"
        ),
        firstName: pickFromHeaders(row, headerMap, "FIRST NAME") || parsedName.firstName,
        otherName: pickFromHeaders(row, headerMap, "MIDDLE NAME", "OTHER NAME") || parsedName.otherName,
        lastName: pickFromHeaders(row, headerMap, "LAST NAME", "SURNAME") || parsedName.lastName,
        email: pickFromHeaders(row, headerMap, "EMAIL"),
        phone: pickFromHeaders(row, headerMap, "PHONE", "PHONE NUMBER"),
        departmentId,
        graduationYear: deriveGraduationYearByDepartment(departmentId),
        passport: "",
        signature: "",
      }
    })

    aggregated.push(...sheetMapped)
  }

  if (!foundAnySheet) {
    throw new Error("Could not find a valid header row in Excel file.")
  }

  return aggregated
}

export async function parseUploadFile(file: File): Promise<UploadedStudent[]> {
  const lowerName = file.name.toLowerCase()
  const isCsv = lowerName.endsWith(".csv")
  const isExcel = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")

  if (!isCsv && !isExcel) {
    throw new Error("Upload a CSV or Excel file (.xlsx, .xls).")
  }

  if (isCsv) {
    return mapCsv(await file.text())
  }

  return mapExcel(await file.arrayBuffer())
}
