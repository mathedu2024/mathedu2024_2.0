// app/components/ui/toast.tsx
import * as React from "react"

// Placeholder for ToastAction
const ToastAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={className}
    {...props}
  />
))
ToastAction.displayName = "ToastAction"

export { ToastAction }