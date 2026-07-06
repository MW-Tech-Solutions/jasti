import * as React from "react"

import { cn } from "@/lib/utils"

type AccordionItemProps = {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function AccordionItem({ title, children, defaultOpen }: AccordionItemProps) {
  const [open, setOpen] = React.useState(!!defaultOpen)

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-800"
      >
        {title}
        <span className="text-xs text-slate-500">{open ? "Hide" : "Show"}</span>
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          open ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-4 pb-4 pt-0">{children}</div>
      </div>
    </div>
  )
}

export { AccordionItem }
