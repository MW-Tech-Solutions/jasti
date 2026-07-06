import type { UseFormReturn } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const biodataSchema = z.object({
  firstName: z.string().trim().min(2, "First name is required."),
  lastName: z.string().trim().min(2, "Last name is required."),
  otherName: z.string().optional(),
  graduationYear: z.string().optional(),
  department: z.string().trim().min(1, "Department is required."),
})

type BiodataForm = z.infer<typeof biodataSchema>

type BiodataStepProps = {
  form: UseFormReturn<BiodataForm>
  matric: string
  onBack: () => void
  onNext: () => void | Promise<void>
}

export function BiodataStep({ form, matric, onBack, onNext }: BiodataStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirm Biodata</CardTitle>
        <CardDescription>
          Review your details exactly as they should appear on the ID card.
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void onNext()
        }}
      >
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input id="firstName" {...form.register("firstName")} />
            {form.formState.errors.firstName && (
              <p className="text-xs text-red-600">{form.formState.errors.firstName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input id="lastName" {...form.register("lastName")} />
            {form.formState.errors.lastName && (
              <p className="text-xs text-red-600">{form.formState.errors.lastName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="otherName">Other Name</Label>
            <Input id="otherName" {...form.register("otherName")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="graduationYear">Graduation Year</Label>
            <Input id="graduationYear" {...form.register("graduationYear")} readOnly/>
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              {...form.register("department")}
              readOnly
              aria-readonly="true"
              className="bg-slate-50 text-slate-700"
            />
            {form.formState.errors.department && (
              <p className="text-xs text-red-600">{form.formState.errors.department.message}</p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="matric">Matric Number</Label>
            <Input id="matric" value={matric} readOnly />
            <p className="text-xs text-slate-500">From verification step</p>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onBack} className="w-full sm:w-auto">
            Back
          </Button>
          <Button type="submit" className="w-full sm:w-auto">
            Next
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
