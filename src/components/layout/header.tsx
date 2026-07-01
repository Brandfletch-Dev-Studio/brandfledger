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
        "relative flex items-center justify-between gap-3 border-b bg-gradient-to-r from-primary/5 via-card to-card px-6 py-5 md:pl-6 pl-16",
        className
      )}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {Icon && (
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-0.5 truncate">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
