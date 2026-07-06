import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { resolveApiAssetUrl } from "@/lib/studentApi"

import type { Department, Staff } from "@/admin/types"

type StaffForm = Omit<Staff, "id">

type StaffTabProps = {
  staffForm: StaffForm
  setStaffForm: React.Dispatch<React.SetStateAction<StaffForm>>
  departments: Department[]
  staff: Staff[]
  addStaff: () => void
  handleStaffFile: (field: "passport" | "signature") => (file?: File | null) => Promise<void>
}

export function StaffTab({
  staffForm,
  setStaffForm,
  departments,
  staff,
  addStaff,
  handleStaffFile,
}: StaffTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff Records</CardTitle>
        <CardDescription>Add and manage staff data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Input
            placeholder="PF number"
            value={staffForm.pfNumber}
            onChange={(e) =>
              setStaffForm((prev) => ({
                ...prev,
                pfNumber: e.target.value,
              }))
            }
          />
          <Input
            placeholder="First name"
            value={staffForm.firstName}
            onChange={(e) =>
              setStaffForm((prev) => ({
                ...prev,
                firstName: e.target.value,
              }))
            }
          />
          <Input
            placeholder="Last name"
            value={staffForm.lastName}
            onChange={(e) =>
              setStaffForm((prev) => ({
                ...prev,
                lastName: e.target.value,
              }))
            }
          />
          <Input
            placeholder="Other name"
            value={staffForm.otherName}
            onChange={(e) =>
              setStaffForm((prev) => ({
                ...prev,
                otherName: e.target.value,
              }))
            }
          />
          <Input
            placeholder="Email"
            type="email"
            value={staffForm.email}
            onChange={(e) =>
              setStaffForm((prev) => ({
                ...prev,
                email: e.target.value,
              }))
            }
          />
          <Input
            placeholder="Phone"
            value={staffForm.phone}
            onChange={(e) =>
              setStaffForm((prev) => ({
                ...prev,
                phone: e.target.value,
              }))
            }
          />
          <select
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            value={staffForm.departmentId}
            onChange={(e) =>
              setStaffForm((prev) => ({
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
            placeholder="Rank"
            value={staffForm.rank}
            onChange={(e) =>
              setStaffForm((prev) => ({
                ...prev,
                rank: e.target.value,
              }))
            }
          />
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Passport (image)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => void handleStaffFile("passport")(e.target.files?.[0])}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Signature (image)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => void handleStaffFile("signature")(e.target.files?.[0])}
            />
          </div>
        </div>
        {(staffForm.passport || staffForm.signature) && (
          <div className="flex flex-wrap gap-4 rounded-md border border-slate-200 bg-slate-50 p-3">
            {staffForm.passport && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600">Passport</p>
                <img
                  src={resolveApiAssetUrl(staffForm.passport)}
                  alt="Staff passport preview"
                  crossOrigin="anonymous"
                  className="h-20 w-20 rounded-md border border-slate-200 object-cover"
                />
              </div>
            )}
            {staffForm.signature && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600">Signature</p>
                <img
                  src={resolveApiAssetUrl(staffForm.signature)}
                  alt="Staff signature preview"
                  crossOrigin="anonymous"
                  className="h-20 w-32 rounded-md border border-slate-200 bg-white object-contain p-2"
                />
              </div>
            )}
          </div>
        )}
        <Button onClick={addStaff} className="w-full sm:w-auto">
          Add staff
        </Button>
        <Separator />
        <div className="space-y-2">
          {staff.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-slate-800">
                  {member.firstName} {member.lastName}
                </p>
                <p className="text-xs text-slate-500">
                  {member.pfNumber} - {member.email}
                </p>
              </div>
              <Badge variant="outline" className="w-fit">
                {member.departmentId}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
