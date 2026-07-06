import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-[linear-gradient(90deg,rgba(226,232,240,0.9),rgba(241,245,249,0.95),rgba(226,232,240,0.9))]", className)}
      {...props}
    />
  )
}

export { Skeleton }
