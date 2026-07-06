import * as React from "react"

type SidebarButtonProps = {
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}

export function SidebarButton({ label, icon, active, onClick }: SidebarButtonProps) {
  return (
    <button
      className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
        active
          ? "border-jostum-300 bg-gradient-to-r from-jostum-700 to-jostum-600 text-white shadow-md shadow-jostum-300/40"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      }`}
      onClick={onClick}
      type="button"
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
        }`}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  )
}
