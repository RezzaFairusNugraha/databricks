import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  id?: string;
  htmlFor?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Field({
  label,
  id,
  htmlFor,
  helperText,
  error,
  required,
  children,
  className,
}: FieldProps) {
  const targetId = htmlFor || id;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={targetId} className="text-sm font-medium text-zinc-900 cursor-pointer">
          {label}
          {required && <span className="text-rose-600 ml-1">*</span>}
        </Label>
      </div>
      {children}
      {error ? (
        <p className="text-[13px] text-rose-600">{error}</p>
      ) : helperText ? (
        <p className="text-[13px] text-zinc-500 leading-tight">{helperText}</p>
      ) : null}
    </div>
  );
}
