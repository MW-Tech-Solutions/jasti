import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jostum-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:translate-y-0 disabled:shadow-none ring-offset-white",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(135deg,#0b6fa4_0%,#1f6b5c_100%)] text-white shadow-[0_14px_28px_rgba(11,111,164,0.18)] hover:-translate-y-px hover:shadow-[0_18px_36px_rgba(11,111,164,0.24)] disabled:bg-none disabled:bg-slate-300 disabled:text-slate-700",
        secondary:
          "bg-slate-100/90 text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] hover:-translate-y-px hover:bg-slate-200/85 disabled:bg-slate-200 disabled:text-slate-500",
        outline:
          "border border-slate-200/90 bg-white/88 text-slate-800 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur hover:-translate-y-px hover:border-slate-300 hover:bg-white disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500",
        ghost: "text-slate-700 hover:bg-slate-100/80 disabled:text-slate-400",
        destructive:
          "bg-[linear-gradient(135deg,#dc2626_0%,#b91c1c_100%)] text-white shadow-[0_14px_28px_rgba(220,38,38,0.18)] hover:-translate-y-px hover:shadow-[0_18px_36px_rgba(220,38,38,0.24)] disabled:bg-none disabled:bg-red-200 disabled:text-red-700",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-3.5",
        lg: "h-12 rounded-xl px-6",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
