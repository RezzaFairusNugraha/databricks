"use client";

import * as React from "react";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  UploadCloud,
  History,
  Settings,
  Sparkles,
  Database,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusPill } from "./status-pill";

export function Sidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const navItems = [
    {
      label: t("dashboard"),
      href: "/",
      icon: LayoutDashboard,
      badge: null,
    },
    {
      label: t("newImport"),
      href: "/import",
      icon: UploadCloud,
      badge: "UC Stream",
    },
    {
      label: t("history"),
      href: "/history",
      icon: History,
      badge: null,
    },
    {
      label: t("settings"),
      href: "/settings",
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border/70 bg-card/40 backdrop-blur-xl transition-all">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-border/60 px-5">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary transition-all group-hover:scale-105 group-hover:bg-primary/20 shadow-sm shadow-primary/10">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-tight text-foreground flex items-center gap-1.5">
              CSV Tidy
              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20">
                v1.0
              </span>
            </span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Database className="h-3 w-3 text-muted-foreground" />
              Databricks UC
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[11px] font-medium tracking-wider uppercase text-muted-foreground/80">
          Navigation
        </div>
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-primary/10 text-primary font-semibold shadow-xs"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span>{item.label}</span>
              </div>
              {item.badge ? (
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  {item.badge}
                </span>
              ) : isActive ? (
                <ChevronRight className="h-3.5 w-3.5 text-primary opacity-60" />
              ) : null}
            </Link>
          );
        })}
      </div>

      {/* Bottom Status Card */}
      <div className="border-t border-border/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Engine Status
          </span>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Databricks</span>
            <StatusPill />
          </div>
          <div className="text-[11px] text-muted-foreground/80 leading-relaxed">
            Streaming langsung ke Volume UC tanpa beban RAM server.
          </div>
        </div>
      </div>
    </aside>
  );
}
