"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UploadCloud,
  History,
  BookOpen,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { useUiStore } from "@/lib/stores/ui-store";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
}

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Impor",
    icon: UploadCloud,
    match: (pathname) => pathname === "/" || pathname.startsWith("/tidy"),
  },
  {
    href: "/history",
    label: "Riwayat",
    icon: History,
    match: (pathname) => pathname.startsWith("/history"),
  },
  {
    href: "/guide",
    label: "Panduan",
    icon: BookOpen,
    match: (pathname) => pathname.startsWith("/guide"),
  },
  {
    href: "/settings",
    label: "Pengaturan",
    icon: Settings,
    match: (pathname) => pathname.startsWith("/settings"),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isMobileSidebarOpen, setMobileSidebarOpen } = useUiStore();
  const [status, setStatus] = React.useState<"connected" | "unconfigured" | "error">("unconfigured");

  const checkStatus = React.useCallback(async () => {
    try {
      const configRes = await fetch("/api/databricks/config-status");
      if (!configRes.ok) {
        setStatus("error");
        return;
      }
      const configData = await configRes.json();
      if (!configData.isConfigured) {
        setStatus("unconfigured");
        return;
      }

      const testRes = await fetch("/api/databricks/test-connection");
      if (testRes.ok) {
        const testData = await testRes.json();
        if (testData.success) {
          setStatus("connected");
        } else {
          setStatus("error");
        }
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }, []);

  React.useEffect(() => {
    checkStatus();
    const handleStatusChanged = () => checkStatus();
    window.addEventListener("databricks-status-changed", handleStatusChanged);
    return () => {
      window.removeEventListener("databricks-status-changed", handleStatusChanged);
    };
  }, [checkStatus]);

  const content = (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-zinc-900 tracking-tight">CSV Tidy</span>
              <span className="text-[10px] text-zinc-500 font-medium">Databricks Studio</span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden text-zinc-500 hover:text-zinc-900 p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-600 font-semibold"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-indigo-600" : "text-zinc-400"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-zinc-200/80 pt-4 px-2">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 text-xs text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              status === "connected"
                ? "bg-emerald-500"
                : status === "unconfigured"
                ? "bg-zinc-400"
                : "bg-rose-500"
            }`}
          />
          <span className="text-[11px] font-medium truncate">
            {status === "connected"
              ? "Databricks Terhubung"
              : status === "unconfigured"
              ? "Belum Dikonfigurasi"
              : "Koneksi Bermasalah"}
          </span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white h-screen sticky top-0">
        {content}
      </aside>

      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative w-64 bg-white shadow-xl h-full flex flex-col z-10">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
