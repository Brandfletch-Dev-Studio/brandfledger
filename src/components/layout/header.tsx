"use client";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  actions?: ReactNode;
  className?: string;
}

export function Header({ title, description, icon: Icon, actions, className }: HeaderProps) {
  return (
    <div
      className={cn(
        "relative border-b bg-gradient-to-r from-primary/5 via-card to-card px-3 sm:px-6 py-3 sm:py-5",
        className
      )}
    >
      {/* Mobile: stack title above actions. Desktop: side by side. */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-base sm:text-2xl font-semibold tracking-tight truncate">{title}</h1>
            {description && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
