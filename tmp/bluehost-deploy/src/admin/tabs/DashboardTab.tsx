import { BookUser, Building2, FileDown, IdCard, Printer, UsersRound } from "lucide-react"

import { StatCard } from "@/admin/components/StatCard"

type DashboardStats = {
  students: number
  staff: number
  cardsApplied: number
  cardsPrinted: number
  cardsPending: number
}

type DashboardTabProps = {
  stats: DashboardStats
  departmentCount: number
}

export function DashboardTab({ stats, departmentCount }: DashboardTabProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <StatCard
        title="Total Students"
        value={stats.students}
        icon={<BookUser className="h-5 w-5" />}
        tone="emerald"
      />
      <StatCard
        title="Total Staff"
        value={stats.staff}
        icon={<UsersRound className="h-5 w-5" />}
        tone="blue"
      />
      <StatCard
        title="Cards Applied"
        value={stats.cardsApplied}
        icon={<IdCard className="h-5 w-5" />}
        tone="jostum"
      />
      <StatCard
        title="Cards Printed"
        value={stats.cardsPrinted}
        icon={<Printer className="h-5 w-5" />}
        tone="indigo"
      />
      <StatCard
        title="Cards Pending"
        value={stats.cardsPending}
        icon={<FileDown className="h-5 w-5" />}
        tone="amber"
      />
      <StatCard
        title="Departments"
        value={departmentCount}
        icon={<Building2 className="h-5 w-5" />}
        tone="slate"
      />
    </div>
  )
}
