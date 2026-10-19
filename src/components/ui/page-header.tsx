import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6 md:pb-8", className)}>
      <div className="space-y-1">
        <h1 className="text-[28px] font-semibold tracking-tight text-zinc-900 leading-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-zinc-600 leading-normal max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
          {children}
        </div>
      )}
    </div>
  );
}
