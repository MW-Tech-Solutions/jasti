export type Department = {
  id: string
  name: string
}

export type Student = {
  id: string
  matric: string
  jambRegNumber?: string
  firstName: string
  lastName: string
  otherName?: string
  email: string
  phone: string
  departmentId: string
  graduationYear: string
  passport?: string
  signature?: string
  isSubmitted?: boolean
  isPrinted?: boolean
}

export type Staff = {
  id: string
  pfNumber: string
  firstName: string
  lastName: string
  otherName?: string
  email: string
  phone: string
  departmentId: string
  rank: string
  passport?: string
  signature?: string
}

export type UploadedStudent = Omit<Student, "id"> & { id?: string }

export type AdminUser = {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  passport?: string
  lastLogin?: string
  createdAt?: string
  updatedAt?: string
}

export type TabKey =
  | "dashboard"
  | "departments"
  | "students"
  | "edit-student"
  | "manage"
  | "users"
  | "staff"
  | "cards"
  | "upload"
