import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-4 rounded-xl border border-dashed border-zinc-200 bg-white",
        className
      )}
    >
      {Icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 mb-3 bg-zinc-50">
          <Icon className="h-5 w-5 text-zinc-600" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <p className="text-[13px] text-zinc-500 mt-1 max-w-sm leading-normal">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
