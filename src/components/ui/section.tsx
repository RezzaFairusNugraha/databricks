import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  card?: boolean;
}

export function Section({
  title,
  description,
  action,
  children,
  className,
  card = false,
}: SectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || description || action) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="space-y-0.5">
            {title && (
              <h2 className="text-base font-semibold text-zinc-900 tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-[13px] text-zinc-500">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {card ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  );
}
