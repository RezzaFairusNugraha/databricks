"use client";

import { Menu } from "lucide-react";
import { useUiStore } from "@/lib/stores/ui-store";

export function MobileNavToggle() {
  const { toggleMobileSidebar } = useUiStore();

  return (
    <div className="md:hidden flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2.5">
      <span className="text-sm font-semibold text-zinc-900">CSV Tidy</span>
      <button
        type="button"
        onClick={toggleMobileSidebar}
        className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
        aria-label="Buka Menu"
      >
        <Menu className="h-5 w-5" />
      </button>
    </div>
  );
}
