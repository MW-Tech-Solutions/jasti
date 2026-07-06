import * as React from "react"
import { Edit2, Eye, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

import type { Student } from "@/admin/types"

type ManageStudentsTabProps = {
  students: Student[]
  selectedStudent: Student | null
  manageViewStudentId: string | null
  query: string
  rowsPerPage: number
  currentPage: number
  onQueryChange: (value: string) => void
  onRowsPerPageChange: (value: number) => void
  onCurrentPageChange: (value: number) => void
  onNewStudent: () => void
  onViewStudent: (student: Student) => void
  onEditStudent: (student: Student) => void
  onRemoveStudent: (student: Student) => void
}

export function ManageStudentsTab({
  students,
  selectedStudent,
  manageViewStudentId,
  query,
  rowsPerPage,
  currentPage,
  onQueryChange,
  onRowsPerPageChange,
  onCurrentPageChange,
  onNewStudent,
  onViewStudent,
  onEditStudent,
  onRemoveStudent,
}: ManageStudentsTabProps) {
  const buildPageItems = React.useCallback((page: number, totalPages: number) => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1)
    }

    if (page <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages]
    }

    if (page >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }

    return [1, "...", page - 1, page, page + 1, "...", totalPages]
  }, [])

  const filteredStudents = React.useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return students
    return students.filter((student) => {
      const fullName = `${student.firstName} ${student.otherName ?? ""} ${student.lastName}`.toLowerCase()
      return (
        student.matric.toLowerCase().includes(normalized) ||
        student.departmentId.toLowerCase().includes(normalized) ||
        fullName.includes(normalized)
      )
    })
  }, [query, students])

  const totalPages = Math.max(Math.ceil(filteredStudents.length / rowsPerPage), 1)

  React.useEffect(() => {
    if (currentPage > totalPages) {
      onCurrentPageChange(totalPages)
    }
  }, [currentPage, onCurrentPageChange, totalPages])

  const pageItems = React.useMemo(
    () => buildPageItems(currentPage, totalPages),
    [buildPageItems, currentPage, totalPages]
  )

  const pageStart = (currentPage - 1) * rowsPerPage
  const pagedStudents = filteredStudents.slice(pageStart, pageStart + rowsPerPage)
  const showingFrom = filteredStudents.length > 0 ? pageStart + 1 : 0
  const showingTo = Math.min(pageStart + rowsPerPage, filteredStudents.length)

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="text-xl text-slate-900">Manage Students</CardTitle>
            {/* <CardDescription className="mt-1">d maintain student records.</CardDescription> */}
          </div>
          <Button onClick={onNewStudent} className="w-full md:w-auto">
            New Student
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_auto_auto]">
          <Input
            placeholder="Search by matric, name, or department"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="bg-white"
          />
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700"
            value={rowsPerPage}
            onChange={(event) => onRowsPerPageChange(Number(event.target.value))}
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
          </select>
          <div className="flex items-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-600">
            Total: <span className="ml-1 font-semibold text-slate-900">{filteredStudents.length}</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-auto">
            <table className="min-w-[720px] w-full table-auto text-sm">
              <thead className="bg-slate-100">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-4 py-3">Matric</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Graduation</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedStudents.map((student, index) => (
                  <tr
                    key={student.id}
                    className={`border-t border-slate-100 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{student.matric}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {student.firstName} {student.otherName} {student.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{student.departmentId}</td>
                    <td className="px-4 py-3 text-slate-700">{student.graduationYear}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {/* <Button variant="ghost" size="sm" onClick={() => onViewStudent(student)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onEditStudent(student)}>
                          <Edit2 className="h-4 w-4" />
                        </Button> */}
                        <Button variant="ghost" size="sm" onClick={() => onRemoveStudent(student)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredStudents.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-500">No student records matched your search.</p>
            )}
          </div>
        </div>

        {filteredStudents.length > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-slate-600">
              Showing <span className="font-semibold text-slate-900">{showingFrom}</span> to{" "}
              <span className="font-semibold text-slate-900">{showingTo}</span> of{" "}
              <span className="font-semibold text-slate-900">{filteredStudents.length}</span>
            </p>
            <nav aria-label="Student table pagination">
              <ul className="inline-flex flex-wrap items-center gap-1">
                <li>
                  <button
                    type="button"
                    onClick={() => onCurrentPageChange(Math.max(currentPage - 1, 1))}
                    disabled={currentPage === 1}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                </li>
                {pageItems.map((item, index) => (
                  <li key={`${item}-${index}`}>
                    {item === "..." ? (
                      <span className="px-2 py-1.5 text-sm text-slate-500">...</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onCurrentPageChange(Number(item))}
                        className={`rounded-md border px-3 py-1.5 text-sm ${
                          currentPage === item
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {item}
                      </button>
                    )}
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => onCurrentPageChange(Math.min(currentPage + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        )}
        {manageViewStudentId && selectedStudent && selectedStudent.id === manageViewStudentId && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-semibold text-slate-900">
              {selectedStudent.firstName} {selectedStudent.otherName} {selectedStudent.lastName}
            </p>
            <p className="mt-1 text-xs text-slate-600">{selectedStudent.matric}</p>
            <p className="text-xs text-slate-600">
              Dept: {selectedStudent.departmentId} - Grad: {selectedStudent.graduationYear}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
