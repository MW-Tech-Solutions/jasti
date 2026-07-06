import * as React from "react"
import { Link } from "react-router-dom"
import { ArrowRight, CalendarClock, MapPin, Mail, Phone, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { buildCampaignMediaUrl, getCampaignPublic, type CampaignPublicPayload, type CampaignSocialLink } from "@/lib/journalApi"

function mediaUrl(mediaId?: number | null) {
  if (!mediaId) return ""
  return buildCampaignMediaUrl(Number(mediaId))
}

function normalizeAnchor(anchor?: string) {
  const value = String(anchor ?? "").trim()
  if (!value) return ""
  if (value.startsWith("#")) return value.slice(1)
  return value.replace(/^\/+/, "")
}

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const p = platform.trim().toLowerCase()
  const common = { className: cn("h-5 w-5", className), viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg" }

  if (p === "facebook") {
    return (
      <svg {...common}>
        <path d="M14 9h3V6h-3c-1.7 0-3 1.3-3 3v3H8v3h3v6h3v-6h3l1-3h-4V9c0-.6.4-1 1-1Z" fill="currentColor" />
      </svg>
    )
  }

  if (p === "twitter" || p === "x") {
    return (
      <svg {...common}>
        <path d="M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.9-6.3L6.4 22H2l7.4-8.5L1 2h6.4l4.4 5.7L18.9 2Zm-1.1 18h1.7L6.1 3.9H4.3L17.8 20Z" fill="currentColor" />
      </svg>
    )
  }

  if (p === "instagram") {
    return (
      <svg {...common}>
        <path
          d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9Z"
          fill="currentColor"
        />
        <path d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" fill="currentColor" />
        <path d="M17.6 6.1a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z" fill="currentColor" />
      </svg>
    )
  }

  if (p === "youtube") {
    return (
      <svg {...common}>
        <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.5 12 4.5 12 4.5s-5.7 0-7.5.6A3 3 0 0 0 2.4 7.2 31 31 0 0 0 2 12a31 31 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.8.6 7.5.6 7.5.6s5.7 0 7.5-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 22 12a31 31 0 0 0-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z" fill="currentColor" />
      </svg>
    )
  }

  if (p === "whatsapp") {
    return (
      <svg {...common}>
        <path
          d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20Zm4.6-6.1c-.2-.1-1.3-.6-1.5-.7-.2-.1-.4-.1-.6.1-.2.2-.7.7-.9.9-.2.2-.3.2-.6.1-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.6-1.4-1.9-.1-.3 0-.4.1-.6l.4-.4c.1-.1.2-.3.3-.5.1-.2.1-.4 0-.6-.1-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9 0 1.1.8 2.2.9 2.3.1.2 1.6 2.5 3.8 3.4.5.2.9.4 1.2.5.5.2 1 .2 1.4.1.4-.1 1.3-.5 1.5-1 .2-.5.2-1 .1-1.1 0-.1-.2-.2-.4-.3Z"
          fill="currentColor"
        />
      </svg>
    )
  }

  if (p === "linkedin") {
    return (
      <svg {...common}>
        <path d="M6.5 9H3.8v12H6.5V9ZM5.2 3.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM20.5 14.3c0-3.2-1.7-5.3-4.6-5.3-1.3 0-2.3.7-2.8 1.4V9H10.4v12h2.7v-6.3c0-1.7.3-3.3 2.4-3.3 2.1 0 2.1 2 2.1 3.4V21h2.9v-6.7Z" fill="currentColor" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 17.9V20h-2v-.1a8 8 0 0 1 0-15.8V4h2v.1a8 8 0 0 1 0 15.8Z" fill="currentColor" />
    </svg>
  )
}

function SocialLinks({ links }: { links: CampaignSocialLink[] }) {
  const active = links.filter((l) => Number(l.is_active ?? 1) === 1)
  if (!active.length) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active.map((link) => (
        <a
          key={String(link.social_id)}
          href={String(link.url)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
          aria-label={String(link.platform)}
          title={String(link.platform)}
        >
          <PlatformIcon platform={String(link.platform)} />
        </a>
      ))}
    </div>
  )
}

export default function CampaignLandingPage() {
  const [payload, setPayload] = React.useState<CampaignPublicPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    let alive = true
    setLoading(true)
    getCampaignPublic()
      .then((data) => {
        if (!alive) return
        setPayload(data)
        setError("")
      })
      .catch((e) => {
        if (!alive) return
        setError(String((e as Error)?.message ?? e ?? "Unable to load campaign."))
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-20 text-slate-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading campaign page?</span>
        </div>
      </div>
    )
  }

  if (!payload) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <Card>
            <CardHeader>
              <CardTitle>Campaign page unavailable</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-700">
              <p>{error || "The campaign content has not been configured yet."}</p>
              <Link to="/" className="inline-flex items-center gap-2 text-jostum-700 hover:underline">
                <ArrowRight className="h-4 w-4" />
                Back to JASTI
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const site = payload.site
  const navLinks = payload.nav_links.filter((l) => Number(l.is_active ?? 1) === 1)
  const hero = payload.hero_slides[0]
  const heroBg = mediaUrl(hero?.background_media_id)

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[110rem] items-center justify-between gap-4 px-4 py-3 md:px-8">
          <a href="#home" className="text-sm font-semibold tracking-wide text-white">
            {site?.site_title || "Campaign"}
          </a>
          <nav className="hidden items-center gap-6 text-sm text-white/80 md:flex">
            {navLinks.map((link) => (
              <a key={String(link.nav_id)} href={String(link.anchor)} className="transition hover:text-white">
                {String(link.label)}
              </a>
            ))}
          </nav>
          <SocialLinks links={payload.social_links} />
        </div>
      </header>

      <section id="home" className={cn("relative overflow-hidden", heroBg ? "bg-slate-950" : "bg-[radial-gradient(circle_at_top,rgba(11,111,164,0.18),transparent_55%),linear-gradient(135deg,#0b6fa4,#0f172a)]")}
        style={heroBg ? { backgroundImage: `url(${heroBg})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        <div className="absolute inset-0 bg-slate-950/70" />
        <div className="relative mx-auto w-full max-w-[110rem] px-4 py-20 md:px-8 md:py-28">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/80">Osogbo Federal Constituency ? Osun State</p>
              <h1 className="mt-4 text-3xl font-semibold leading-tight text-white sm:text-5xl">
                {hero?.headline || site?.site_title || "PRINCE ABDULRASHEED MUIDEEN ROMEO"}
              </h1>
              {hero?.subheadline ? <p className="mt-4 max-w-3xl text-lg leading-8 text-white/85">{hero.subheadline}</p> : null}
              {hero?.body ? <p className="mt-6 max-w-3xl text-sm leading-7 text-white/80">{hero.body}</p> : null}
              <div className="mt-8 flex flex-wrap gap-3">
                {hero?.cta_anchor ? (
                  <a href={hero.cta_anchor}>
                    <Button className="rounded-full bg-white text-slate-950 hover:bg-white/90">{hero.cta_label || "Learn more"}</Button>
                  </a>
                ) : null}
                <a href="#contact">
                  <Button variant="outline" className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white/15">
                    Contact
                  </Button>
                </a>
              </div>
            </div>
            <div className="lg:col-span-4">
              <Card className="border-white/15 bg-white/10 text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-base">Get updates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-white/80">
                  <p>{site?.newsletter_text || "Get campaign updates, press releases, and announcements."}</p>
                  <div className="flex flex-col gap-3">
                    <input
                      placeholder="Email address"
                      className="h-11 w-full rounded-md border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/55"
                    />
                    <Button className="rounded-md bg-white text-slate-950 hover:bg-white/90">Subscribe</Button>
                    <p className="text-xs text-white/60">(Newsletter form is UI-only; connect to your preferred email tool.)</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section id={normalizeAnchor(navLinks.find((l) => l.anchor === "#priorities")?.anchor) || "priorities"} className="mx-auto w-full max-w-[110rem] px-4 py-16 md:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">2027 Agenda</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950 md:text-3xl">Areas for Osogbo Federal Constituency</h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-slate-600">Effective representation, youth empowerment, security, and stronger federal presence ? with transparency and accountability.</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {payload.priorities.map((item) => (
            <Card key={String(item.priority_id)} className="relative h-full overflow-hidden border-slate-200">
              <div className="absolute left-5 top-5">
                <Badge className="bg-red-600 text-white hover:bg-red-600">2027</Badge>
              </div>
              <CardContent className="flex h-full flex-col gap-3 p-6 pt-16">
                <h3 className="text-lg font-semibold text-slate-950">{item.title}</h3>
                <p className="flex-1 text-sm leading-7 text-slate-600 text-justify">{item.body}</p>
                {item.link_anchor ? (
                  <a href={item.link_anchor} className="inline-flex items-center gap-2 text-sm font-semibold text-jostum-700 hover:underline">
                    Learn more <ArrowRight className="h-4 w-4" />
                  </a>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id={normalizeAnchor(navLinks.find((l) => l.anchor === "#message")?.anchor) || "message"} className="bg-slate-50">
        <div className="mx-auto w-full max-w-[110rem] px-4 py-16 md:px-8">
          <div className="mb-10 flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-red-600">Message</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-10">
            <h2 className="text-3xl font-semibold text-slate-950 md:text-5xl">{payload.message?.title || "Give Voice To The Masses"}</h2>

            <div className="mt-8 text-sm leading-7 text-slate-700">
              {payload.message?.portrait_media_id ? (
                <figure className="mb-5 w-full md:float-left md:mb-2 md:mr-8 md:w-[360px]">
                  <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-sm">
                    <img
                      src={mediaUrl(payload.message.portrait_media_id)}
                      alt="Portrait"
                      className="h-auto w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <figcaption className="mt-3 text-xs text-slate-600">
                    {payload.message?.signature || "PRINCE ABDULRASHEED MUIDEEN ROMEO"}
                  </figcaption>
                </figure>
              ) : null}

              <div className="space-y-4 text-justify">
                {String(payload.message?.body || "").split(/\n\n+/).filter(Boolean).map((para, idx) => (
                  <p key={idx}>{para}</p>
                ))}
              </div>

              <div className="clear-both" />
            </div>
          </div>
        </div>
      </section>

      <section id={normalizeAnchor(navLinks.find((l) => l.anchor === "#updates")?.anchor) || "updates"} className="mx-auto w-full max-w-[110rem] px-4 py-16 md:px-8">
        <div className="grid gap-10 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Updates</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950 md:text-3xl">News, statements & campaign activities</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">Follow this page for verified updates and statements from constituency engagements.</p>

            <div className="mt-8 space-y-4">
              {payload.updates.map((entry) => (
                <Card key={String(entry.update_id)} className="h-full border-slate-200">
                  <CardContent className="flex h-full flex-col gap-4 p-5 md:flex-row">
                    {entry.media_id ? (
                      <div className="w-full shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 md:w-40">
                        <img src={mediaUrl(entry.media_id)} alt={entry.title} className="h-full w-full object-cover" loading="lazy" />
                      </div>
                    ) : null}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex flex-wrap items-center gap-2">
                        {entry.badge_top ? <Badge variant="secondary">{entry.badge_top}</Badge> : null}
                        {entry.badge_bottom ? <Badge className="bg-slate-900 text-white hover:bg-slate-900">{entry.badge_bottom}</Badge> : null}
                      </div>
                      <h3 className="mt-3 text-base font-semibold text-slate-950">{entry.title}</h3>
                      <p className="mt-2 flex-1 text-sm leading-7 text-slate-600 text-justify">{entry.excerpt}</p>
                      {entry.link_anchor ? (
                        <a href={entry.link_anchor} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-jostum-700 hover:underline">
                          Read more <ArrowRight className="h-4 w-4" />
                        </a>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="xl:col-span-7">
            <div className="grid gap-6 md:grid-cols-2">
              {payload.press_releases.map((entry) => (
                <Card key={String(entry.press_id)} className="flex h-full flex-col border-slate-200">
                  {entry.media_id ? (
                    <div className="aspect-[16/9] w-full overflow-hidden rounded-t-xl bg-slate-100">
                      <img src={mediaUrl(entry.media_id)} alt={entry.title} className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  ) : null}
                  <CardContent className="flex h-full flex-col gap-3 p-6">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <CalendarClock className="h-4 w-4" />
                      <span>{entry.date_published}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-950">{entry.title}</h3>
                    <p className="flex-1 text-sm leading-7 text-slate-600 text-justify">{entry.body}</p>
                  </CardContent>
                </Card>
              ))}

              {payload.statements.map((entry) => (
                <Card key={String(entry.statement_id)} className="flex h-full flex-col border-slate-200">
                  {entry.media_id ? (
                    <div className="aspect-[16/9] w-full overflow-hidden rounded-t-xl bg-slate-100">
                      <img src={mediaUrl(entry.media_id)} alt={entry.title} className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  ) : null}
                  <CardContent className="flex h-full flex-col gap-3 p-6">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Badge variant="secondary">Statement</Badge>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-950">{entry.title}</h3>
                    <p className="flex-1 text-sm leading-7 text-slate-600 text-justify">{entry.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id={normalizeAnchor(navLinks.find((l) => l.anchor === "#engagements")?.anchor) || "engagements"} className="bg-slate-50">
        <div className="mx-auto w-full max-w-[110rem] px-4 py-16 md:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Engagements</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950 md:text-3xl">Grassroots consultations & mobilization</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-slate-600">Strategic outreach meetings and constituency-wide consultations to strengthen representation.</p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {payload.engagements.map((entry) => (
              <Card key={String(entry.engagement_id)} className="flex h-full flex-col overflow-hidden border-slate-200">
                {entry.media_id ? (
                  <div className="aspect-[16/10] w-full bg-slate-100">
                    <img src={mediaUrl(entry.media_id)} alt={entry.title} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                ) : null}
                <CardContent className="flex h-full flex-col gap-3 p-6">
                  <h3 className="text-lg font-semibold text-slate-950">{entry.title}</h3>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    {entry.location ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {entry.location}
                      </span>
                    ) : null}
                    {entry.date_label ? <span className="rounded-full bg-white px-3 py-1">{entry.date_label}</span> : null}
                    {entry.time_label ? <span className="rounded-full bg-white px-3 py-1">{entry.time_label}</span> : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id={normalizeAnchor(navLinks.find((l) => l.anchor === "#contact")?.anchor) || "contact"} className="mx-auto w-full max-w-[110rem] px-4 py-16 md:px-8">
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="border-slate-200 lg:col-span-7">
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-700">
              <p className="text-justify">{site?.notice_text || "Follow this page for verified updates and statements."}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Office</p>
                  <p className="mt-2 font-semibold text-slate-950">{site?.constituency || "Osogbo Federal Constituency"}</p>
                  <p className="mt-1 text-slate-600">{site?.state || "Osun State"}, {site?.country || "Nigeria"}</p>
                  {site?.address_line ? <p className="mt-2 text-slate-600">{site.address_line}</p> : null}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Media Team</p>
                  <p className="mt-2 font-semibold text-slate-950">{site?.media_team || "PRINCE ABDUL-RASHEED MUIDEEN ROMEO MEDIA TEAM"}</p>
                  <div className="mt-3 flex flex-col gap-2 text-slate-600">
                    <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" /> media@your-domain.com</span>
                    <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" /> +234 000 000 0000</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <SocialLinks links={payload.social_links} />
                <a href="#home" className="text-sm font-semibold text-jostum-700 hover:underline">Back to top</a>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 lg:col-span-5">
            <CardHeader>
              <CardTitle>{site?.newsletter_title || "Get Updates"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-700">
              <p className="text-justify">{site?.newsletter_text || "Get campaign updates, press releases, and announcements."}</p>
              <div className="flex flex-col gap-3">
                <input className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" placeholder="Email address" />
                <Button className="rounded-md">Subscribe</Button>
                <p className="text-xs text-slate-500">(Newsletter form is UI-only; connect to your preferred email tool.)</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-[110rem] px-4 py-10 md:px-8">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">Quick links</p>
              <div className="mt-4 flex flex-col gap-2 text-sm text-slate-600">
                {navLinks.map((link) => (
                  <a key={String(link.nav_id)} href={String(link.anchor)} className="hover:text-slate-950 hover:underline">
                    {String(link.label)}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">Constituency</p>
              <p className="mt-4 text-sm leading-7 text-slate-600">{site?.constituency || "Osogbo Federal Constituency"}, {site?.state || "Osun State"} ({site?.country || "Nigeria"})</p>
              <p className="mt-3 text-sm text-slate-600">{site?.media_team || "PRINCE ABDUL-RASHEED MUIDEEN ROMEO MEDIA TEAM"}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">Notice</p>
              <p className="mt-4 text-sm leading-7 text-slate-600 text-justify">{site?.notice_text || "Follow this page for verified updates and statements."}</p>
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-2 border-t border-slate-200 pt-6 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
            <p>{site?.copyright_text || "? 2026"}</p>
            <p>Built for dynamic campaign updates.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
