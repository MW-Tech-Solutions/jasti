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

const verifySchema = z.object({
  matric: z
    .string()
    .min(5, "Matric number is required.")
    .regex(/^[A-Z0-9/]+$/, "Matric number must use letters, numbers, or /."),
  jamb_no: z
    .string()
    .min(5, "JAMB registration number is required.")
    .regex(/^[A-Z0-9/]+$/, "JAMB registration number must use letters, numbers, or /."),
})

type VerifyForm = z.infer<typeof verifySchema>

type VerifyStepProps = {
  form: UseFormReturn<VerifyForm>
  onSubmit: () => void
}

export function VerifyStep({ form, onSubmit }: VerifyStepProps) {
  const matricRegister = form.register("matric", {
    setValueAs: (value) => (value ? String(value).toUpperCase() : ""),
  })
  return (
    <Card className="shadow-lift">
      <CardHeader className="text-center">
        <CardTitle>VERIFY STUDENT RECORD</CardTitle>
        {/* <CardDescription>
          Provide your matric number and JAMB registration number.
        </CardDescription> */}
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="matric">Matric Number</Label>
            <Input
              id="matric"
              placeholder="26/0001/UE"
              {...matricRegister}
              className="uppercase"
              disabled={form.formState.isSubmitting}
              aria-busy={form.formState.isSubmitting}
            />
            <p className="text-xs text-slate-500">
              Use the format on your admission letter.
            </p>
            {form.formState.errors.matric && (
              <p className="text-xs text-red-600">
                {form.formState.errors.matric.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="jamb_no">JAMB Registration Number</Label>
            <Input
              id="jamb_no"
              placeholder="202450123456AB"
              {...form.register("jamb_no", {
                setValueAs: (value) => (value ? String(value).toUpperCase() : ""),
              })}
              disabled={form.formState.isSubmitting}
              aria-busy={form.formState.isSubmitting}
              className="uppercase"
            />
            <p className="text-xs text-slate-500">
              This must match the JAMB number on record.
            </p>
            {form.formState.errors.jamb_no && (
              <p className="text-xs text-red-600">
                {form.formState.errors.jamb_no.message}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-center">
          <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
            {form.formState.isSubmitting ? "Verifying..." : "Verify & Continue"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
