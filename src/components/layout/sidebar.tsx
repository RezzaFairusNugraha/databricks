"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UploadCloud,
  History,
  BookOpen,
  Settings,
  X,
} from "lucide-react";
import { useUiStore } from "@/lib/stores/ui-store";
import { StatusDot, StatusType } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";

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
  const [status, setStatus] = React.useState<StatusType>("unconfigured");

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
        <div className="flex items-center justify-between px-2 pt-1">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-zinc-900">
              CSV Tidy
            </span>
            <span className="text-xs text-zinc-500 font-normal">
              Databricks
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden text-zinc-500 hover:text-zinc-900 p-1 rounded-md"
            aria-label="Tutup menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-150",
                  isActive
                    ? "bg-zinc-100 text-indigo-600 font-medium"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 font-normal"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive ? "text-indigo-600" : "text-zinc-500"
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-zinc-200 pt-3 px-1">
        <Link
          href="/settings"
          className="flex items-center justify-between w-full rounded-lg px-2 py-2 hover:bg-zinc-50 transition-colors duration-150"
        >
          <StatusDot
            status={status}
            label={
              status === "connected"
                ? "Databricks Terhubung"
                : status === "unconfigured"
                ? "Belum Dikonfigurasi"
                : "Koneksi Bermasalah"
            }
          />
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex w-[232px] shrink-0 flex-col border-r border-zinc-200 bg-white h-screen sticky top-0">
        {content}
      </aside>

      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-xs transition-opacity"
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
