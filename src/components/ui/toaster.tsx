"use client";
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { CheckCircle2 } from "lucide-react";

export function Toaster() {
  const { toasts } = useToast();
  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, variant, ...props }) => {
        const isSuccess = !variant || variant === "default";
        if (isSuccess && !description) {
          // Slim pill toast for simple success messages (no description)
          return (
            <Toast key={id} variant={variant} {...props}
              className="!p-0 !border-0 !shadow-none !bg-transparent !rounded-none pointer-events-auto">
              <div className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-md mx-auto">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>{title}</span>
              </div>
            </Toast>
          );
        }
        // Default card toast for errors / toasts with descriptions
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}