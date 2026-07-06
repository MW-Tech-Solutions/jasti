import * as React from "react"
import CookieConsent, { Cookies } from "react-cookie-consent"
import { Link } from "react-router-dom"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const consentCookieName = "jasti_cookie_consent"
const consentCookieExpiryDays = 180

function isStoredConsentValue(value: string | null): value is "accepted" | "declined" {
  return value === "accepted" || value === "declined"
}

function migrateLegacyConsentValue() {
  if (typeof window === "undefined") return
  if (Cookies.get(consentCookieName) !== undefined) return

  try {
    const legacyValue = window.localStorage.getItem(consentCookieName)
    if (!isStoredConsentValue(legacyValue)) return

    Cookies.set(consentCookieName, legacyValue, {
      expires: consentCookieExpiryDays,
      sameSite: "lax",
      secure: window.location.protocol === "https:",
    })
    window.localStorage.removeItem(consentCookieName)
  } catch {
    /* ignore storage migration issues */
  }
}

export default function CookieConsentBanner() {
  const [visible, setVisible] = React.useState<"hidden" | "byCookieValue">("hidden")

  React.useEffect(() => {
    migrateLegacyConsentValue()
    setVisible("byCookieValue")
  }, [])

  return (
    <CookieConsent
      location="bottom"
      visible={visible}
      cookieName={consentCookieName}
      cookieValue="accepted"
      declineCookieValue="declined"
      sameSite="lax"
      expires={consentCookieExpiryDays}
      enableDeclineButton
      setDeclineCookie
      disableStyles
      disableButtonStyles
      containerClasses="fixed inset-x-0 bottom-0 z-[240] mx-auto mb-4 flex w-[min(96%,58rem)] flex-col gap-4 rounded-[1.75rem] border border-white/80 bg-[rgba(255,255,255,0.96)] p-4 text-slate-900 shadow-[0_24px_50px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:p-5"
      contentClasses="flex-1 text-sm leading-7 text-slate-600"
      buttonWrapperClasses="flex shrink-0 flex-col gap-2 sm:flex-row"
      buttonClasses={cn(buttonVariants(), "min-w-[8rem]")}
      declineButtonClasses={cn(buttonVariants({ variant: "outline" }), "min-w-[8rem]")}
      buttonText="Accept"
      declineButtonText="Decline"
      ariaAcceptLabel="Accept cookies"
      ariaDeclineLabel="Decline cookies"
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0b6fa4]">
          Cookie notice
        </p>
        <p className="mt-2">
          We use cookies to improve your experience, keep sign-in secure, and remember your
          preferences. Review our{" "}
          <Link to="/privacy" className="font-semibold text-jostum-700 underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </CookieConsent>
  )
}
