import axios, { isAxiosError } from "axios";
import type { AxiosInstance } from "axios";
import {
  dataUrlToFile,
  IMAGE_UPLOAD_MAX_BYTES,
  isImageDataUrl,
  toCompressedImageFile,
} from "@/utils/imageCompression"


// Configure base axios instance
// Use local defaults so the app runs without a `.env` file.
// You can still override these with `VITE_*` environment variables.
const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "")
const sanitizeConfiguredUrl = (value: string) =>
  value
    .trim()
    // Guard against malformed values like "http://https://example.com".
    .replace(/^(https?:\/\/)+(https?:\/\/)/i, "$2")

const DEFAULT_API_URL = "/api"
const DEFAULT_ASSET_URL = ""
const DEFAULT_ASSET_STORAGE_PATH = "storage/uploads"

const configuredApiUrl =
  sanitizeConfiguredUrl(import.meta.env.VITE_API_URL?.trim() || "") ||
  DEFAULT_API_URL
const apiBaseUrl = normalizeBaseUrl(configuredApiUrl)
const configuredAssetUrl = sanitizeConfiguredUrl(import.meta.env.VITE_ASSET_URL?.trim() || "") || DEFAULT_ASSET_URL
const configuredAssetStoragePath =
  import.meta.env.VITE_ASSET_STORAGE_PATH?.trim().replace(/^\/+|\/+$/g, "") || DEFAULT_ASSET_STORAGE_PATH

// If you need a different API host per environment, set VITE_API_URL.

const api: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

const normalizeStoragePath = (value: string) => {
  let normalized = value
  normalized = normalized.replace(/(\/storage\/uploads\/)+/gi, "/storage/uploads/")
  normalized = normalized.replace(/(\/app\/public\/)+/gi, "/app/public/")
  normalized = normalized.replace(/(\/storage\/app\/public\/)+/gi, "/storage/app/public/")
  normalized = normalized.replace(/\/backend\/storage\/app\/public\/app\/public\//gi, "/backend/storage/app/public/")
  return normalized
}

export const resolveApiAssetUrl = (value?: string | null): string => {
  const rawInput = String(value ?? "").trim()
  if (!rawInput) return ""
  let raw = normalizeStoragePath(rawInput)
  if (/^(data|blob):/i.test(raw)) return raw

  const resolvedAssetBaseUrl = configuredAssetUrl?.startsWith("/")
    ? `${typeof window !== "undefined" && window.location?.origin ? window.location.origin : "http://localhost"}${configuredAssetUrl}`
    : configuredAssetUrl
  const assetBaseUrl = resolvedAssetBaseUrl
    ? normalizeBaseUrl(resolvedAssetBaseUrl)
    : normalizeBaseUrl(apiBaseUrl).replace(/\/api(?:\/v\d+)?$/i, "")
  const buildFromPath = (path: string) => {
    let cleanPath = normalizeStoragePath(path.replace(/^\/+/, ""))
    const lowerPath = cleanPath.toLowerCase()
    const storagePrefixedPath =
      lowerPath.startsWith("uploads/")
        ? `${configuredAssetStoragePath}/${cleanPath.replace(/^uploads\//i, "")}`
        : cleanPath
    if (!assetBaseUrl) return cleanPath
    try {
      const baseUrl = new URL(`${assetBaseUrl}/`)
      const basePath = baseUrl.pathname.replace(/^\/+|\/+$/g, "")
      const baseEndsWithBackend = /(?:^|\/)backend$/i.test(basePath)
      const normalizedJoinPath =
        baseEndsWithBackend && /^backend\//i.test(storagePrefixedPath)
          ? storagePrefixedPath.replace(/^backend\//i, "")
          : storagePrefixedPath
      const withBasePath =
        basePath && !normalizedJoinPath.toLowerCase().startsWith(`${basePath.toLowerCase()}/`)
          ? `${basePath}/${normalizedJoinPath}`
          : normalizedJoinPath
      return new URL(withBasePath, `${baseUrl.origin}/`).toString()
    } catch {
      return storagePrefixedPath
    }
  }

  if (/^(https?:)?\/\//i.test(raw)) {
    try {
      const fallbackOrigin =
        typeof window !== "undefined" && window.location?.origin
          ? window.location.origin
          : "http://localhost"
      const absoluteUrl = new URL(raw, fallbackOrigin)
      const fixedPath = normalizeStoragePath(absoluteUrl.pathname)
      if (/\/storage\/app\/public\//i.test(fixedPath) || /\/backend\/storage\//i.test(fixedPath)) {
        return buildFromPath(fixedPath)
      }
      const isLocalHost = /^(localhost|127(?:\.\d{1,3}){3}|::1)$/i.test(absoluteUrl.hostname)
      if (isLocalHost) {
        return buildFromPath(absoluteUrl.pathname)
      }
      return absoluteUrl.toString()
    } catch {
      return raw
    }
  }

  return buildFromPath(raw)
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const toOptionalNullableString = (value: unknown): string | null | undefined => {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === "string") return value
  return undefined
}

const toOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["1", "true", "yes"].includes(normalized)) return true
    if (["0", "false", "no"].includes(normalized)) return false
  }
  return undefined
}

const toOptionalGraduationYear = (value: unknown): string | number | null | undefined => {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") return value.trim()
  return undefined
}

const toStudent = (value: unknown): Student | null => {
  const record = asRecord(value)
  if (!record) return null

  const idValue = record.id
  const idAsNumber =
    typeof idValue === "number"
      ? idValue
      : typeof idValue === "string"
        ? Number(idValue)
        : Number.NaN
  if (!Number.isFinite(idAsNumber)) return null

  return {
    id: idAsNumber,
    matric_no:
      toOptionalNullableString(record.matric_no) ??
      toOptionalNullableString(record.matric) ??
      undefined,
    first_name: toOptionalNullableString(record.first_name),
    other_name: toOptionalNullableString(record.other_name),
    last_name: toOptionalNullableString(record.last_name),
    jamb_no: toOptionalNullableString(record.jamb_no),
    email: toOptionalNullableString(record.email),
    department: toOptionalNullableString(record.department),
    graduation_year: toOptionalGraduationYear(record.graduation_year),
    is_submitted: toOptionalBoolean(record.is_submitted),
    is_printed: toOptionalBoolean(record.is_printed),
    passport_url: toOptionalNullableString(record.passport_url),
    signature_url: toOptionalNullableString(record.signature_url),
  }
}

const pickStudentListFromPayload = (payload: unknown): Student[] => {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => toStudent(entry))
      .filter((entry): entry is Student => entry !== null)
  }
  const record = asRecord(payload)
  if (!record) return []
  if (Array.isArray(record.data)) {
    return record.data
      .map((entry) => toStudent(entry))
      .filter((entry): entry is Student => entry !== null)
  }
  if (Array.isArray(record.students)) {
    return record.students
      .map((entry) => toStudent(entry))
      .filter((entry): entry is Student => entry !== null)
  }
  return []
}

const pickStudentFromPayload = (payload: unknown): Student | null => {
  if (!payload) return null
  const root = asRecord(payload)
  const candidate =
    asRecord(root?.data) ??
    asRecord(root?.student) ??
    asRecord(root?.result) ??
    asRecord(payload)
  if (!candidate) return null
  return toStudent(candidate)
}

const normalizeMatric = (matric_no: string) => String(matric_no ?? "").trim()
const encodeMatric = (matric_no: string) =>
  encodeURIComponent(normalizeMatric(matric_no)).replace(/%2F/gi, "/")

const appendImageFileField = (
  formData: FormData,
  field: string,
  value: unknown
) => {
  if (value == null) return
  if (value instanceof File) {
    formData.append(field, value)
    return
  }
  if (value instanceof Blob) {
    formData.append(field, new File([value], `${field}.png`, { type: value.type || "image/png" }))
    return
  }
  if (typeof value !== "string") return
  const trimmed = value.trim()
  if (!trimmed) return
  if (!isImageDataUrl(trimmed)) return
  const file = dataUrlToFile(trimmed, field)
  if (file) formData.append(field, file)
}

const appendStudentFileField = async (
  formData: FormData,
  field: "passport" | "signature",
  value: unknown
) => {
  const compressedFile = await toCompressedImageFile(value, {
    maxBytes: IMAGE_UPLOAD_MAX_BYTES,
    fileName: field,
    preferredType: field === "passport" ? "image/jpeg" : "image/png",
    allowJpegFallback: field === "passport",
    maxWidthOrHeight: field === "passport" ? 900 : 1200,
  })
  if (!compressedFile) return
  formData.append(field, compressedFile)
}

const buildStudentFormData = async (payload: object) => {
  const formData = new FormData()
  const payloadRecord = asRecord(payload) ?? {}

  for (const [key, value] of Object.entries(payloadRecord)) {
    if (
      key === "passport" ||
      key === "signature" ||
      key === "passport_url" ||
      key === "signature_url"
    ) {
      continue
    }
    if (value === undefined) continue
    if (value === null) {
      formData.append(key, "")
      continue
    }
    if (typeof value === "boolean") {
      formData.append(key, value ? "1" : "0")
      continue
    }
    formData.append(key, String(value))
  }

  await appendStudentFileField(
    formData,
    "passport",
    payloadRecord.passport ?? payloadRecord.passport_url
  )
  await appendStudentFileField(
    formData,
    "signature",
    payloadRecord.signature ?? payloadRecord.signature_url
  )

  return formData
}

const buildUserFormData = async (payload: object) => {
  const formData = new FormData()
  const payloadRecord = asRecord(payload) ?? {}

  for (const [key, value] of Object.entries(payloadRecord)) {
    if (key === "profile_photo") continue
    if (value === undefined) continue
    if (value === null) {
      formData.append(key, "")
      continue
    }
    if (typeof value === "boolean") {
      formData.append(key, value ? "1" : "0")
      continue
    }
    formData.append(key, String(value))
  }

  appendImageFileField(formData, "profile_photo", payloadRecord.profile_photo)
  return formData
}

// debug helper for development
if (import.meta.env.DEV) {
  api.interceptors.request.use((cfg) => {
    console.debug("API Request:", cfg.method, cfg.baseURL + (cfg.url ?? ""), cfg.params ?? cfg.data ?? "")
    // expose resolved base URL to help diagnose host/port mismatches
    console.debug("Resolved API base URL:", apiBaseUrl)
    return cfg
  })
}

export interface Student {
  id: number;
  matric_no?: string;
  first_name?: string | null;
  other_name?: string | null;
  last_name?: string | null;
  jamb_no?: string | null;
  email?: string | null;
  department?: string | null;
  graduation_year?: string | number | null;
  is_submitted?: boolean;
  is_printed?: boolean;
  passport_url?: string | null;
  signature_url?: string | null;
}

export interface AuthUser {
  id: number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  is_active?: boolean;
  profile_photo_url?: string | null;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface ApiUser {
  id: number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  is_active?: boolean;
  profile_photo_url?: string | null;
  last_login?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role?: string;
  is_active?: boolean;
  profile_photo?: string | File | Blob | null;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  is_active?: boolean;
  profile_photo?: string | File | Blob | null;
}

export interface ForgotPasswordResponse {
  message: string;
  dev_reset_token?: string;
}

export interface ResetPasswordPayload {
  email: string;
  token: string;
  password: string;
  password_confirmation: string;
}

export interface CreateStudentPayload {
  matric_no: string;
  first_name?: string | null;
  other_name?: string | null;
  last_name?: string | null;
  jamb_no?: string | null;
  email?: string | null;
  department?: string | null;
  graduation_year?: string | number | null;
  is_printed?: boolean;
  passport_url?: string | null;
  signature_url?: string | null;
}

const toAuthUser = (value: unknown): AuthUser | null => {
  const record = asRecord(value)
  if (!record) return null

  const idValue = record.id
  const idAsNumber =
    typeof idValue === "number"
      ? idValue
      : typeof idValue === "string"
        ? Number(idValue)
        : Number.NaN
  if (!Number.isFinite(idAsNumber)) return null

  return {
    id: idAsNumber,
    name: toOptionalNullableString(record.name),
    email: toOptionalNullableString(record.email),
    role: toOptionalNullableString(record.role),
    is_active: toOptionalBoolean(record.is_active),
    profile_photo_url:
      toOptionalNullableString(record.profile_photo_url) ??
      toOptionalNullableString(record.passport_url),
  }
}

const toApiUser = (value: unknown): ApiUser | null => {
  const record = asRecord(value)
  if (!record) return null

  const idValue = record.id
  const idAsNumber =
    typeof idValue === "number"
      ? idValue
      : typeof idValue === "string"
        ? Number(idValue)
        : Number.NaN
  if (!Number.isFinite(idAsNumber)) return null

  return {
    id: idAsNumber,
    name: toOptionalNullableString(record.name),
    email: toOptionalNullableString(record.email),
    role: toOptionalNullableString(record.role),
    is_active: toOptionalBoolean(record.is_active),
    profile_photo_url: toOptionalNullableString(record.profile_photo_url),
    last_login: toOptionalNullableString(record.last_login),
    created_at: toOptionalNullableString(record.created_at),
    updated_at: toOptionalNullableString(record.updated_at),
  }
}

const pickUserListFromPayload = (payload: unknown): ApiUser[] => {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => toApiUser(entry))
      .filter((entry): entry is ApiUser => entry !== null)
  }
  const record = asRecord(payload)
  if (!record) return []
  if (Array.isArray(record.data)) {
    return record.data
      .map((entry) => toApiUser(entry))
      .filter((entry): entry is ApiUser => entry !== null)
  }
  if (Array.isArray(record.users)) {
    return record.users
      .map((entry) => toApiUser(entry))
      .filter((entry): entry is ApiUser => entry !== null)
  }
  return []
}

const pickUserFromPayload = (payload: unknown): ApiUser | null => {
  if (!payload) return null
  const root = asRecord(payload)
  const candidate =
    asRecord(root?.data) ??
    asRecord(root?.user) ??
    asRecord(root?.result) ??
    asRecord(payload)
  if (!candidate) return null
  return toApiUser(candidate)
}

const withAuthConfig = (token: string) => ({
  headers: {
    Authorization: `Bearer ${token.trim()}`,
  },
})

export const loginUser = async (email: string, password: string): Promise<LoginResponse> => {
  const res = await api.post("/v1/auth/login", { email, password })
  const payload = asRecord(res.data)
  const token = typeof payload?.token === "string" ? payload.token.trim() : ""
  const user = toAuthUser(payload?.user)

  if (!token || !user) {
    throw new Error("Login succeeded but response did not include a valid token and user.")
  }

  return { token, user }
}

export const logoutUser = async (token: string): Promise<void> => {
  const authToken = token.trim()
  if (!authToken) return
  await api.post(
    "/v1/auth/logout",
    {},
    withAuthConfig(authToken)
  )
}

export const requestPasswordReset = async (email: string): Promise<ForgotPasswordResponse> => {
  const normalizedEmail = email.trim()
  const res = await api.post("/v1/auth/forgot-password", {
    email: normalizedEmail,
  })
  const payload = asRecord(res.data)
  return {
    message:
      (typeof payload?.message === "string" && payload.message.trim()) ||
      "If the account exists, reset instructions have been sent.",
    dev_reset_token:
      typeof payload?.dev_reset_token === "string" && payload.dev_reset_token.trim()
        ? payload.dev_reset_token.trim()
        : undefined,
  }
}

export const resetPassword = async (payload: ResetPasswordPayload): Promise<{ message: string }> => {
  const res = await api.post("/v1/auth/reset-password", payload)
  const body = asRecord(res.data)
  return {
    message:
      (typeof body?.message === "string" && body.message.trim()) || "Password reset successful.",
  }
}

export const listUsers = async (token: string): Promise<ApiUser[]> => {
  const res = await api.get("/v1/users", withAuthConfig(token))
  return pickUserListFromPayload(res.data as unknown)
}

export const createUser = async (token: string, payload: CreateUserPayload): Promise<ApiUser> => {
  const body = await buildUserFormData(payload)
  const res = await api.post("/v1/users", body, {
    ...withAuthConfig(token),
    headers: {
      ...withAuthConfig(token).headers,
      "Content-Type": "multipart/form-data",
    },
  })
  const fromBody = pickUserFromPayload(res.data)
  if (fromBody) return fromBody
  throw new Error("User created but API response did not include retrievable user data.")
}

export const updateUser = async (
  token: string,
  userId: number,
  payload: UpdateUserPayload
): Promise<ApiUser> => {
  const authConfig = withAuthConfig(token)
  const buildMultipartConfig = () => ({
    ...authConfig,
    headers: {
      ...authConfig.headers,
      "Content-Type": "multipart/form-data",
    },
  })

  try {
    const body = await buildUserFormData(payload)
    body.append("_method", "PUT")
    const res = await api.post(`/v1/users/${userId}`, body, buildMultipartConfig())
    const fromBody = pickUserFromPayload(res.data)
    if (fromBody) return fromBody
  } catch (error) {
    if (!isAxiosError(error)) throw error
    const status = error.response?.status
    const shouldRetryAsNativePut = status === 404 || status === 405
    if (!shouldRetryAsNativePut) throw error

    const body = await buildUserFormData(payload)
    const res = await api.put(`/v1/users/${userId}`, body, buildMultipartConfig())
    const fromBody = pickUserFromPayload(res.data)
    if (fromBody) return fromBody
  }

  throw new Error("User updated but API response did not include retrievable user data.")
}

export const listStudentDepartments = async (): Promise<string[]> => {
  const res = await api.get("/v1/students/departments")
  const payload = res.data as unknown
  const record = asRecord(payload)
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(record?.data)
      ? record.data
      : Array.isArray(record?.departments)
        ? record.departments
        : []
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      if (typeof entry === "string") return entry.trim()
      const objectEntry = asRecord(entry)
      if (!objectEntry) return ""
      const candidate = objectEntry.department ?? objectEntry.name ?? objectEntry.value
      return typeof candidate === "string" ? candidate.trim() : ""
    })
    .filter(Boolean)
}

export const getStudentMatricCount = async (): Promise<number> => {
  const res = await api.get("/v1/students/matric-count")
  const payload = res.data as unknown
  const record = asRecord(payload)
  const nested = asRecord(record?.data)
  const candidate =
    record?.count ??
    record?.matric_no_count ??
    record?.matric_count ??
    nested?.count ??
    nested?.matric_no_count ??
    nested?.matric_count ??
    record?.data ??
    payload
  const numeric = Number(candidate)
  return Number.isFinite(numeric) ? numeric : 0
}

const pickNumericCount = (payload: unknown, keys: string[]): number => {
  const record = asRecord(payload)
  const nested = asRecord(record?.data)
  const candidates = [
    ...keys.map((key) => record?.[key]),
    ...keys.map((key) => nested?.[key]),
    record?.data,
    payload,
  ]
  for (const candidate of candidates) {
    const numeric = Number(candidate)
    if (Number.isFinite(numeric)) return numeric
  }
  return 0
}

export const getSubmittedStudentCount = async (): Promise<number> => {
  const res = await api.get("/v1/students/submitted-count")
  return pickNumericCount(res.data as unknown, [
    "count",
    "submitted_count",
    "is_submitted_count",
  ])
}

export const getPrintedStudentCount = async (): Promise<number> => {
  const res = await api.get("/v1/students/printed-count")
  return pickNumericCount(res.data as unknown, [
    "count",
    "printed_count",
    "is_printed_count",
  ])
}

export const listStudents = async (): Promise<Student[]> => {
  const res = await api.get('/v1/students');
  return pickStudentListFromPayload(res.data as unknown)
};

// GET /v1/students/{matric_no}
export const getStudent = async (matric_no: string): Promise<Student | null> => {
  const normalized = normalizeMatric(matric_no)
  const res = await api.get(`/v1/students/${encodeMatric(normalized)}`);
  if (!res.data) return null;
  return pickStudentFromPayload(res.data)
};

type StudentWritePayload = Partial<Student> & {
  passport?: string | File | Blob | null;
  signature?: string | File | Blob | null;
}

// Fetch a student using matric_no route: GET /v1/students/{matric_no}
export const getStudentByMatric = async (matric_no: string): Promise<Student | null> => {
  return getStudent(matric_no)
}

// PUT /v1/students/{matric_no}
export const updateStudent = async (matric_no: string, payload: StudentWritePayload): Promise<Student> => {
  const normalized = normalizeMatric(matric_no)
  const buildMultipartConfig = () => ({
    headers: {
      "Content-Type": "multipart/form-data",
    },
  })

  try {
    // Laravel/PHP commonly ignores multipart payloads on native PUT requests.
    // Use POST + _method=PUT to ensure all fields/files are parsed.
    const body = await buildStudentFormData(payload)
    body.append("_method", "PUT")
    const res = await api.post(`/v1/students/${encodeMatric(normalized)}`, body, buildMultipartConfig())
    const fromBody = pickStudentFromPayload(res.data)
    if (fromBody) return fromBody
  } catch (error) {
    if (!isAxiosError(error)) throw error
    const status = error.response?.status
    const shouldRetryAsNativePut = status === 404 || status === 405
    if (!shouldRetryAsNativePut) throw error

    const body = await buildStudentFormData(payload)
    const res = await api.put(`/v1/students/${encodeMatric(normalized)}`, body, buildMultipartConfig())
    const fromBody = pickStudentFromPayload(res.data)
    if (fromBody) return fromBody
  }

  const nextMatric = String(payload.matric_no ?? matric_no)
  const fallback = await getStudent(nextMatric)
  if (fallback) return fallback
  throw new Error("Student updated but API response did not include retrievable student data.")
};

export const createStudent = async (payload: CreateStudentPayload): Promise<Student> => {
  const body = await buildStudentFormData(payload)
  const res = await api.post('/v1/students', body, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  const fromBody = pickStudentFromPayload(res.data)
  if (fromBody) return fromBody
  const fallback = await getStudentByMatric(payload.matric_no)
  if (fallback) return fallback
  throw new Error("Student created but API response did not include retrievable student data.")
};

// Update by matric_no: PUT /v1/students/{matric_no}
export const updateStudentByMatric = async (matric_no: string, payload: StudentWritePayload): Promise<Student> => {
  return updateStudent(matric_no, payload)
}

// PATCH /v1/students/{matric_no}/printed
export const updateStudentPrintedStatus = async (
  matric_no: string,
  is_printed: boolean
): Promise<Student> => {
  const normalized = normalizeMatric(matric_no)
  const res = await api.patch(`/v1/students/${encodeMatric(normalized)}/printed`, {
    is_printed,
  })
  const fromBody = pickStudentFromPayload(res.data)
  if (fromBody) return fromBody
  const fallback = await getStudent(normalized)
  if (fallback) return fallback
  throw new Error("Student print status updated but API response did not include retrievable student data.")
}

// DELETE /v1/students/{matric_no}
export const deleteStudent = async (matric_no: string): Promise<void> => {
  await api.delete(`/v1/students/${encodeMatric(matric_no)}`);
};

// Delete by matric_no: DELETE /v1/students/{matric_no}
export const deleteStudentByMatric = async (matric_no: string): Promise<void> => {
  await deleteStudent(matric_no)
}

export const findStudent = async (
  params: { matric_no?: string; matric?: string; jamb_no?: string; jamb?: string }
): Promise<Student | null> => {
  const expectedMatric = (params.matric_no ?? params.matric ?? "").trim().toUpperCase()
  const expectedJamb = (params.jamb_no ?? params.jamb ?? "").trim().toUpperCase()
  const matchesMatric = (value?: string | null) =>
    expectedMatric ? String(value ?? "").trim().toUpperCase() === expectedMatric : true
  const matchesJamb = (value?: string | null) =>
    expectedJamb ? String(value ?? "").trim().toUpperCase() === expectedJamb : true
  const isLookupNotFound = (error: unknown) =>
    isAxiosError(error) && [404, 422].includes(error.response?.status ?? 0)
  let serviceError: unknown = null

  // If a matric was provided, prefer the matric-specific endpoint first
  const matricToTry = params.matric_no ?? params.matric
  if (matricToTry) {
    try {
      const byMatric = await getStudentByMatric(matricToTry)
      if (byMatric) {
        if (matchesJamb(byMatric.jamb_no)) return byMatric
        if (expectedJamb) return null
      }
    } catch (err) {
      if (!isLookupNotFound(err)) {
        serviceError = err
      }
      console.warn('getStudentByMatric failed', err)
      // continue to query list endpoint as fallback
    }
  }
  const tryParamsList: Array<Record<string, string | undefined>> = []

  // Prefer explicit matric_no, but try common variants
  if (params.matric_no) {
    tryParamsList.push({ matric_no: params.matric_no, jamb_no: params.jamb_no ?? params.jamb })
    tryParamsList.push({ matric: params.matric_no, jamb_no: params.jamb_no ?? params.jamb })
  }
  if (params.matric) {
    tryParamsList.push({ matric: params.matric, jamb_no: params.jamb_no ?? params.jamb })
    tryParamsList.push({ matric_no: params.matric, jamb_no: params.jamb_no ?? params.jamb })
  }
  // final attempt by jamb only applies only when matric is not provided
  if (!expectedMatric && (params.jamb_no || params.jamb)) {
    tryParamsList.push({ jamb_no: params.jamb_no ?? params.jamb })
  }

  for (const p of tryParamsList) {
    try {
      const res = await api.get('/v1/students', { params: p })
      const list = pickStudentListFromPayload(res.data as unknown)
      const matched = list.find((student) =>
        matchesMatric(student.matric_no) && matchesJamb(student.jamb_no)
      )
      if (matched) return matched
    } catch (err) {
      if (!isLookupNotFound(err)) {
        serviceError = err
      }
      console.warn('findStudent request failed for', p, err)
      // try next
    }
  }

  // Fallback: fetch all students and match client-side (last resort)
  try {
    const res = await api.get('/v1/students')
    const list = pickStudentListFromPayload(res.data as unknown)
    return (
      list.find((s) => {
        return matchesMatric(s.matric_no) && matchesJamb(s.jamb_no)
      }) ?? null
    )
  } catch (err) {
    if (!isLookupNotFound(err)) {
      serviceError = err
    }
    console.warn('findStudent fallback fetch failed', err)
  }

  if (serviceError) {
    throw serviceError
  }
  return null
}

export default {
  api,
  loginUser,
  logoutUser,
  requestPasswordReset,
  resetPassword,
  listUsers,
  createUser,
  updateUser,
  createStudent,
  getSubmittedStudentCount,
  getPrintedStudentCount,
  getStudentMatricCount,
  listStudents,
  listStudentDepartments,
  getStudent,
  updateStudent,
  updateStudentPrintedStatus,
  deleteStudent,
};
