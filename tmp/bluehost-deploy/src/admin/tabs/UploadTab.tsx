import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

import type { UploadedStudent } from "@/admin/types"

type SaveFailure = {
  rowNumber: number
  matric: string
  reason: string
}

type UploadTabProps = {
  uploadKey: number
  uploadRows: UploadedStudent[]
  saveFailures?: SaveFailure[]
  handleUpload: (file?: File | null) => Promise<void>
  clearUpload: () => void
  saveUploadedStudents: () => Promise<void> | void
  savingToDatabase?: boolean
}

export function UploadTab({
  uploadKey,
  uploadRows,
  saveFailures = [],
  handleUpload,
  clearUpload,
  saveUploadedStudents,
  savingToDatabase = false,
}: UploadTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Upload (Excel)</CardTitle>
        <CardDescription>Upload a CSV exported from Excel to stage student records.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            key={uploadKey}
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={(e) => void handleUpload(e.target.files?.[0])}
          />
        </div>
        {uploadRows.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-slate-800">Preview ({uploadRows.length} rows)</p>
            <div className="max-h-[400px] overflow-auto">
              <table className="min-w-[720px] w-full table-auto text-left text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2 font-medium text-slate-600">First Name</th>
                    <th className="px-3 py-2 font-medium text-slate-600">Middle Name</th>
                    <th className="px-3 py-2 font-medium text-slate-600">Surname</th>
                    <th className="px-3 py-2 font-medium text-slate-600">Course of Study</th>
                    <th className="px-3 py-2 font-medium text-slate-600">Matriculation Number</th>
                    <th className="px-3 py-2 font-medium text-slate-600">JAMB REG. NUMBER</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadRows.map((row, index) => (
                    <tr key={index} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-3 py-2">{row.firstName}</td>
                      <td className="px-3 py-2">{row.otherName}</td>
                      <td className="px-3 py-2">{row.lastName}</td>
                      <td className="px-3 py-2">{row.departmentId}</td>
                      <td className="px-3 py-2">{row.matric}</td>
                      <td className="px-3 py-2">{row.jambRegNumber ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {saveFailures.length > 0 && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
            <p className="mb-2 text-sm font-semibold text-rose-800">
              Failed Rows ({saveFailures.length})
            </p>
            <div className="max-h-48 overflow-auto">
              <ul className="space-y-1 text-sm text-rose-700">
                {saveFailures.map((failure, index) => (
                  <li key={`${failure.rowNumber}-${failure.matric}-${index}`}>
                    Row {failure.rowNumber} ({failure.matric || "no matric"}): {failure.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button variant="outline" onClick={clearUpload} disabled={!uploadRows.length} className="w-full sm:w-auto">
          Clear
        </Button>
        <Button
          onClick={() => void saveUploadedStudents()}
          disabled={!uploadRows.length || savingToDatabase}
          className="w-full sm:w-auto"
        >
          {savingToDatabase ? "Saving..." : "Save to database"}
        </Button>
      </CardFooter>
    </Card>
  )
}
