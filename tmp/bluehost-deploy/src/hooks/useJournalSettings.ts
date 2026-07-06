import * as React from "react"

import { getPublicSettings, resolveApiAssetUrl, type JournalSettings } from "@/lib/journalApi"
import logoImage from "@/assets/logo.jpeg"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readString(source: Record<string, unknown>, key: keyof JournalSettings, fallback: string) {
  const value = source[key]
  return typeof value === "string" ? value : fallback
}

function readStringArray(source: Record<string, unknown>, key: keyof JournalSettings, fallback: string[]) {
  const value = source[key]
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : fallback
}

function readCallForPapers(
  source: Record<string, unknown>,
  fallback: JournalSettings["call_for_papers"]
): JournalSettings["call_for_papers"] {
  const value = source.call_for_papers
  if (!Array.isArray(value)) return fallback

  return value.flatMap((item) => {
    if (!isRecord(item)) return []

    return [
      {
        title: typeof item.title === "string" ? item.title : "",
        deadline: typeof item.deadline === "string" ? item.deadline : "",
        summary: typeof item.summary === "string" ? item.summary : "",
      },
    ]
  })
}

function readTrendingResearch(
  source: Record<string, unknown>,
  fallback: JournalSettings["trending_research"]
): JournalSettings["trending_research"] {
  const value = source.trending_research
  if (!Array.isArray(value)) return fallback

  return value.flatMap((item) => {
    if (!isRecord(item)) return []

    return [
      {
        title: typeof item.title === "string" ? item.title : "",
        area: typeof item.area === "string" ? item.area : "",
        summary: typeof item.summary === "string" ? item.summary : "",
      },
    ]
  })
}

export const fallbackJournalSettings: JournalSettings = {
  journal_name: "Journal of Applied Science, Technology, and Innovation",
  journal_acronym: "JASTI",
  logo_path: "",
  homepage_tagline: "Building a rigorous African journal platform for applied research.",
  homepage_intro: "Home for multidisciplinary research, applied scholarship, editorial quality, and publication visibility across science, technology, and innovation.",
  home_topbar_text: "Home for all research in applied science, technology, and innovation",
  featured_articles_title: "Recently published research",
  featured_articles_description: "Peer-reviewed articles and manuscripts published through the JASTI editorial workflow.",
  research_pathways_title: "Research publishing pathways",
  call_for_papers_title: "Submission deadlines and current opportunities",
  call_for_papers_description: "Calls for papers are published here by the administrator and provide issue opportunities for authors across JASTI thematic areas.",
  call_for_papers_cta_title: "Login and submit",
  call_for_papers_cta_body: "Use the JASTI portal to log in, prepare your manuscript, and submit within the relevant deadline window.",
  call_for_papers_notes: [
    "Original research articles, reviews, case studies, and technical notes are welcome.",
    "Submissions should align with JASTI aims, thematic scope, and ethical standards.",
    "Authors should be prepared for screening, peer review, revision, and final editorial evaluation.",
  ],
  trending_research_title: "Current topics across applied scholarship",
  trending_research_description: "Highlighted research areas help readers, authors, and editors identify emerging themes across applied science, technology, and innovation.",
  publishing_overview_title: "Editorial quality and practical relevance",
  publishing_overview_description: "JASTI prioritizes methodological soundness, publication ethics, applied relevance, and multidisciplinary integration across research contexts.",
  workflow_snapshot_title: "From submission to publication",
  workflow_snapshot_description: "The journal system is modeled around the full digital publishing sequence from submission to indexing and citation tracking.",
  discover_open_access_title: "Discover Open Access",
  discover_open_access_body: "Explore open and accessible research pathways, publication ethics, visibility strategies, and the role of open scholarship in applied knowledge exchange.",
  discover_open_access_image: "/images/discover-open-access.jpg",
  discover_open_access_points: [
    "Open access supports visibility, citation potential, and broader knowledge transfer across institutions and practice communities.",
    "JASTI aligns open dissemination with editorial rigor, publication ethics, and evidence-based evaluation rather than volume-driven publishing.",
    "The journal aims to improve access to trusted scholarship while preserving documented review, editorial governance, and research quality.",
  ],
  publish_with_us_title: "Publish with Us",
  publish_with_us_body: "Learn how JASTI supports authors through submission, peer review, revision, production planning, and publication-ready editorial workflows.",
  publish_with_us_image: "/images/publish-with-us.jpg",
  publish_with_us_points: [
    "Multidisciplinary applied research focus",
    "Transparent editorial decisions and peer review",
    "Clear pathways for revisions, production, and publication",
    "Growing visibility strategy through DOI, indexing readiness, and metrics",
  ],
  track_research_title: "Track Your Research",
  track_research_body: "Monitor submissions, revisions, editorial decisions, downloads, citations, DOI progress, and journal communication through the JASTI portal.",
  track_research_image: "/images/track-your-research.jpg",
  call_for_papers: [
    {
      title: "Applied ICT for resilient institutions",
      deadline: "2026-06-30",
      summary: "Original research, case studies, and review articles on digital systems that strengthen public and private sector performance.",
    },
    {
      title: "Technology-driven climate and sustainability solutions",
      deadline: "2026-07-15",
      summary: "Submissions on environmental systems, climate adaptation, clean technology, and sustainability analytics.",
    },
  ],
  trending_research: [
    {
      title: "AI-supported reviewer matching in multidisciplinary journals",
      area: "Editorial technology",
      summary: "Growing interest in workflow intelligence, reviewer discovery, and fair assignment logic.",
    },
    {
      title: "Open science and applied innovation ecosystems",
      area: "Research policy",
      summary: "Research visibility, practical implementation, and collaborative knowledge transfer remain key concerns.",
    },
  ],
  aims: [
    "Provide a rigorous scholarly platform for applied, solution-oriented research",
    "Publish work with practical relevance, methodological soundness, and measurable impact",
    "Support science, technology, engineering, agriculture, management, and education research",
  ],
  scope: [
    "Applied Information and Communication Technology (ICT)",
    "Engineering Systems, Design, and Optimization",
    "Applied Physical and Chemical Sciences",
  ],
  objectives: [
    "Bridge the gap between theory and practice",
    "Promote interdisciplinary and cross-sector research",
    "Support innovation-driven development",
  ],
  review_specializations: [
    "Applied Information and Communication Technology (ICT)",
    "Engineering Systems, Design, and Optimization",
    "Applied Physical and Chemical Sciences",
  ],
  footer_summary: "Home for multidisciplinary research, applied scholarship, editorial quality, and publication visibility across science, technology, and innovation.",
  footer_bottom_text: "Journal publishing, peer review, and research visibility.",
  footer_bottom_tagline: "Applied science. Technology. Innovation.",
}

export function normalizeJournalSettings(candidate: unknown): JournalSettings {
  const source = isRecord(candidate) ? candidate : {}

  return {
    journal_name: readString(source, "journal_name", fallbackJournalSettings.journal_name),
    journal_acronym: readString(source, "journal_acronym", fallbackJournalSettings.journal_acronym),
    logo_path: readString(source, "logo_path", fallbackJournalSettings.logo_path),
    homepage_tagline: readString(source, "homepage_tagline", fallbackJournalSettings.homepage_tagline),
    homepage_intro: readString(source, "homepage_intro", fallbackJournalSettings.homepage_intro),
    home_topbar_text: readString(source, "home_topbar_text", fallbackJournalSettings.home_topbar_text),
    featured_articles_title: readString(source, "featured_articles_title", fallbackJournalSettings.featured_articles_title),
    featured_articles_description: readString(source, "featured_articles_description", fallbackJournalSettings.featured_articles_description),
    research_pathways_title: readString(source, "research_pathways_title", fallbackJournalSettings.research_pathways_title),
    call_for_papers_title: readString(source, "call_for_papers_title", fallbackJournalSettings.call_for_papers_title),
    call_for_papers_description: readString(source, "call_for_papers_description", fallbackJournalSettings.call_for_papers_description),
    call_for_papers_cta_title: readString(source, "call_for_papers_cta_title", fallbackJournalSettings.call_for_papers_cta_title),
    call_for_papers_cta_body: readString(source, "call_for_papers_cta_body", fallbackJournalSettings.call_for_papers_cta_body),
    call_for_papers_notes: readStringArray(source, "call_for_papers_notes", fallbackJournalSettings.call_for_papers_notes),
    trending_research_title: readString(source, "trending_research_title", fallbackJournalSettings.trending_research_title),
    trending_research_description: readString(source, "trending_research_description", fallbackJournalSettings.trending_research_description),
    publishing_overview_title: readString(source, "publishing_overview_title", fallbackJournalSettings.publishing_overview_title),
    publishing_overview_description: readString(source, "publishing_overview_description", fallbackJournalSettings.publishing_overview_description),
    workflow_snapshot_title: readString(source, "workflow_snapshot_title", fallbackJournalSettings.workflow_snapshot_title),
    workflow_snapshot_description: readString(source, "workflow_snapshot_description", fallbackJournalSettings.workflow_snapshot_description),
    discover_open_access_title: readString(source, "discover_open_access_title", fallbackJournalSettings.discover_open_access_title),
    discover_open_access_body: readString(source, "discover_open_access_body", fallbackJournalSettings.discover_open_access_body),
    discover_open_access_image: readString(source, "discover_open_access_image", fallbackJournalSettings.discover_open_access_image),
    discover_open_access_points: readStringArray(source, "discover_open_access_points", fallbackJournalSettings.discover_open_access_points),
    publish_with_us_title: readString(source, "publish_with_us_title", fallbackJournalSettings.publish_with_us_title),
    publish_with_us_body: readString(source, "publish_with_us_body", fallbackJournalSettings.publish_with_us_body),
    publish_with_us_image: readString(source, "publish_with_us_image", fallbackJournalSettings.publish_with_us_image),
    publish_with_us_points: readStringArray(source, "publish_with_us_points", fallbackJournalSettings.publish_with_us_points),
    track_research_title: readString(source, "track_research_title", fallbackJournalSettings.track_research_title),
    track_research_body: readString(source, "track_research_body", fallbackJournalSettings.track_research_body),
    track_research_image: readString(source, "track_research_image", fallbackJournalSettings.track_research_image),
    call_for_papers: readCallForPapers(source, fallbackJournalSettings.call_for_papers),
    trending_research: readTrendingResearch(source, fallbackJournalSettings.trending_research),
    aims: readStringArray(source, "aims", fallbackJournalSettings.aims),
    scope: readStringArray(source, "scope", fallbackJournalSettings.scope),
    objectives: readStringArray(source, "objectives", fallbackJournalSettings.objectives),
    review_specializations: readStringArray(source, "review_specializations", fallbackJournalSettings.review_specializations),
    footer_summary: readString(source, "footer_summary", fallbackJournalSettings.footer_summary),
    footer_bottom_text: readString(source, "footer_bottom_text", fallbackJournalSettings.footer_bottom_text),
    footer_bottom_tagline: readString(source, "footer_bottom_tagline", fallbackJournalSettings.footer_bottom_tagline),
  }
}

export function applyJournalBranding(settings: JournalSettings) {
  const normalizedSettings = normalizeJournalSettings(settings)
  document.title = `${normalizedSettings.journal_acronym || "JASTI"} | ${normalizedSettings.journal_name || "Journal of Applied Science, Technology, and Innovation"}`
  const rawHref = normalizedSettings.logo_path ? resolveApiAssetUrl(normalizedSettings.logo_path) : logoImage
  const faviconHref = `${rawHref}${rawHref.includes("?") ? "&" : "?"}v=${Date.now()}`
  let favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement | null
  if (!favicon) {
    favicon = document.createElement("link")
    favicon.rel = "icon"
    document.head.appendChild(favicon)
  }
  favicon.type = "image/png"
  favicon.href = faviconHref

  let shortcut = document.querySelector("link[rel='shortcut icon']") as HTMLLinkElement | null
  if (!shortcut) {
    shortcut = document.createElement("link")
    shortcut.rel = "shortcut icon"
    document.head.appendChild(shortcut)
  }
  shortcut.type = "image/png"
  shortcut.href = faviconHref
}

export function useJournalSettings() {
  const [settings, setSettings] = React.useState<JournalSettings>(fallbackJournalSettings)

  const refreshSettings = React.useCallback(async () => {
    try {
      const response = await getPublicSettings()
      const normalizedSettings = normalizeJournalSettings(response.settings)
      setSettings(normalizedSettings)
      applyJournalBranding(normalizedSettings)
    } catch {
      setSettings((current) => current)
    }
  }, [])

  React.useEffect(() => {
    applyJournalBranding(settings)
  }, [settings])

  React.useEffect(() => {
    void refreshSettings()
  }, [refreshSettings])

  return { settings, refreshSettings }
}
