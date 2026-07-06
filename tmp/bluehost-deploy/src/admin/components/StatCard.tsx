import * as React from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Tone = "jostum" | "emerald" | "blue" | "indigo" | "amber" | "slate"

type StatCardProps = {
  title: string
  value: number
  icon: React.ReactNode
  tone: Tone
}

export function StatCard({ title, value, icon, tone }: StatCardProps) {
  const toneMap: Record<Tone, { panel: string; chip: string; text: string; sub: string }> = {
    jostum: {
      panel: "from-jostum-50 to-white",
      chip: "bg-jostum-100",
      text: "text-jostum-700",
      sub: "text-jostum-600",
    },
    emerald: {
      panel: "from-emerald-50 to-white",
      chip: "bg-emerald-100",
      text: "text-emerald-700",
      sub: "text-emerald-700",
    },
    blue: {
      panel: "from-blue-50 to-white",
      chip: "bg-blue-100",
      text: "text-blue-700",
      sub: "text-blue-700",
    },
    indigo: {
      panel: "from-indigo-50 to-white",
      chip: "bg-indigo-100",
      text: "text-indigo-700",
      sub: "text-indigo-700",
    },
    amber: {
      panel: "from-amber-50 to-white",
      chip: "bg-amber-100",
      text: "text-amber-700",
      sub: "text-amber-700",
    },
    slate: {
      panel: "from-slate-50 to-white",
      chip: "bg-slate-200",
      text: "text-slate-700",
      sub: "text-slate-600",
    },
  }
  const toneStyle = toneMap[tone]

  return (
    <Card className={`border-slate-200 bg-gradient-to-br ${toneStyle.panel} shadow-sm`}>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardDescription className="text-xs uppercase tracking-wide">{title}</CardDescription>
          <CardTitle className="text-2xl font-semibold text-slate-900">{value}</CardTitle>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneStyle.chip} ${toneStyle.text}`}
        >
          {icon}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={`text-xs font-medium ${toneStyle.sub}`}>Updated today</div>
      </CardContent>
    </Card>
  )
}
