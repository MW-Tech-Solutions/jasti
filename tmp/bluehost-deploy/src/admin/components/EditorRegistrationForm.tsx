import * as React from "react"
import { CheckCircle2, Upload, XCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { journalApi, resolveApiErrorMessage } from "@/lib/journalApi"

type EditorType = {
  editor_type_id: number
  type_name: string
  title: string
  description: string
  capabilities: {
    can_assign_reviewers: boolean
    can_make_decisions: boolean
    can_appoint_editors: boolean
  }
}

type EditorRegistrationFormProps = {
  onBack: () => void
  onSuccess: (result: any, accountType: "author" | "editor") => void
  onAccountTypeChange?: (accountType: "author" | "editor") => void
  fixedAccountType?: "author" | "editor"
}

type CountryApiResponse = {
  name?: {
    common?: string
  }
}

const COUNTRY_API_URL = "https://restcountries.com/v3.1/all?fields=name"
const countryFieldClassName =
  "flex h-11 w-full rounded-2xl border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] px-4 py-2.5 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_10px_24px_rgba(15,23,42,0.05)] focus-visible:border-[#0b6fa4]/45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0b6fa4]/12 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
const passwordRequirementRules = [
  { label: "atleast 8 characters", test: (value: string) => value.length >= 8 },
  { label: "atleast 1 uppercase", test: (value: string) => /[A-Z]/.test(value) },
  { label: "atleast 1 lowercase", test: (value: string) => /[a-z]/.test(value) },
  { label: "atleast 1 number", test: (value: string) => /\d/.test(value) },
  { label: "atleast 1 special char", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
]

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function EditorRegistrationForm({ onBack, onSuccess, onAccountTypeChange, fixedAccountType }: EditorRegistrationFormProps) {
  const stepHeadingClassName = "mb-4 text-[13px] font-semibold tracking-tight whitespace-nowrap sm:text-lg"
  const [editorTypes, setEditorTypes] = React.useState<EditorType[]>([])
  const [editorTypesLoading, setEditorTypesLoading] = React.useState(false)
  const [editorTypesError, setEditorTypesError] = React.useState("")
  const [accountType, setAccountType] = React.useState<"author" | "editor">(fixedAccountType ?? "editor")
  const [selectedType, setSelectedType] = React.useState("")
  const [currentStep, setCurrentStep] = React.useState<1 | 2 | 3 | 4>(1)
  const [countryOptions, setCountryOptions] = React.useState<string[]>(["Nigeria"])
  const [countriesLoading, setCountriesLoading] = React.useState(true)
  const [countryLookupFailed, setCountryLookupFailed] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [cvFile, setCvFile] = React.useState<File | null>(null)
  const [registrationComplete, setRegistrationComplete] = React.useState(false)
  const [passwordFieldFocused, setPasswordFieldFocused] = React.useState(false)
  const [formData, setFormData] = React.useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm_password: "",
    institution: "",
    country: "Nigeria",
    phone: "",
    orcid_id: "",
    editor_type: "",
    subject_areas: "",
    expertise_description: "",
    bio: "",
  })

  const loadEditorTypes = React.useCallback(async (showErrorToast = false) => {
    if (editorTypesLoading) {
      return
    }

    setEditorTypesLoading(true)
    setEditorTypesError("")

    try {
      const { data } = await journalApi.get("/editor/editor-types.php")
      setEditorTypes(data.editor_types ?? [])
    } catch (error) {
      const message = "Failed loading editor types. Please try again."
      setEditorTypesError(message)
      if (showErrorToast) {
        toast.error(message)
      }
    } finally {
      setEditorTypesLoading(false)
    }
  }, [editorTypesLoading])

  React.useEffect(() => {
    if (accountType !== "editor" || editorTypes.length > 0) {
      return
    }

    void loadEditorTypes(false)
  }, [accountType, editorTypes.length, loadEditorTypes])

  React.useEffect(() => {
    const controller = new AbortController()

    const loadCountries = async () => {
      setCountriesLoading(true)
      setCountryLookupFailed(false)

      try {
        const response = await fetch(COUNTRY_API_URL, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Country request failed with status ${response.status}`)
        }

        const data = (await response.json()) as CountryApiResponse[]
        const countries = Array.from(
          new Set(data.map((country) => country.name?.common?.trim()).filter((countryName): countryName is string => Boolean(countryName)))
        ).sort((left, right) => left.localeCompare(right))

        if (countries.length === 0) {
          throw new Error("Country list is empty")
        }

        setCountryOptions(countries)
        setFormData((prev) => {
          const nextCountry = countries.includes(prev.country)
            ? prev.country
            : countries.includes("Nigeria")
              ? "Nigeria"
              : countries[0] ?? ""

          return nextCountry === prev.country ? prev : { ...prev, country: nextCountry }
        })
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return
        }

        setCountryLookupFailed(true)
        toast.error("Unable to load countries right now. You can type your country manually.")
      } finally {
        if (!controller.signal.aborted) {
          setCountriesLoading(false)
        }
      }
    }

    void loadCountries()

    return () => {
      controller.abort()
    }
  }, [])

  React.useEffect(() => {
    onAccountTypeChange?.(accountType)
  }, [accountType, onAccountTypeChange])

  React.useEffect(() => {
    if (!fixedAccountType) {
      return
    }

    setAccountType(fixedAccountType)
    if (fixedAccountType === "author") {
      setSelectedType("")
      setFormData((prev) => ({ ...prev, editor_type: "" }))
    }
  }, [fixedAccountType])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.currentTarget
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleEditorTypeSelect = (typeName: string) => {
    setSelectedType(typeName)
    setFormData((prev) => ({ ...prev, editor_type: typeName }))
  }

  const handleCvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0]
    if (!file) return

    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must not exceed 10MB")
      return
    }
    setCvFile(file)
  }

  const passwordRequirementStates = passwordRequirementRules.map((rule) => ({
    label: rule.label,
    met: rule.test(formData.password),
  }))
  const shouldShowPasswordChecks = passwordFieldFocused || formData.password.length > 0
  const isPasswordStrong = passwordRequirementStates.every((rule) => rule.met)
  const passwordsMatch = formData.password !== "" && formData.password === formData.confirm_password

  const validatePersonalInformationStep = () => {
    if (
      formData.first_name.trim() === "" ||
      formData.last_name.trim() === "" ||
      formData.email.trim() === "" ||
      formData.password === "" ||
      formData.confirm_password === "" ||
      formData.institution.trim() === "" ||
      formData.country.trim() === ""
    ) {
      toast.error("Please complete all required fields before continuing.")
      return false
    }

    if (!isValidEmailAddress(formData.email)) {
      toast.error("Please enter a valid email address.")
      return false
    }

    if (!isPasswordStrong) {
      toast.error("Password must include at least 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special char.")
      return false
    }

    if (!passwordsMatch) {
      toast.error("Passwords do not match.")
      return false
    }

    return true
  }

  const handleStepTwoNext = () => {
    if (!validatePersonalInformationStep()) {
      return
    }

    setCurrentStep(3)
  }

  const handleRegisterClick = async () => {
    if (accountType === "editor" && !selectedType) {
      toast.error("Please select an editor role")
      return
    }

    if (!validatePersonalInformationStep()) {
      return
    }

    const { confirm_password, ...registrationPayload } = formData

    setSubmitting(true)
    try {
      if (accountType === "author") {
        const { data } = await journalApi.post("/auth/create-account.php", {
          ...registrationPayload,
          confirm_password,
          role: "author",
        })
        toast.success("Registration successful! Check your email to verify your account.")
        setRegistrationComplete(true)
        onSuccess(data, accountType)
        return
      }

      await journalApi.post("/auth/create-account.php", { ...registrationPayload, confirm_password, editor_type: selectedType, role: "editor" })
      toast.success("Registration successful! Please upload your CV.")
      setCurrentStep(4)
    } catch (error) {
      toast.error(resolveApiErrorMessage(error, "Registration failed"))
    } finally {
      setSubmitting(false)
    }
  }

  const handleUploadCv = async () => {
    if (!cvFile) {
      toast.error("Please select a CV file to upload")
      return
    }

    setSubmitting(true)
    try {
      const payload = new FormData()
      payload.append("cv_file", cvFile)
      const { data } = await journalApi.post("/editor/upload-cv.php", payload, { headers: { "Content-Type": "multipart/form-data" } })
      toast.success("CV uploaded successfully!")
      setRegistrationComplete(true)
      onSuccess(data, accountType)
    } catch (error) {
      toast.error(resolveApiErrorMessage(error, "CV upload failed"))
    } finally {
      setSubmitting(false)
    }
  }

  if (registrationComplete) {
    return (
      <div className="w-full max-w-7xl">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Registration Complete!</h2>
          <p className="text-gray-600 mb-4">
            {accountType === "editor"
              ? "Your CV has been uploaded successfully. Admin / Editor-in-Chief will review your application before access is granted."
              : "Check your email inbox and click the verification link before signing in."}
          </p>
          <Button onClick={onBack}>Back to Login</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-2">Registration</h2>

        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className={`flex-1 h-2 rounded-full ${step <= currentStep ? "bg-blue-600" : "bg-gray-200"}`} />
          ))}
        </div>

        {currentStep === 1 && (
          <div>
            <h3 className={stepHeadingClassName}>{fixedAccountType === "editor" ? "Step 1: Select Editor Role" : "Step 1: Choose Registration Type"}</h3>

            {fixedAccountType ? null : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <button
                  type="button"
                  onClick={() => {
                    setAccountType("author")
                    setSelectedType("")
                  }}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    accountType === "author" ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">Author</h4>
                      <p className="text-sm text-gray-600 mt-1">Submit manuscripts and track the publishing workflow.</p>
                    </div>
                    {accountType === "author" ? <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" /> : null}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAccountType("editor")}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    accountType === "editor" ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">Editor (Application)</h4>
                      <p className="text-sm text-gray-600 mt-1">Apply to join the editorial team and upload a CV (PDF).</p>
                    </div>
                    {accountType === "editor" ? <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" /> : null}
                  </div>
                </button>
              </div>
            )}

            {accountType === "editor" ? (
              <div className="mb-8">
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Select editor role</h4>
                {editorTypesLoading ? (
                  <p className="text-sm text-slate-500">Loading editor roles...</p>
                ) : editorTypesError ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <p>{editorTypesError}</p>
                    <Button type="button" variant="outline" className="mt-3" onClick={() => void loadEditorTypes(true)}>
                      Retry loading editor roles
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {editorTypes.map((type) => (
                      <button
                        key={type.editor_type_id}
                        type="button"
                        onClick={() => handleEditorTypeSelect(type.type_name)}
                        className={`p-4 border-2 rounded-lg text-left transition-all ${
                          selectedType === type.type_name ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h5 className="font-semibold text-gray-900">{type.title}</h5>
                            <p className="text-sm text-gray-600 mt-1">{type.description.substring(0, 100)}...</p>
                          </div>
                          {selectedType === type.type_name ? <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" /> : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex gap-4">
              <Button onClick={onBack} variant="outline">
                
                {fixedAccountType ? "Back to login" : "Cancel"}
              </Button>
              <Button onClick={() => setCurrentStep(2)} disabled={accountType === "editor" && (!selectedType || editorTypesLoading || editorTypesError !== "")}>
                Next
              </Button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <h3 className={stepHeadingClassName}>Step 2: Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div>
                <Label htmlFor="first_name">First Name *</Label>
                <Input id="first_name" name="first_name" value={formData.first_name} onChange={handleInputChange} required />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name *</Label>
                <Input id="last_name" name="last_name" value={formData.last_name} onChange={handleInputChange} required />
              </div>
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onFocus={() => setPasswordFieldFocused(true)}
                  onBlur={() => setPasswordFieldFocused(false)}
                  onChange={handleInputChange}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                {shouldShowPasswordChecks ? (
                  <div className="mt-3 rounded-[1.35rem] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_14px_34px_rgba(15,23,42,0.06)]">
                    <p className="text-base font-semibold text-slate-900">Password must have:</p>
                    <div className="mt-4 space-y-3">
                    {passwordRequirementStates.map((requirement) => (
                      <div key={requirement.label} className="flex items-center gap-3 text-[15px] leading-none">
                        <span className={requirement.met ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.6rem] bg-emerald-600 text-white shadow-sm" : "flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.6rem] bg-red-600 text-white shadow-sm"}>
                          {requirement.met ? (
                            <CheckCircle2 className="h-4.5 w-4.5" />
                          ) : (
                            <XCircle className="h-4.5 w-4.5" />
                          )}
                        </span>
                        <span className={requirement.met ? "text-slate-700" : "text-slate-500"}>
                          {requirement.label}
                        </span>
                      </div>
                    ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="confirm_password">Confirm Password *</Label>
                <Input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  value={formData.confirm_password}
                  onChange={handleInputChange}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                {formData.confirm_password !== "" ? (
                  <p className={`mt-2 text-xs ${passwordsMatch ? "text-emerald-600" : "text-red-600"}`}>
                    {passwordsMatch ? "Passwords match." : "Passwords do not match."}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="institution">Institution *</Label>
                <Input id="institution" name="institution" value={formData.institution} onChange={handleInputChange} required />
              </div>
              <div>
                <Label htmlFor="country">Country *</Label>
                {countryLookupFailed ? (
                  <>
                    <Input id="country" name="country" value={formData.country} onChange={handleInputChange} required />
                    <p className="mt-2 text-xs text-amber-600">Country list is unavailable, so manual entry is enabled.</p>
                  </>
                ) : (
                  <>
                    <select
                      id="country"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      className={countryFieldClassName}
                      disabled={countriesLoading}
                      required
                    >
                      {countriesLoading ? <option value={formData.country}>Loading countries...</option> : null}
                      {!countriesLoading ? <option value="">Select a country</option> : null}
                      {countryOptions.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                    {countriesLoading ? <p className="mt-2 text-xs text-slate-500">Loading country list from the online country API...</p> : null}
                  </>
                )}
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="orcid_id">ORCID ID</Label>
                <Input id="orcid_id" name="orcid_id" value={formData.orcid_id} onChange={handleInputChange} />
              </div>
            </div>
            <div className="flex gap-4">
              <Button onClick={() => setCurrentStep(1)} variant="outline">
                Back
              </Button>
              <Button onClick={handleStepTwoNext}>
                Next
              </Button>
            </div>
          </div>
        )}

        {currentStep === 3 && accountType === "editor" ? (
          <div>
            <h3 className={stepHeadingClassName}>Step 3: Professional Details</h3>
            <div className="space-y-4 mb-8">
              <div>
                <Label htmlFor="subject_areas">Subject Areas / Specializations</Label>
                <textarea
                  id="subject_areas"
                  name="subject_areas"
                  value={formData.subject_areas}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="expertise_description">Expertise Description</Label>
                <textarea
                  id="expertise_description"
                  name="expertise_description"
                  value={formData.expertise_description}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="bio">Biography</Label>
                <textarea id="bio" name="bio" value={formData.bio} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" rows={3} />
              </div>
            </div>
            <div className="flex gap-4">
              <Button onClick={() => setCurrentStep(2)} variant="outline">
                Back
              </Button>
              <Button onClick={handleRegisterClick} disabled={submitting}>
                {submitting ? "Registering..." : "Complete Registration"}
              </Button>
            </div>
          </div>
        ) : currentStep === 3 ? (
          <div>
            <h3 className={stepHeadingClassName}>Step 3: Review & Create Account</h3>
            <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">Author account</p>
              <p className="mt-1">An email verification link will be sent to {formData.email || "your email"}.</p>
            </div>
            <div className="flex gap-4">
              <Button onClick={() => setCurrentStep(2)} variant="outline">
                Back
              </Button>
              <Button onClick={handleRegisterClick} disabled={submitting}>
                {submitting ? "Registering..." : "Create account"}
              </Button>
            </div>
          </div>
        ) : null}

        {currentStep === 4 && accountType === "editor" ? (
          <div>
            <h3 className={stepHeadingClassName}>Step 4: Upload Your CV</h3>
            <div className="mb-8">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Upload your CV (PDF only, max 10MB)</p>
                <input type="file" accept="application/pdf" onChange={handleCvFileChange} className="hidden" id="cv-upload" />
                <label htmlFor="cv-upload">
                  <Button type="button" onClick={() => document.getElementById("cv-upload")?.click()} variant="outline" className="cursor-pointer">
                    Select CV File
                  </Button>
                </label>
                {cvFile ? (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-700 font-semibold">{cvFile.name}</p>
                    <p className="text-sm text-green-600">{(cvFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex gap-4">
              <Button onClick={() => setCurrentStep(3)} variant="outline">
                Back
              </Button>
              <Button onClick={handleUploadCv} disabled={!cvFile || submitting}>
                {submitting ? "Uploading..." : "Upload CV & Complete"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
