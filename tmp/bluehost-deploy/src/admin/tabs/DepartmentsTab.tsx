import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

import type { Department } from "@/admin/types"

type DepartmentsTabProps = {
  departments: Department[]
  deptName: string
  setDeptName: (name: string) => void
  addDepartment: () => void
  removeDepartment: (id: string) => void
}

export function DepartmentsTab({
  departments,
  deptName,
  setDeptName,
  addDepartment,
  removeDepartment,
}: DepartmentsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Departments</CardTitle>
        <CardDescription>Create and manage departments.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="New department"
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
          />
          <Button onClick={addDepartment} className="w-full sm:w-auto">
            Add
          </Button>
        </div>
        <div className="grid gap-2">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm font-medium text-slate-800">{dept.name}</span>
              <Button variant="ghost" onClick={() => removeDepartment(dept.id)} className="w-full sm:w-auto">
                Remove
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
