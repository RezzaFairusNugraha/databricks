import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusType = "connected" | "unconfigured" | "error" | "loading" | "success" | "warning";

interface StatusDotProps {
  status: StatusType;
  label?: string;
  pulse?: boolean;
  className?: string;
}

export function StatusDot({
  status,
  label,
  pulse = false,
  className,
}: StatusDotProps) {
  const colorMap: Record<StatusType, { dot: string; text: string }> = {
    connected: { dot: "bg-emerald-500", text: "text-emerald-700" },
    success: { dot: "bg-emerald-500", text: "text-emerald-700" },
    unconfigured: { dot: "bg-zinc-400", text: "text-zinc-600" },
    error: { dot: "bg-rose-500", text: "text-rose-700" },
    warning: { dot: "bg-amber-500", text: "text-amber-700" },
    loading: { dot: "bg-indigo-500", text: "text-indigo-700" },
  };

  const config = colorMap[status] || colorMap.unconfigured;

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative flex h-2 w-2 shrink-0">
        {pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              config.dot
            )}
          />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", config.dot)} />
      </span>
      {label && (
        <span className="text-[13px] font-medium text-zinc-600 truncate">
          {label}
        </span>
      )}
    </div>
  );
}
