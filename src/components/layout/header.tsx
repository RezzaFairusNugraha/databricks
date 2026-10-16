"use client";

import * as React from "react";
import { usePathname, useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  Sun,
  Moon,
  Languages,
  UploadCloud,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";

export function Header() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleLanguage = () => {
    const nextLocale = locale === "id" ? "en" : "id";
    router.replace(pathname, { locale: nextLocale });
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const getPageTitle = () => {
    if (pathname === "/") return t("dashboard");
    if (pathname.startsWith("/import")) return t("newImport");
    if (pathname.startsWith("/history")) return t("history");
    if (pathname.startsWith("/settings")) return t("settings");
    return "CSV Tidy";
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 bg-background/80 px-8 backdrop-blur-md">
      {/* Breadcrumb / Title */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">CSV Tidy</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
        <span className="font-semibold text-foreground">{getPageTitle()}</span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Language Switcher */}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleLanguage}
          className="h-8 gap-1.5 px-2.5 text-xs font-medium border-border/70"
          title={locale === "id" ? "Ganti ke English" : "Switch to Indonesian"}
        >
          <Languages className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="uppercase font-semibold tracking-wider">
            {locale === "id" ? "ID" : "EN"}
          </span>
        </Button>

        {/* Theme Mode Toggle */}
        <Button
          variant="outline"
          size="icon"
          onClick={toggleTheme}
          className="h-8 w-8 border-border/70"
          title="Toggle Light / Dark mode"
        >
          {mounted && resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4 text-amber-400 transition-all" />
          ) : (
            <Moon className="h-4 w-4 text-slate-700 transition-all" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Quick New Import Button */}
        {pathname !== "/import" && (
          <Button asChild size="sm" className="h-8 gap-1.5 text-xs shadow-sm">
            <Link href="/import">
              <UploadCloud className="h-3.5 w-3.5" />
              <span>{t("newImport")}</span>
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}
