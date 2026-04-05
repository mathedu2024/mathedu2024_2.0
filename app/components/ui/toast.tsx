import * as React from "react"
import { cn } from "@/lib/utils" // 假設你有這個 utility，如果沒有可以移除 cn 並直接用字串

// Placeholder for ToastAction with Updated UI
const ToastAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-transparent px-3 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-red-100 group-[.destructive]:hover:border-red-500/30 group-[.destructive]:hover:bg-red-500 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-500",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = "ToastAction"

export { ToastAction }