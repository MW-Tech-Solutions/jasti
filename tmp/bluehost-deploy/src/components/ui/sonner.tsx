import { Toaster as Sonner, type ToasterProps } from "sonner"

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      richColors
      className="toaster"
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-2xl border border-white/80 bg-white/92 text-slate-900 shadow-soft backdrop-blur-xl",
          title: "text-sm font-semibold",
          description: "text-sm leading-6 text-slate-600",
          actionButton: "rounded-xl bg-jostum-700 text-white",
          cancelButton: "rounded-xl bg-slate-100 text-slate-800",
        },
      }}
      {...props}
    />
  )
}
