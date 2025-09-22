// app/components/ui/use-toast.ts
import { toast as sonnerToast, Toaster as SonnerToaster } from "sonner"

function useToast() {
  return { toast: sonnerToast }
}

const Toaster = SonnerToaster

export { useToast, Toaster }