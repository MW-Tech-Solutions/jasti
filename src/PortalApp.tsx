import * as React from "react"
import { isAxiosError } from "axios"
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Globe2,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  Workflow,
  XCircle,
} from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import logoImage from "@/assets/logo.jpeg"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Toaster } from "@/components/ui/sonner"
import EditorRegistrationForm from "@/admin/components/EditorRegistrationForm"
import { getSession, loginAccount, logoutAccount, registerAccount, requestPasswordReset, resendVerificationEmail, resetPassword, resolveApiAssetUrl, resolveApiErrorMessage, type VerificationMeta } from "@/lib/journalApi"
import { cn } from "@/lib/utils"
import { useJournalSettings } from "@/hooks/useJournalSettings"

type PortalAppProps = {
  onAuthenticated: () => Promise<void> | void
  page?:
    | "portal"
    | "author_registration"
    | "reviewer_registration"
    | "editor_registration"
    | "author_login"
    | "reviewer_login"
    | "editor_login"
    | "admin_login"
}

type PortalMode = "login" | "register" | "verification" | "forgot_password" | "reset_password" | "editor_register"

function resolveModeForPage(page: PortalAppProps["page"]): PortalMode {
  if (page === "author_registration" || page === "reviewer_registration") return "register"
  if (page === "editor_registration") return "editor_register"
  return "login"
}

const defaultRegisterState = {
  first_name: "",
  last_name: "",
  email: "",
  password: "",
  institution: "",
  country: "Nigeria",
  phone: "",
  orcid_id: "",
  role: "author",
  expertise_area: "",
}

const passwordRequirementRules = [
  { label: "atleast 8 characters", test: (value: string) => value.length >= 8 },
  { label: "atleast 1 uppercase", test: (value: string) => /[A-Z]/.test(value) },
  { label: "atleast 1 lowercase", test: (value: string) => /[a-z]/.test(value) },
  { label: "atleast 1 number", test: (value: string) => /\d/.test(value) },
  { label: "atleast 1 special char", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
]

const editorLoginRoles = new Set(["editor", "managing_editor", "section_editor", "technical_editor", "advisory_board", "editor_in_chief", "admin"])
const adminLoginRoles = new Set(["admin"])
const authorLoginRoles = new Set(["author"])
const reviewerLoginRoles = new Set(["reviewer"])

const portalHighlights = [
  {
    title: "Unified manuscript workspace",
    body: "Manage submissions, revisions, messages, payments, and publication records from one account.",
    icon: Globe2,
  },
  {
    title: "Editorial-grade access control",
    body: "Role-specific workspaces keep authors, reviewers, editors, and administrators on the right tasks.",
    icon: ShieldCheck,
  },
  {
    title: "Traceable research journey",
    body: "Track every key step from first submission to final publication visibility and metrics.",
    icon: CheckCircle2,
  },
]

const publishingJourneySteps = [
  {
    title: "Create the author account",
    body: "Start with an author registration so the manuscript can enter the JASTI workflow with a verified identity.",
    ctaLabel: "Register author",
    to: "/register/author",
    icon: UserRound,
  },
  {
    title: "Submit the manuscript",
    body: "Sign in as the author and open the manuscript submission section directly from the dashboard.",
    ctaLabel: "Author submission",
    to: "/login/author?redirect=%2Fdashboard%3Frole%3Dauthor%26section%3Dsubmission",
    icon: FileText,
  },
  {
    title: "Provision the publishing team",
    body: "Use the admin user manager to create reviewer, editor, managing editor, section editor, technical editor, advisory board, and Editor-in-Chief accounts.",
    ctaLabel: "Open user manager",
    to: "/login/admin?redirect=%2Fdashboard%3Frole%3Dadmin%26section%3Dusers",
    icon: Users,
  },
  {
    title: "Move through editorial handling",
    body: "Section editors and editors can claim assignments, screen manuscripts, invite reviewers, and record editorial recommendations.",
    ctaLabel: "Editor assignments",
    to: "/login/editor?redirect=%2Fdashboard%3Frole%3Dsection_editor%26section%3Dassignments",
    icon: Workflow,
  },
  {
    title: "Complete review and final decision",
    body: "Reviewers submit evaluations, then the Editor-in-Chief records the final decision and moves accepted work toward scheduling and publication.",
    ctaLabel: "Final decisions",
    to: "/login/editor?redirect=%2Fdashboard%3Frole%3Deditor_in_chief%26section%3Dfinal-decisions",
    icon: CheckCircle2,
  },
] as const

type CaptchaChallenge = {
  text: string
}

type CountryApiResponse = {
  name?: {
    common?: string
  }
}

const COUNTRY_API_URL = "https://restcountries.com/v3.1/all?fields=name"
const captchaAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const captchaDigitAlphabet = "23456789"
const captchaFonts = ["Georgia", "\"Times New Roman\"", "\"Palatino Linotype\"", "\"Trebuchet MS\"", "Verdana"]

function createCaptchaChallenge(): CaptchaChallenge {
  let text = ""

  do {
    text = Array.from(
      { length: 7 },
      () => captchaAlphabet[Math.floor(Math.random() * captchaAlphabet.length)],
    ).join("")
  } while (
    text.split("").filter((character) => captchaDigitAlphabet.includes(character)).length < 2
  )

  return { text }
}

function resolveErrorMessage(error: unknown, fallback: string) {
  return resolveApiErrorMessage(error, fallback)
}

export default function PortalApp({ onAuthenticated, page = "portal" }: PortalAppProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { settings } = useJournalSettings()
  const isDedicatedAuthorPage = page === "author_registration"
  const isDedicatedReviewerPage = page === "reviewer_registration"
  const isDedicatedEditorPage = page === "editor_registration"
  const isDedicatedAuthorLoginPage = page === "author_login"
  const isDedicatedReviewerLoginPage = page === "reviewer_login"
  const isDedicatedEditorLoginPage = page === "editor_login"
  const isDedicatedAdminLoginPage = page === "admin_login"
  const [mode, setMode] = React.useState<PortalMode>(() => resolveModeForPage(page))
  const [submitting, setSubmitting] = React.useState(false)
  const [loginForm, setLoginForm] = React.useState({ email: "", password: "" })
  const [registerForm, setRegisterForm] = React.useState(defaultRegisterState)
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [captcha, setCaptcha] = React.useState<CaptchaChallenge>(() => createCaptchaChallenge())
  const [captchaInput, setCaptchaInput] = React.useState("")
  const [showLoginPassword, setShowLoginPassword] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)
  const [registerPasswordFocused, setRegisterPasswordFocused] = React.useState(false)
  const [countryOptions, setCountryOptions] = React.useState<string[]>(["Nigeria"])
  const [countriesLoading, setCountriesLoading] = React.useState(true)
  const [countryLookupFailed, setCountryLookupFailed] = React.useState(false)
  const captchaCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const [registrationComplete, setRegistrationComplete] = React.useState(false)
  const [registrationAccountType, setRegistrationAccountType] = React.useState<"author" | "editor">("editor")
  const [loginError, setLoginError] = React.useState("")
  const [verificationMessage, setVerificationMessage] = React.useState("")
  const [passwordResetMessage, setPasswordResetMessage] = React.useState("")
  const [passwordResetRequestEmail, setPasswordResetRequestEmail] = React.useState("")
  const [resetPasswordForm, setResetPasswordForm] = React.useState({ email: "", token: "", password: "", confirm_password: "" })
  const [resendingVerification, setResendingVerification] = React.useState(false)
  const [pendingVerification, setPendingVerification] = React.useState<VerificationMeta & { email?: string }>({})
  const isCaptchaValid = captchaInput.trim().toUpperCase() === captcha.text
  const passwordsMatch = registerForm.password === confirmPassword
  const passwordRequirementStates = passwordRequirementRules.map((rule) => ({
    label: rule.label,
    met: rule.test(registerForm.password),
  }))
  const shouldShowRegisterPasswordChecks = registerPasswordFocused || registerForm.password.length > 0
  const isPasswordLengthValid = registerForm.password.length >= 8
  const isRegisterPasswordStrong = passwordRequirementStates.every((rule) => rule.met)
  const resetPasswordsMatch = resetPasswordForm.password === resetPasswordForm.confirm_password
  const isResetPasswordLengthValid = resetPasswordForm.password.length >= 8
  const isRegisterReady = isCaptchaValid && passwordsMatch && isRegisterPasswordStrong
  const requestedRedirect = searchParams.get("redirect")?.trim() ?? ""
  const safeRedirect = requestedRedirect.startsWith("/dashboard") ? requestedRedirect : "/dashboard"
  const loginReturnPath = isDedicatedEditorPage
    ? "/login/editor"
    : isDedicatedReviewerPage
      ? "/login/reviewer"
      : isDedicatedAuthorPage
        ? "/login/author"
        : isDedicatedEditorLoginPage
          ? "/login/editor"
          : isDedicatedReviewerLoginPage
            ? "/login/reviewer"
            : isDedicatedAuthorLoginPage
              ? "/login/author"
              : isDedicatedAdminLoginPage
                ? "/login/admin"
                : "/login/author"

  const returnToLogin = React.useCallback(() => {
    if (page === "portal") {
      setMode("login")
      return
    }

    if (page === "author_login") {
      setMode("login")
      navigate("/login/author")
      return
    }

    if (page === "reviewer_login") {
      setMode("login")
      navigate("/login/reviewer")
      return
    }

    if (page === "editor_login") {
      setMode("login")
      navigate("/login/editor")
      return
    }

    if (page === "admin_login") {
      setMode("login")
      navigate("/login/admin")
      return
    }

    if (page === "editor_registration") {
      navigate("/login/editor")
      return
    }

    if (page === "author_registration") {
      navigate("/login/author")
      return
    }

    if (page === "reviewer_registration") {
      navigate("/login/reviewer")
      return
    }

    navigate("/login/author")
  }, [navigate, page])

  const verificationExpiryLabel = React.useMemo(() => {
    const expiresAt = pendingVerification.expires_at
    if (!expiresAt) return ""
    const diff = new Date(expiresAt).getTime() - Date.now()
    if (Number.isNaN(diff)) return ""
    if (diff <= 0) return "The current verification link has expired."
    const totalMinutes = Math.ceil(diff / 60000)
    if (totalMinutes < 60) return `Current verification link expires in ${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}.`
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `Current verification link expires in ${hours}h ${minutes}m.`
  }, [pendingVerification.expires_at])

  React.useEffect(() => {
    const canvas = captchaCanvasRef.current
    if (!canvas) return

    const context = canvas.getContext("2d")
    if (!context) return

    context.clearRect(0, 0, canvas.width, canvas.height)
    const backgroundGradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
    backgroundGradient.addColorStop(0, "#f8fcff")
    backgroundGradient.addColorStop(0.55, "#edf6fb")
    backgroundGradient.addColorStop(1, "#dcecf6")
    context.fillStyle = backgroundGradient
    context.fillRect(0, 0, canvas.width, canvas.height)

    for (let index = 0; index < 20; index += 1) {
      context.fillStyle = `rgba(8, 59, 92, ${0.06 + Math.random() * 0.06})`
      context.beginPath()
      context.arc(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        0.7 + Math.random() * 1.6,
        0,
        Math.PI * 2,
      )
      context.fill()
    }

    for (let index = 0; index < 6; index += 1) {
      context.strokeStyle = `rgba(11, 111, 164, ${0.16 + Math.random() * 0.08})`
      context.lineWidth = 1 + Math.random() * 1.5
      context.beginPath()
      context.moveTo(0, 8 + index * 7 + Math.random() * 8)
      context.bezierCurveTo(
        canvas.width * 0.25,
        Math.random() * canvas.height,
        canvas.width * 0.75,
        Math.random() * canvas.height,
        canvas.width,
        10 + index * 6 + Math.random() * 10,
      )
      context.stroke()
    }

    context.textAlign = "center"
    context.textBaseline = "middle"

    captcha.text.split("").forEach((character, index) => {
      const spacing = canvas.width / (captcha.text.length + 1)
      const x = spacing * (index + 1) + (Math.random() * 6 - 3)
      const y = canvas.height / 2 + Math.sin((index + 1) * 1.2) * 5 + (Math.random() * 8 - 4)
      const rotation = Math.random() * 0.7 - 0.35
      const scaleX = 0.88 + Math.random() * 0.22
      const scaleY = 0.82 + Math.random() * 0.28
      const shear = Math.random() * 0.35 - 0.175
      const fontSize = 24 + Math.floor(Math.random() * 6)
      const fontFamily = captchaFonts[Math.floor(Math.random() * captchaFonts.length)]
      const fillShade = 16 + Math.floor(Math.random() * 20)

      context.save()
      context.translate(x, y)
      context.transform(1, 0, shear, 1, 0, 0)
      context.rotate(rotation)
      context.scale(scaleX, scaleY)
      context.font = `700 ${fontSize}px ${fontFamily}`
      context.lineWidth = 1.8
      context.strokeStyle = "rgba(255, 255, 255, 0.78)"
      context.fillStyle = `hsl(202, 70%, ${fillShade}%)`
      context.strokeText(character, 0, 0)
      context.fillText(character, 0, 0)
      context.restore()
    })

    for (let index = 0; index < 2; index += 1) {
      context.strokeStyle = `rgba(255, 255, 255, ${0.34 + index * 0.12})`
      context.lineWidth = 1.4 + index * 0.7
      context.beginPath()
      context.moveTo(0, canvas.height * (0.24 + index * 0.28))
      context.bezierCurveTo(
        canvas.width * 0.2,
        canvas.height * (0.86 - index * 0.12),
        canvas.width * 0.7,
        canvas.height * (0.08 + index * 0.18),
        canvas.width,
        canvas.height * (0.66 - index * 0.08),
      )
      context.stroke()
    }
  }, [captcha])

  React.useEffect(() => {
    if (mode === "register") {
      setCaptcha(createCaptchaChallenge())
      setCaptchaInput("")
      setConfirmPassword("")
      setRegistrationComplete(false)
      setRegisterForm((prev) => ({
        ...prev,
        role: isDedicatedReviewerPage ? "reviewer" : "author",
        expertise_area: isDedicatedReviewerPage ? prev.expertise_area : "",
      }))
    }
  }, [isDedicatedReviewerPage, mode])

  React.useEffect(() => {
    setMode(resolveModeForPage(page))

    if (page === "author_registration") {
      setRegistrationAccountType("author")
      setRegisterForm((prev) => ({ ...prev, role: "author", expertise_area: "" }))
      return
    }

    if (page === "reviewer_registration") {
      setRegistrationAccountType("author")
      setRegisterForm((prev) => ({ ...prev, role: "reviewer" }))
      return
    }

    if (page === "editor_registration") {
      setRegistrationAccountType("editor")
      return
    }
  }, [page])

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
        setRegisterForm((prev) => {
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
    const params = new URLSearchParams(window.location.search)
    const verification = params.get("verification")
    const resetPasswordFlag = params.get("reset_password")
    const resetToken = params.get("token") ?? ""
    const resetEmail = params.get("email") ?? ""
    let shouldRewriteHistory = false

    if (verification) {
      if (verification === "success") {
        setVerificationMessage("Your email address has been verified. You can sign in now.")
        setMode("login")
      } else if (verification === "already_verified") {
        setVerificationMessage("This email address has already been verified. You can sign in.")
        setMode("login")
      } else if (verification === "invalid") {
        setVerificationMessage("The verification link is invalid or has expired.")
        setMode("login")
      } else if (verification === "missing_schema") {
        setVerificationMessage("Email verification is not configured yet. Run the email verification migration first.")
        setMode("login")
      }
      params.delete("verification")
      shouldRewriteHistory = true
    }

    if (resetPasswordFlag === "1") {
      if (resetToken && resetEmail) {
        setResetPasswordForm((prev) => ({
          ...prev,
          email: resetEmail,
          token: resetToken,
        }))
        setPasswordResetRequestEmail(resetEmail)
        setPasswordResetMessage("")
        setMode("reset_password")
      } else {
        setResetPasswordForm({ email: "", token: "", password: "", confirm_password: "" })
        setPasswordResetRequestEmail(resetEmail)
        setPasswordResetMessage("This reset link is invalid or incomplete. Request a new password reset email.")
        setMode("forgot_password")
        params.delete("reset_password")
        params.delete("token")
        params.delete("email")
        shouldRewriteHistory = true
      }
    }

    if (shouldRewriteHistory) {
      const nextQuery = params.toString()
      window.history.replaceState({}, document.title, `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`)
    }
  }, [])

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setLoginError("")
    try {
      const response = await loginAccount(loginForm)
      const responseRoles = Array.isArray(response.user?.roles) ? response.user.roles.map((role) => String(role)) : []

      if (isDedicatedAuthorLoginPage && !responseRoles.some((role) => authorLoginRoles.has(role))) {
        await logoutAccount()
        if (responseRoles.some((role) => reviewerLoginRoles.has(role))) {
          throw new Error("This account does not belong on the Author Login page. Use Reviewer Login instead.")
        }
        throw new Error("This account does not belong on the Author Login page. Use Editor Login instead.")
      }

      if (isDedicatedReviewerLoginPage && !responseRoles.some((role) => reviewerLoginRoles.has(role))) {
        await logoutAccount()
        if (responseRoles.some((role) => authorLoginRoles.has(role))) {
          throw new Error("This account does not belong on the Reviewer Login page. Use Author Login instead.")
        }
        throw new Error("This account does not belong on the Reviewer Login page. Use Editor Login instead.")
      }

      if (isDedicatedEditorLoginPage && !responseRoles.some((role) => editorLoginRoles.has(role))) {
        await logoutAccount()
        if (responseRoles.some((role) => reviewerLoginRoles.has(role))) {
          throw new Error("This account does not belong on the Editor Login page. Use Reviewer Login instead.")
        }
        throw new Error("This account does not belong on the Editor Login page. Use Author Login instead.")
      }

      if (isDedicatedAdminLoginPage && !responseRoles.some((role) => adminLoginRoles.has(role))) {
        await logoutAccount()
        if (responseRoles.some((role) => reviewerLoginRoles.has(role))) {
          throw new Error("This account does not belong on the Admin Login page. Use Reviewer Login instead.")
        }
        if (responseRoles.some((role) => authorLoginRoles.has(role))) {
          throw new Error("This account does not belong on the Admin Login page. Use Author Login instead.")
        }
        throw new Error("This account does not belong on the Admin Login page. Use Editor Login instead.")
      }

      await getSession()
      toast.success(response.message)
      await onAuthenticated()
      navigate(safeRedirect)
    } catch (error) {
      const message = resolveErrorMessage(error, "Unable to sign in.")
      setLoginError(message)
      if (isAxiosError(error)) {
        const payload = error.response?.data as { verification?: VerificationMeta } | undefined
        if (payload?.verification) {
          setPendingVerification({ ...payload.verification, email: loginForm.email.trim() })
          if (message.toLowerCase().includes("verify your email")) {
            setMode("verification")
          }
        }
      }
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isCaptchaValid) {
      toast.error("Enter the correct CAPTCHA answer before registering.")
      return
    }
    if (!isRegisterPasswordStrong) {
      toast.error("Password must include at least 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special char.")
      return
    }
    if (!passwordsMatch) {
      toast.error("Passwords do not match.")
      return
    }
    setSubmitting(true)
    try {
      const response = await registerAccount(registerForm)
      if (response.verification?.email_sent === false) {
        toast.warning(response.message)
      } else {
        toast.success(response.message)
      }
      setPendingVerification({ ...(response.verification ?? {}), email: registerForm.email.trim() })
      setRegisterForm(defaultRegisterState)
      setConfirmPassword("")
      setCaptcha(createCaptchaChallenge())
      setCaptchaInput("")
      setRegistrationComplete(true)
    } catch (error) {
      toast.error(resolveErrorMessage(error, "Unable to create account."))
    } finally {
      setSubmitting(false)
    }
  }

  const handleResendVerification = async () => {
    const email = pendingVerification.email?.trim() || loginForm.email.trim()
    if (!email) {
      toast.error("Enter your email address first.")
      return
    }
    setResendingVerification(true)
    try {
      const response = await resendVerificationEmail({ email })
      setVerificationMessage(response.message)
      setLoginError("")
      setPendingVerification({ ...(response.verification ?? {}), email })
      toast.success(response.message)
    } catch (error) {
      const message = resolveErrorMessage(error, "Unable to resend verification email.")
      toast.error(message)
    } finally {
      setResendingVerification(false)
    }
  }

  const handleRequestPasswordReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const email = passwordResetRequestEmail.trim().toLowerCase()
    if (!email) {
      toast.error("Enter your email address first.")
      return
    }

    setSubmitting(true)
    try {
      const response = await requestPasswordReset({ email })
      setPasswordResetMessage(response.message)
      toast.success(response.message)
    } catch (error) {
      const message = resolveErrorMessage(error, "Unable to send password reset email.")
      setPasswordResetMessage(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!resetPasswordsMatch) {
      toast.error("Passwords do not match.")
      return
    }
    if (!isResetPasswordLengthValid) {
      toast.error("Password must be at least 8 characters long.")
      return
    }

    setSubmitting(true)
    try {
      const response = await resetPassword({
        email: resetPasswordForm.email.trim().toLowerCase(),
        token: resetPasswordForm.token.trim(),
        password: resetPasswordForm.password,
      })
      setPasswordResetMessage(response.message)
      setLoginForm({ email: resetPasswordForm.email.trim().toLowerCase(), password: "" })
      setResetPasswordForm({ email: "", token: "", password: "", confirm_password: "" })
      setMode("login")
      toast.success(response.message)
      const params = new URLSearchParams(window.location.search)
      params.delete("reset_password")
      params.delete("token")
      params.delete("email")
      const nextQuery = params.toString()
      window.history.replaceState({}, document.title, `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`)
    } catch (error) {
      const message = resolveErrorMessage(error, "Unable to reset password.")
      setPasswordResetMessage(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const resetLoginVerificationState = () => {
    setMode("login")
    setLoginError("")
    setVerificationMessage("")
    setPasswordResetMessage("")
    setPendingVerification({})
    setLoginForm((prev) => ({ ...prev, password: "" }))
    setResetPasswordForm({ email: "", token: "", password: "", confirm_password: "" })
    const params = new URLSearchParams(window.location.search)
    params.delete("reset_password")
    params.delete("token")
    params.delete("email")
    params.delete("verification")
    const nextQuery = params.toString()
    window.history.replaceState({}, document.title, `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`)
  }

  const logoSrc = settings.logo_path ? resolveApiAssetUrl(settings.logo_path) : logoImage
  const isLoginMode = mode === "login"
  const showPortalOverview = mode === "verification"
  const isWideAuthForm = (mode === "register" || mode === "editor_register") && !registrationComplete
  const authHeading = registrationComplete
    ? {
        title: "Your account is ready",
        description: "Check your email to verify the account before signing in.",
      }
    : isDedicatedAuthorPage
      ? {
          title: "Registration",
          description: "Create your JASTI author account to submit and track manuscripts.",
        }
    : isDedicatedReviewerPage
      ? {
          title: "Registration",
          description: "Create your JASTI reviewer account to manage invitations, reviews, and assignments.",
        }
    : isDedicatedEditorPage
      ? {
          title: "Registration",
          description: "Apply to join the JASTI Editorial team.",
        }
    : isDedicatedAdminLoginPage
      ? {
          title: "Welcome",
          description: "Sign in to manage JASTI administration, users, settings, and editorial operations.",
        }
    : isDedicatedAuthorLoginPage
      ? {
          title: "Welcome",
          description: "Sign in to manage your author workspace, submissions, and publication tracking.",
        }
    : isDedicatedReviewerLoginPage
      ? {
          title: "Welcome",
          description: "Sign in to manage your reviewer workspace, invitations, assigned manuscripts, and review forms.",
        }
    : isDedicatedEditorLoginPage
      ? {
          title: "Welcome",
          description: "Sign in to access editorial assignments, reviews, and decision tools.",
        }
    : mode === "login"
      ? {
          title: "Welcome",
          description: "Sign in to access your JASTI workspace",
        }
      : mode === "register"
        ? {
            title: "Create your account",
            description: "Register as an author or reviewer.",
          }
      : mode === "editor_register"
          ? {
              title: registrationAccountType === "author" ? "Author registration" : "Editor registration",
              description:
                registrationAccountType === "author"
                  ? "Create an JASTI author account to submit and track manuscripts."
                  : "Apply to join the JASTI editorial team.",
            }
        : mode === "verification"
          ? {
              title: "Verify your account",
              description: "Activate your account from the link sent to your email.",
            }
          : mode === "forgot_password"
            ? {
                title: "Forgot password",
                description: "Enter your email to receive a reset link.",
              }
            : {
                title: "Reset password",
                description: "Choose a new password for your account.",
              }
  const loginFieldClassName = cn(
    "h-14 rounded-[1.2rem] border border-white/80 bg-white/86 pl-12 text-[15px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_14px_34px_rgba(15,23,42,0.08)] placeholder:text-slate-400 backdrop-blur hover:border-[#c8ddeb] focus-visible:border-[#0b6fa4]/45 focus-visible:ring-[#0b6fa4]/14",
    loginError ? "border-red-200/90 focus-visible:border-red-400 focus-visible:ring-red-100" : ""
  )
  const isForgotPasswordMode = mode === "forgot_password"
  const isResetPasswordMode = mode === "reset_password"
  const isEditorRegisterMode = mode === "editor_register"
  const isRegisterFormMode = mode === "register" && !registrationComplete
  const isSampleAuthCardMode = isForgotPasswordMode || isResetPasswordMode || isRegisterFormMode || isEditorRegisterMode
  const compactAuthFieldClassName =
    "h-10 rounded-[0.85rem] border border-slate-200/80 bg-white/94 text-sm text-slate-900 shadow-[0_8px_16px_rgba(15,23,42,0.04)]"
  const compactAuthSelectClassName =
    "h-10 w-full rounded-[0.85rem] border border-slate-200/90 bg-white/94 px-4 text-sm text-slate-900 shadow-[0_8px_16px_rgba(15,23,42,0.04)]"
  const authBackLinkLabel = "Home"
  const authBackLinkClassName =
    "inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/86 px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-[0_10px_22px_rgba(15,23,42,0.06)] backdrop-blur transition hover:border-[#bfdbf0] hover:text-[#0b6fa4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b6fa4]/20"
  const authEyebrowClassName = "text-[11px] font-semibold uppercase tracking-[0.32em] text-[#7e95ad] sm:text-xs"
  const authLogoFrameClassName =
    "flex h-[4rem] w-[6rem] items-center justify-center rounded-[1.25rem] border border-white/80 bg-white/88 shadow-[0_16px_32px_rgba(15,23,42,0.08)] sm:h-[4.55rem] sm:w-[7rem]"
  const authLogoImageClassName = "h-[2.9rem] w-[4.9rem] object-fill sm:h-[3.3rem] sm:w-[5.8rem]"
  const authInputIconWrapClassName =
    "pointer-events-none absolute left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[0.85rem] border border-slate-200/90 bg-white shadow-[0_8px_16px_rgba(15,23,42,0.08)]"
  const authInputIconClassName = "h-4 w-4 text-[#5b728b]"
  const loginAssistiveIds =
    [
      verificationMessage || passwordResetMessage ? "portal-login-status" : "",
      loginError ? "portal-login-error" : "",
    ]
      .filter(Boolean)
      .join(" ") || undefined

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-900">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_24%),radial-gradient(circle_at_top_right,rgba(45,212,191,0.14),transparent_22%),linear-gradient(180deg,#f8fbff_0%,#f6fbfb_46%,#edf4f8_100%)]" />
      <div className="pointer-events-none absolute left-[-7rem] top-[8rem] -z-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.22),transparent_70%)] blur-3xl motion-safe:animate-[float-soft_16s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute right-[-8rem] top-[6rem] -z-10 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(45,212,191,0.2),transparent_68%)] blur-3xl motion-safe:animate-[float-soft_18s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute bottom-[-8rem] left-1/2 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(191,219,254,0.2),transparent_70%)] blur-3xl" />

      <main
        className={cn(
          "relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8",
          isLoginMode
            ? "flex min-h-screen items-center justify-center py-10 sm:py-12 lg:py-16"
            : "py-8 lg:py-10"
        )}
      >
        <div
          className={cn(
            isLoginMode
              ? "w-full max-w-[31rem]"
              : showPortalOverview
              ? "grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start xl:grid-cols-[0.95fr_0.8fr]"
              : "mx-auto max-w-4xl"
          )}
        >
          {showPortalOverview ? (
            <section className="order-2 surface-panel-strong relative overflow-hidden p-6 sm:p-8 lg:order-1 lg:p-10">
              <div className="absolute right-[-4rem] top-[-4rem] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(48,169,215,0.28),transparent_70%)] blur-3xl" />
              <div className="absolute bottom-[-3rem] left-[-2rem] h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(31,107,92,0.2),transparent_70%)] blur-3xl" />
              <div className="relative">
                <span className="eyebrow">JASTI workspace</span>
                <h1 className="display-page mt-5 max-w-xl text-slate-950">
                  {settings.track_research_title || "Track Your Research"}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                  {settings.track_research_body ||
                    "Monitor submissions, revisions, editorial decisions, metrics, and journal communication through the JASTI portal."}
                </p>
                <div className="mt-8 grid gap-4">
                  {portalHighlights.map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.title} className="surface-muted flex items-start gap-4 p-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-jostum-100 text-jostum-700">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-base font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-1 text-sm leading-7 text-slate-600">{item.body}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <div className="surface-muted p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Portal roles</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">Author, reviewer, editor, admin</p>
                  </div>
                  <div className="surface-muted p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Core functions</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">Submission, review, decisions, metrics</p>
                  </div>
                  <div className="surface-muted p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Access model</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">Secure session and verified email access</p>
                  </div>
                </div>
                <div className="mt-8 rounded-[1.7rem] border border-slate-200/80 bg-white/80 p-5 shadow-[0_18px_34px_rgba(15,23,42,0.05)] backdrop-blur">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0b6fa4]">Guided publishing path</p>
                      <h2 className="mt-2 text-xl font-semibold text-slate-950">Walk a manuscript from account creation to publication</h2>
                    </div>
                    <p className="max-w-md text-sm leading-6 text-slate-500">Each step opens the right registration page or signs into the dashboard with the relevant role and section preselected.</p>
                  </div>
                  <div className="mt-5 grid gap-3">
                    {publishingJourneySteps.map((step, index) => {
                      const Icon = step.icon
                      return (
                        <div key={step.title} className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex items-start gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(11,111,164,0.14),rgba(31,107,92,0.18))] text-jostum-700">
                                <Icon className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Step {index + 1}</p>
                                <h3 className="mt-1 text-base font-semibold text-slate-900">{step.title}</h3>
                                <p className="mt-1 text-sm leading-6 text-slate-600">{step.body}</p>
                              </div>
                            </div>
                            <Link
                              to={step.to}
                              className="inline-flex h-10 items-center justify-center rounded-xl border border-[#0b6fa4]/20 bg-white px-4 text-sm font-semibold text-[#0b6fa4] shadow-sm transition hover:border-[#0b6fa4]/35 hover:bg-[#f4fbff]"
                            >
                              {step.ctaLabel}
                            </Link>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {isLoginMode ? (
            <section className="relative mx-auto w-full max-w-[27rem] overflow-visible motion-safe:animate-[fade-up_520ms_ease-out]">
              <div className="pointer-events-none absolute -right-24 bottom-[-4.5rem] -z-10 hidden h-72 w-72 lg:block">
                <div className="absolute bottom-0 right-0 h-52 w-52 rotate-[-18deg] rounded-[40%_60%_58%_42%/46%_42%_58%_54%] bg-[linear-gradient(135deg,rgba(8,56,130,0.96),rgba(22,170,226,0.82))] shadow-[0_26px_60px_rgba(11,111,164,0.3)]" />
                <div className="absolute bottom-6 right-10 h-40 w-40 rotate-[-22deg] rounded-[46%_54%_32%_68%/54%_34%_66%_46%] border border-white/30 bg-[linear-gradient(135deg,rgba(46,206,220,0.9),rgba(23,108,222,0.2))] opacity-90" />
                <div className="absolute bottom-12 right-20 h-16 w-16 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.98),rgba(165,243,252,0.58),transparent_72%)] blur-[1px]" />
                <div className="absolute bottom-24 right-12 h-2 w-2 rounded-full bg-white/90 shadow-[0_0_0_7px_rgba(255,255,255,0.1)]" />
                <div className="absolute bottom-16 right-28 h-1.5 w-1.5 rounded-full bg-cyan-100/90 shadow-[0_0_0_6px_rgba(165,243,252,0.12)]" />
              </div>

              <div className="relative overflow-hidden rounded-[1.9rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(247,250,252,0.74))] px-5 py-6 shadow-[0_30px_80px_rgba(15,23,42,0.14)] backdrop-blur-2xl sm:px-7 sm:py-7">
                <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(48,169,215,0.55),transparent)]" />
                <div className="pointer-events-none absolute left-[-3rem] top-[-2rem] h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.18),transparent_70%)] blur-2xl" />

	                <div className="relative mx-auto max-w-sm text-center">
	                  <div className="relative mb-2 min-h-8 sm:mb-3">
	                    <Link
	                      to="/"
	                      className={cn(authBackLinkClassName, "absolute left-0 top-0 z-10")}
	                    >
	                      <ArrowLeft className="h-3 w-3" />
	                      {authBackLinkLabel}
	                    </Link>
	                    <p className={cn(authEyebrowClassName, "absolute inset-x-0 top-1/2 -translate-y-1/2 text-center pointer-events-none")}>JASTI PORTAL</p>
	                  </div>

		                  <div className="mt-2 flex justify-center">
                    <div className={authLogoFrameClassName}>
                      <img src={logoSrc} alt={settings.journal_name} className={authLogoImageClassName} />
                    </div>
                  </div>

		                  <h1 className="mt-3 font-display text-[clamp(1.9rem,5vw,2.5rem)] leading-[1.04] tracking-[-0.04em] text-[#1b3b63]">
                    {authHeading.title}
                  </h1>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">{authHeading.description}</p>

                  <form className="mt-5 space-y-3.5 text-left" onSubmit={handleLogin} aria-busy={submitting}>
                    <div
                      className="space-y-2"
                      aria-live="polite"
                      id={verificationMessage || passwordResetMessage ? "portal-login-status" : undefined}
                    >
                      {verificationMessage ? (
                        <div className="rounded-[1rem] border border-emerald-200/90 bg-emerald-50/90 px-4 py-3 text-sm font-medium text-emerald-700 shadow-[0_8px_20px_rgba(16,185,129,0.08)]">
                          {verificationMessage}
                        </div>
                      ) : null}
                      {passwordResetMessage ? (
                        <div className="rounded-[1rem] border border-emerald-200/90 bg-emerald-50/90 px-4 py-3 text-sm font-medium text-emerald-700 shadow-[0_8px_20px_rgba(16,185,129,0.08)]">
                          {passwordResetMessage}
                        </div>
                      ) : null}
                      {loginError ? (
                        <div id="portal-login-error" role="alert" className="rounded-[1rem] border border-red-200/90 bg-red-50/95 px-4 py-3 text-sm font-medium text-red-700 shadow-[0_8px_20px_rgba(239,68,68,0.08)]">
                          {loginError}
                        </div>
                      ) : null}
                    </div>

	                  <div className="space-y-1.5 rounded-[1.15rem] border border-white/85 bg-white/60 p-2 shadow-[0_18px_34px_rgba(15,23,42,0.06)] backdrop-blur">
	                      <Label htmlFor="login-email" className="sr-only">Email address</Label>
	                      <div className="relative">
	                        <span className={authInputIconWrapClassName}>
	                          <Mail className={cn(authInputIconClassName, loginError ? "text-red-500" : "")} />
	                        </span>
                        <Input
                          id="login-email"
                          type="email"
                          autoComplete="email"
                          spellCheck={false}
                          placeholder="Email"
                          value={loginForm.email}
                          aria-invalid={Boolean(loginError)}
                          aria-describedby={loginAssistiveIds}
                          onChange={(event) => {
                            setLoginError("")
                            setVerificationMessage("")
                            setPendingVerification({})
                            setLoginForm((prev) => ({ ...prev, email: event.target.value }))
                          }}
	                          className={cn(loginFieldClassName, "relative h-10 rounded-[0.85rem] border-slate-200/80 bg-white/94 pl-12 text-sm shadow-[0_8px_16px_rgba(15,23,42,0.04)]")}
                          required
                        />
                      </div>

                      <Label htmlFor="login-password" className="sr-only">Password</Label>
                      <div className="relative">
                        <span className={authInputIconWrapClassName}>
                          <LockKeyhole className={cn(authInputIconClassName, loginError ? "text-red-500" : "")} />
                        </span>
                        <Input
                          id="login-password"
                          type={showLoginPassword ? "text" : "password"}
                          autoComplete="current-password"
                          placeholder="Password"
                          value={loginForm.password}
                          aria-invalid={Boolean(loginError)}
                          aria-describedby={loginAssistiveIds}
                          onChange={(event) => {
                            setLoginError("")
                            setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                          }}
	                          className={cn(loginFieldClassName, "relative h-10 rounded-[0.85rem] border-slate-200/80 bg-white/94 pl-12 pr-14 text-sm shadow-[0_8px_16px_rgba(15,23,42,0.04)]")}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100/80 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b6fa4]/25"
                          aria-label={showLoginPassword ? "Hide password" : "Show password"}
                          aria-pressed={showLoginPassword}
                        >
                          {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordResetRequestEmail(loginForm.email.trim())
                          setPasswordResetMessage("")
                          setMode("forgot_password")
                        }}
                        className="text-[11px] font-medium text-[#0b6fa4] underline-offset-4 hover:text-[#084f76] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b6fa4]/20"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <Button
                      type="submit"
                      className="h-[46px] w-full rounded-[0.95rem] bg-[linear-gradient(90deg,#183da8_0%,#165dd0_55%,#18d4cf_100%)] text-[15px] font-semibold shadow-[0_18px_34px_rgba(24,61,168,0.24)] hover:-translate-y-0.5 hover:shadow-[0_22px_40px_rgba(24,61,168,0.28)]"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        "Sign In"
                      )}
                    </Button>

                    {verificationMessage.toLowerCase().includes("verification") ? (
                      <div className="rounded-[1rem] border border-slate-200/90 bg-white/84 px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-700">Did not receive the verification email?</p>
                            {verificationExpiryLabel ? <p className="mt-1 text-xs text-slate-500">{verificationExpiryLabel}</p> : null}
                          </div>
                          <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={handleResendVerification} disabled={resendingVerification}>
                            {resendingVerification ? "Sending..." : "Resend email"}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {isDedicatedAdminLoginPage ? (
                      <p className="pt-0.5 text-center text-[12px] text-slate-500">
                        Admin access is provisioned internally by JASTI.
                      </p>
                    ) : (
                      <p className="pt-0.5 text-center text-[12px] text-slate-500">
                        {isDedicatedEditorLoginPage ? "Need an editor account? " : isDedicatedReviewerLoginPage ? "Need a reviewer account? " : isDedicatedAuthorLoginPage ? "Need an author account? " : "Need an account? "}
                        <Link
                          to={isDedicatedEditorLoginPage ? "/register/editor" : isDedicatedReviewerLoginPage ? "/register/reviewer" : "/register/author"}
                          className="font-semibold text-[#0b6fa4] underline-offset-4 hover:text-[#084f76] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b6fa4]/20"
                        >
                          {isDedicatedEditorLoginPage ? "Register as Editor" : isDedicatedReviewerLoginPage ? "Register as Reviewer" : "Register as Author"}
                        </Link>
                      </p>
                    )}

                  </form>
                </div>
              </div>
            </section>
          ) : (
            <section
              className={cn(
                isSampleAuthCardMode
                  ? "relative w-full overflow-hidden rounded-[1.9rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(247,250,252,0.74))] px-5 py-6 shadow-[0_30px_80px_rgba(15,23,42,0.14)] backdrop-blur-2xl sm:px-7 sm:py-7"
                  : "surface-panel-strong w-full overflow-hidden p-5 sm:p-8",
                showPortalOverview ? "order-1 lg:order-2 lg:self-center" : "mx-auto",
                showPortalOverview
                  ? ""
                  : isSampleAuthCardMode
                    ? (isRegisterFormMode || mode === "editor_register"
                      ? "max-w-7xl"
                      : "max-w-[27rem]")
                    : isWideAuthForm
                      ? (mode === "editor_register" ? "max-w-7xl" : "max-w-6xl")
                      : "max-w-xl"
              )}
            >
              {isSampleAuthCardMode ? (
                <>
                  <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(48,169,215,0.55),transparent)]" />
                  <div className="pointer-events-none absolute left-[-3rem] top-[-2rem] h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.18),transparent_70%)] blur-2xl" />
                </>
              ) : null}
              <div className={cn("mx-auto w-full", mode === "editor_register" ? "max-w-7xl" : "max-w-3xl")}>
	                {isSampleAuthCardMode ? (
		                  <div className={cn("relative text-center", isRegisterFormMode ? "mx-auto max-w-2xl" : "mx-auto max-w-sm")}>
		                    <div className="relative mb-2 min-h-8 sm:mb-3">
		                      <Link
		                        to="/"
		                        className={cn(authBackLinkClassName, "absolute left-0 top-0 z-10")}
		                      >
		                        <ArrowLeft className="h-3 w-3" />
		                        {authBackLinkLabel}
		                      </Link>
		                      <p className={cn(authEyebrowClassName, "absolute inset-x-0 top-1/2 -translate-y-1/2 text-center pointer-events-none")}>JASTI PORTAL</p>
		                    </div>
	                    <div className="mt-2 flex justify-center">
                      <div className={authLogoFrameClassName}>
                        <img src={logoSrc} alt={settings.journal_name} className={authLogoImageClassName} />
                      </div>
                    </div>
	                    <h1 className="mt-3 font-display text-[clamp(1.9rem,4.6vw,2.45rem)] leading-[1.04] tracking-[-0.04em] text-[#1b3b63]">
                      {authHeading.title}
                    </h1>
                    <p className="mx-auto mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">{authHeading.description}</p>
                  </div>
                ) : (
                  <div className="space-y-2 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0b6fa4]">JASTI portal</p>
                    <h1 className="display-card text-slate-950">{authHeading.title}</h1>
                    <p className="mx-auto max-w-2xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                      {authHeading.description}
                    </p>
                  </div>
                )}
              </div>

          {mode === "verification" ? (
            <div className="mx-auto max-w-xl space-y-6">
              <div className="rounded-3xl border border-[#bfd8e6] bg-[#f2f8fb] px-6 py-6">
                <p className="text-sm font-semibold text-[#083b5c]">This account is not verified yet.</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Use the verification link sent to your inbox to activate your JASTI workspace. If you did not receive it, send a new verification email.
                </p>
                {pendingVerification.email ? <p className="mt-3 text-sm text-slate-500">Verification email destination: {pendingVerification.email}</p> : null}
                {verificationExpiryLabel ? <p className="mt-2 text-sm text-slate-500">{verificationExpiryLabel}</p> : null}
              </div>
              <div className="flex flex-col gap-3">
                <Button type="button" className="h-11 rounded-xl text-sm font-semibold" onClick={handleResendVerification} disabled={resendingVerification}>
                  {resendingVerification ? "Sending..." : "Resend verification email"}
                </Button>
                <Button type="button" variant="outline" className="h-11 rounded-xl text-sm font-semibold" onClick={resetLoginVerificationState}>
                  Back to login page
                </Button>
              </div>
            </div>
          ) : mode === "forgot_password" ? (
            <form className="mx-auto mt-5 max-w-sm space-y-3.5 text-left" onSubmit={handleRequestPasswordReset}>
              {passwordResetMessage ? (
                <div className="rounded-[1rem] border border-emerald-200/90 bg-emerald-50/90 px-4 py-3 text-sm font-medium text-emerald-700 shadow-[0_8px_20px_rgba(16,185,129,0.08)]">
                  {passwordResetMessage}
                </div>
              ) : null}
              <div className="space-y-1.5 rounded-[1.15rem] border border-white/85 bg-white/60 p-2 shadow-[0_18px_34px_rgba(15,23,42,0.06)] backdrop-blur">
                <Label htmlFor="password-reset-email" className="sr-only">Email address</Label>
                <div className="relative">
                  <span className={authInputIconWrapClassName}>
                    <Mail className={authInputIconClassName} />
                  </span>
                  <Input
                    id="password-reset-email"
                    type="email"
                    autoComplete="email"
                    placeholder="Email"
                    value={passwordResetRequestEmail}
                    onChange={(event) => { setPasswordResetMessage(""); setPasswordResetRequestEmail(event.target.value) }}
                    className={cn(compactAuthFieldClassName, "pl-12")}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="h-[46px] w-full rounded-[0.95rem] bg-[linear-gradient(90deg,#183da8_0%,#165dd0_55%,#18d4cf_100%)] text-[15px] font-semibold shadow-[0_18px_34px_rgba(24,61,168,0.24)] hover:-translate-y-0.5 hover:shadow-[0_22px_40px_rgba(24,61,168,0.28)]"
                disabled={submitting}
              >
                {submitting ? "Sending reset link..." : "Send reset link"}
              </Button>

              <p className="text-center text-[12px] text-slate-500">
                <button type="button" onClick={resetLoginVerificationState} className="font-semibold text-[#0b6fa4] hover:underline">
                  Back to login
                </button>
              </p>
            </form>
          ) : mode === "reset_password" ? (
            <form className="mx-auto mt-5 max-w-sm space-y-3.5 text-left" onSubmit={handleResetPassword}>
              {passwordResetMessage ? (
                <div className={cn("rounded-[1rem] px-4 py-3 text-sm font-medium shadow-[0_8px_20px_rgba(15,23,42,0.06)]", passwordResetMessage.toLowerCase().includes("successful") ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-red-200 bg-red-50 text-red-700")}>
                  {passwordResetMessage}
                </div>
              ) : null}
              <div className="space-y-1.5 rounded-[1.15rem] border border-white/85 bg-white/60 p-2 shadow-[0_18px_34px_rgba(15,23,42,0.06)] backdrop-blur">
                <Label htmlFor="reset-email" className="sr-only">Email address</Label>
                <div className="relative">
                  <span className={authInputIconWrapClassName}>
                    <Mail className={authInputIconClassName} />
                  </span>
                  <Input id="reset-email" type="email" value={resetPasswordForm.email} onChange={(event) => setResetPasswordForm((prev) => ({ ...prev, email: event.target.value }))} className={cn(compactAuthFieldClassName, "pl-12")} placeholder="Email" required />
                </div>
                <Label htmlFor="reset-password" className="sr-only">New password</Label>
                <div className="relative">
                  <span className={authInputIconWrapClassName}>
                    <LockKeyhole className={authInputIconClassName} />
                  </span>
                  <Input id="reset-password" type="password" value={resetPasswordForm.password} onChange={(event) => { setPasswordResetMessage(""); setResetPasswordForm((prev) => ({ ...prev, password: event.target.value })) }} className={cn(compactAuthFieldClassName, "pl-12")} placeholder="New password" minLength={8} required />
                </div>
                <Label htmlFor="reset-confirm-password" className="sr-only">Confirm new password</Label>
                <div className="relative">
                  <span className={authInputIconWrapClassName}>
                    <LockKeyhole className={cn(authInputIconClassName, resetPasswordForm.confirm_password.length > 0 && !resetPasswordsMatch ? "text-red-500" : "")} />
                  </span>
                  <Input id="reset-confirm-password" type="password" value={resetPasswordForm.confirm_password} onChange={(event) => { setPasswordResetMessage(""); setResetPasswordForm((prev) => ({ ...prev, confirm_password: event.target.value })) }} className={cn(compactAuthFieldClassName, "pl-12", resetPasswordForm.confirm_password.length > 0 && !resetPasswordsMatch ? "border-red-400 focus-visible:ring-red-400/20" : "")} placeholder="Confirm password" minLength={8} required />
                </div>
                {resetPasswordForm.confirm_password.length > 0 ? (
                  <p className={cn("text-xs", resetPasswordsMatch ? (isResetPasswordLengthValid ? "text-emerald-600" : "text-amber-600") : "text-red-600")}>
                    {resetPasswordsMatch
                      ? (isResetPasswordLengthValid ? "Passwords match." : "Passwords match, but must be at least 8 characters.")
                      : "Passwords do not match."}
                  </p>
                ) : null}
              </div>
              <Button type="submit" className="h-[46px] w-full rounded-[0.95rem] bg-[linear-gradient(90deg,#183da8_0%,#165dd0_55%,#18d4cf_100%)] text-[15px] font-semibold shadow-[0_18px_34px_rgba(24,61,168,0.24)] hover:-translate-y-0.5 hover:shadow-[0_22px_40px_rgba(24,61,168,0.28)]" disabled={submitting || !resetPasswordForm.token || !resetPasswordsMatch || !isResetPasswordLengthValid}>
                {submitting ? "Resetting password..." : "Reset password"}
              </Button>
              <p className="text-center text-[12px] text-slate-500">
                <button type="button" onClick={resetLoginVerificationState} className="font-semibold text-[#0b6fa4] hover:underline">
                  Back to login
                </button>
              </p>
            </form>
          ) : mode === "editor_register" ? (
            <EditorRegistrationForm
              fixedAccountType="editor"
              onBack={() => {
                setRegistrationAccountType("editor")
                returnToLogin()
              }}
              onAccountTypeChange={setRegistrationAccountType}
              onSuccess={(_result, accountType) => {
                toast.success(`${accountType === "author" ? "Author" : "Editor"} registration successful! Check your email to verify your account.`)
                setRegistrationAccountType("editor")
                if (page === "portal") {
                  setMode("login")
                }
              }}
            />
          ) : registrationComplete ? (
            <div className="mx-auto max-w-xl space-y-6 text-center">
              <div className={cn("rounded-2xl border px-6 py-8", pendingVerification.email_sent === false ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50")}>
                <p className={cn("text-sm font-semibold uppercase tracking-[0.16em]", pendingVerification.email_sent === false ? "text-amber-700" : "text-emerald-700")}>Registration successful</p>
                <h2 className="display-card mt-3 text-slate-950">Your JASTI account has been created</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {pendingVerification.email_sent === false
                    ? "Your registration was completed successfully, but the server could not send the verification email. Try resending it later or contact support to finish verification before signing in."
                    : "Your registration was completed successfully. Check your email inbox and click the verification link before signing in to your journal workspace."}
                </p>
                {pendingVerification.email ? (
                  <p className="mt-3 text-sm text-slate-500">
                    {pendingVerification.email_sent === false ? "Verification email destination" : "Verification email sent to"} {pendingVerification.email}.
                  </p>
                ) : null}
                {verificationExpiryLabel ? <p className="mt-2 text-sm text-slate-500">{verificationExpiryLabel}</p> : null}
              </div>
              <div className="flex flex-col items-center gap-3">
                <Button type="button" variant="outline" className="h-11 min-w-[220px] rounded-xl px-6 text-sm font-semibold" onClick={async () => {
                  const email = pendingVerification.email?.trim()
                  if (!email) {
                    toast.error("No verification email address is available to resend.")
                    return
                  }
                  setResendingVerification(true)
                  try {
                    const response = await resendVerificationEmail({ email })
                    setPendingVerification({ ...(response.verification ?? {}), email })
                    setVerificationMessage(response.message)
                    toast.success(response.message)
                  } catch (error) {
                    toast.error(resolveErrorMessage(error, "Unable to resend verification email."))
                  } finally {
                    setResendingVerification(false)
                  }
                }} disabled={resendingVerification}>
                  {resendingVerification ? "Sending..." : "Resend verification email"}
                </Button>
                <Button type="button" className="h-11 min-w-[160px] rounded-xl px-6 text-sm font-semibold" onClick={returnToLogin}>
                  Login
                </Button>
                <button type="button" onClick={returnToLogin} className="text-sm font-semibold text-[#0b6fa4] hover:underline">
                  Go to login page
                </button>
              </div>
            </div>
          ) : (
            <form className="mx-auto mt-5 max-w-5xl space-y-4 text-left" onSubmit={handleRegister}>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="first-name" className="text-[13px] font-semibold text-slate-800">First name</Label>
                  <div className="relative">
                    <span className={authInputIconWrapClassName}>
                      <UserRound className={authInputIconClassName} />
                    </span>
                    <Input id="first-name" value={registerForm.first_name} onChange={(event) => setRegisterForm((prev) => ({ ...prev, first_name: event.target.value }))} className={cn(compactAuthFieldClassName, "pl-12")} required />
                  </div>
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="last-name" className="text-[13px] font-semibold text-slate-800">Last name</Label>
                  <Input id="last-name" value={registerForm.last_name} onChange={(event) => setRegisterForm((prev) => ({ ...prev, last_name: event.target.value }))} className={compactAuthFieldClassName} required />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="register-email" className="text-[13px] font-semibold text-slate-800">Email address</Label>
                  <div className="relative">
                    <span className={authInputIconWrapClassName}>
                      <Mail className={authInputIconClassName} />
                    </span>
                    <Input id="register-email" type="email" value={registerForm.email} onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))} className={cn(compactAuthFieldClassName, "pl-12")} required />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="register-password" className="text-[13px] font-semibold text-slate-800">Password</Label>
                  <div className="relative">
                    <span className={authInputIconWrapClassName}>
                      <LockKeyhole className={authInputIconClassName} />
                    </span>
                    <Input
                      id="register-password"
                      type={showPassword ? "text" : "password"}
                      minLength={8}
                      value={registerForm.password}
                      onFocus={() => setRegisterPasswordFocused(true)}
                      onBlur={() => setRegisterPasswordFocused(false)}
                      onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
                      className={cn(compactAuthFieldClassName, "pl-12 pr-11")}
                      required
                    />
                    <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800" aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {shouldShowRegisterPasswordChecks ? (
                    <div className="rounded-[1.35rem] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_14px_34px_rgba(15,23,42,0.06)]">
                      <p className="text-base font-semibold text-slate-900">Password must have:</p>
                      <div className="mt-4 space-y-3">
                        {passwordRequirementStates.map((requirement) => (
                          <div key={requirement.label} className="flex items-center gap-3 text-[15px] leading-none">
                            <span
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.6rem] shadow-sm",
                                requirement.met ? "bg-emerald-600 text-white" : "bg-red-600 text-white",
                              )}
                            >
                              {requirement.met ? (
                                <CheckCircle2 className="h-4.5 w-4.5" />
                              ) : (
                                <XCircle className="h-4.5 w-4.5" />
                              )}
                            </span>
                            <span className={requirement.met ? "text-slate-700" : "text-slate-500"}>{requirement.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-[13px] font-semibold text-slate-800">Verify password</Label>
                  <div className="relative">
                    <span className={authInputIconWrapClassName}>
                      <LockKeyhole className={cn(authInputIconClassName, confirmPassword.length > 0 && !passwordsMatch ? "text-red-500" : "")} />
                    </span>
                    <Input id="confirm-password" type={showConfirmPassword ? "text" : "password"} minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={cn(compactAuthFieldClassName, "pl-12 pr-11", confirmPassword.length > 0 && !passwordsMatch ? "border-red-400 focus-visible:ring-red-400/20" : "")} required />
                    <button type="button" onClick={() => setShowConfirmPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800" aria-label={showConfirmPassword ? "Hide password" : "Show password"}>
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 ? (
                    <p className={`text-xs ${passwordsMatch ? (isPasswordLengthValid ? "text-emerald-600" : "text-amber-600") : "text-red-600"}`}>
                      {passwordsMatch
                        ? (isPasswordLengthValid ? "Passwords match." : "Passwords match, but must be at least 8 characters.")
                        : "Passwords do not match."}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5 md:col-span-1">
                  <Label htmlFor="institution" className="text-[13px] font-semibold text-slate-800">Institution</Label>
                  <Input id="institution" value={registerForm.institution} onChange={(event) => setRegisterForm((prev) => ({ ...prev, institution: event.target.value }))} className={compactAuthFieldClassName} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="country" className="text-[13px] font-semibold text-slate-800">Country</Label>
                  {countryLookupFailed ? (
                    <>
                      <Input id="country" value={registerForm.country} onChange={(event) => setRegisterForm((prev) => ({ ...prev, country: event.target.value }))} className={compactAuthFieldClassName} required />
                      <p className="text-xs text-amber-600">Country list is unavailable, so manual entry is enabled.</p>
                    </>
                  ) : (
                    <>
                      <select
                        id="country"
                        value={registerForm.country}
                        onChange={(event) => setRegisterForm((prev) => ({ ...prev, country: event.target.value }))}
                        className={compactAuthSelectClassName}
                        disabled={countriesLoading}
                        required
                      >
                        {countriesLoading ? <option value={registerForm.country}>Loading countries...</option> : null}
                        {!countriesLoading ? <option value="">Select a country</option> : null}
                        {countryOptions.map((country) => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </select>
                      {countriesLoading ? <p className="text-xs text-slate-500">Loading country list from the online country API...</p> : null}
                    </>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-[13px] font-semibold text-slate-800">Phone</Label>
                  <Input id="phone" value={registerForm.phone} onChange={(event) => setRegisterForm((prev) => ({ ...prev, phone: event.target.value }))} className={compactAuthFieldClassName} />
                </div>
              </div>
              <div className={cn("grid gap-3", (isDedicatedReviewerPage || (!isDedicatedAuthorPage && registerForm.role === "reviewer")) ? "md:grid-cols-2" : "md:grid-cols-1")}>
                <div className="space-y-1.5">
                  <Label htmlFor="orcid" className="text-[13px] font-semibold text-slate-800">ORCID</Label>
                  <Input id="orcid" value={registerForm.orcid_id} onChange={(event) => setRegisterForm((prev) => ({ ...prev, orcid_id: event.target.value }))} className={compactAuthFieldClassName} />
                </div>
                {isDedicatedAuthorPage || isDedicatedReviewerPage ? null : (
                  <div className="space-y-1.5">
                    <Label htmlFor="role" className="text-[13px] font-semibold text-slate-800">Register as</Label>
                    <select id="role" className={compactAuthSelectClassName} value={registerForm.role} onChange={(event) => setRegisterForm((prev) => ({ ...prev, role: event.target.value }))}>
                      <option value="author">Author</option>
                      <option value="reviewer">Reviewer</option>
                    </select>
                  </div>
                )}
              {isDedicatedReviewerPage || (!isDedicatedAuthorPage && registerForm.role === "reviewer") ? (
                <div className="space-y-1.5">
                  <Label htmlFor="expertise" className="text-[13px] font-semibold text-slate-800">Reviewer expertise area</Label>
                  <Input id="expertise" value={registerForm.expertise_area} onChange={(event) => setRegisterForm((prev) => ({ ...prev, expertise_area: event.target.value }))} className={compactAuthFieldClassName} placeholder="Applied ICT, Engineering Design, Sustainability" />
                </div>
              ) : null}
              </div>
              <div className="grid gap-3 lg:grid-cols-[230px_minmax(0,1fr)] lg:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="captcha" className="text-[13px] font-semibold text-slate-800">Captcha</Label>
                  <div className="flex h-14 items-center justify-center rounded-[0.95rem] border border-slate-200 bg-slate-50 px-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                    <canvas ref={captchaCanvasRef} width={220} height={54} className="max-w-full" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="captcha-answer" className="text-[13px] font-semibold text-slate-800">Your answer</Label>
                  <Input id="captcha-answer" value={captchaInput} onChange={(event) => setCaptchaInput(event.target.value.toUpperCase())} className={cn(compactAuthFieldClassName, "uppercase")} required />
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={() => { setCaptcha(createCaptchaChallenge()); setCaptchaInput("") }} className="inline-flex h-10 items-center justify-center gap-2 rounded-[0.95rem] border border-slate-200 bg-white/92 px-4 text-sm font-semibold text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.05)] hover:border-[#0b6fa4] hover:text-[#0b6fa4]">
                  <RefreshCw className="h-4 w-4" />
                  Refresh captcha
                </button>
                <Button type="submit" className="h-[46px] w-full rounded-[0.95rem] bg-[linear-gradient(90deg,#183da8_0%,#165dd0_55%,#18d4cf_100%)] px-4 text-[15px] font-semibold shadow-[0_18px_34px_rgba(24,61,168,0.24)] hover:-translate-y-0.5 hover:shadow-[0_22px_40px_rgba(24,61,168,0.28)] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 sm:w-auto sm:min-w-[180px]" disabled={submitting || !isRegisterReady}>
                  {submitting ? "Creating account..." : "Register"}
                </Button>
              </div>
              {!isCaptchaValid && captchaInput.length > 0 ? (
                <p className="text-sm text-red-600">The CAPTCHA entry does not match the generated text.</p>
              ) : null}
              {isCaptchaValid && !isRegisterReady ? (
                <p className="text-sm text-amber-600">CAPTCHA confirmed. Complete the password requirements to activate registration.</p>
              ) : null}
              {isRegisterReady ? (
                <p className="text-sm text-emerald-600">CAPTCHA confirmed. Registration is ready.</p>
              ) : null}
              <p className="text-center text-[12px] text-slate-500">
                Already registered?{" "}
                <Link to={loginReturnPath} className="font-semibold text-[#0b6fa4] hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          )}
            </section>
          )}
        </div>
      </main>
      <Toaster position="top-right" />
    </div>
  )
}
