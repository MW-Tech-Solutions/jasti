import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { resolveApiAssetUrl } from "@/lib/studentApi"

import type { Department, Student } from "@/admin/types"

type StudentForm = Omit<Student, "id">

type StudentsTabProps = {
  studentForm: StudentForm
  setStudentForm: React.Dispatch<React.SetStateAction<StudentForm>>
  departments: Department[]
  students: Student[]
  addStudent: () => Promise<void> | void
  isEditing: boolean
  savingStudent: boolean
  onCancelEdit: () => void
  handleStudentFile: (field: "passport" | "signature") => (file?: File | null) => Promise<void>
}

export function StudentsTab({
  studentForm,
  setStudentForm,
  departments,
  students,
  addStudent,
  isEditing,
  savingStudent,
  onCancelEdit,
  handleStudentFile,
}: StudentsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Student Records</CardTitle>
        <CardDescription>Add and manage student data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Input
            placeholder="Matric number"
            value={studentForm.matric}
            onChange={(e) =>
              setStudentForm((prev) => ({
                ...prev,
                matric: e.target.value,
              }))
            }
          />
          <Input
            placeholder="JAMB registration number"
            value={studentForm.jambRegNumber ?? ""}
            onChange={(e) =>
              setStudentForm((prev) => ({
                ...prev,
                jambRegNumber: e.target.value,
              }))
            }
          />
          <Input
            placeholder="First name"
            value={studentForm.firstName}
            onChange={(e) =>
              setStudentForm((prev) => ({
                ...prev,
                firstName: e.target.value,
              }))
            }
          />
          <Input
            placeholder="Last name"
            value={studentForm.lastName}
            onChange={(e) =>
              setStudentForm((prev) => ({
                ...prev,
                lastName: e.target.value,
              }))
            }
          />
          <Input
            placeholder="Other name"
            value={studentForm.otherName}
            onChange={(e) =>
              setStudentForm((prev) => ({
                ...prev,
                otherName: e.target.value,
              }))
            }
          />
          <select
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            value={studentForm.departmentId}
            onChange={(e) =>
              setStudentForm((prev) => ({
                ...prev,
                departmentId: e.target.value,
              }))
            }
          >
            <option value="">Department</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Graduation year"
            value={studentForm.graduationYear}
            onChange={(e) =>
              setStudentForm((prev) => ({
                ...prev,
                graduationYear: e.target.value,
              }))
            }
          />
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Passport (image)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => void handleStudentFile("passport")(e.target.files?.[0])}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Signature (image)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => void handleStudentFile("signature")(e.target.files?.[0])}
            />
          </div>
        </div>
        {(studentForm.passport || studentForm.signature) && (
          <div className="flex flex-wrap gap-4 rounded-md border border-slate-200 bg-slate-50 p-3">
            {studentForm.passport && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600">Passport</p>
                <img
                  src={resolveApiAssetUrl(studentForm.passport)}
                  alt="Student passport preview"
                  crossOrigin="anonymous"
                  className="h-20 w-20 rounded-md border border-slate-200 object-cover"
                />
              </div>
            )}
            {studentForm.signature && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600">Signature</p>
                <img
                  src={resolveApiAssetUrl(studentForm.signature)}
                  alt="Student signature preview"
                  crossOrigin="anonymous"
                  className="h-20 w-32 rounded-md border border-slate-200 bg-white object-contain p-2"
                />
              </div>
            )}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => void addStudent()} disabled={savingStudent} className="w-full sm:w-auto">
            {savingStudent ? "Saving..." : isEditing ? "Update student" : "Add student"}
          </Button>
          {isEditing && (
            <Button variant="outline" onClick={onCancelEdit} disabled={savingStudent} className="w-full sm:w-auto">
              Cancel edit
            </Button>
          )}
        </div>
        <Separator />
        <div className="space-y-2">
          {students.map((student) => (
            <div
              key={student.id}
              className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-slate-800">
                  {student.firstName} {student.lastName}
                </p>
                <p className="text-xs text-slate-500">
                  {student.matric}
                </p>
              </div>
              <Badge variant="outline" className="w-fit">
                {student.departmentId}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
