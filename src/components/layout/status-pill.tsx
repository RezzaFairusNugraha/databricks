"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

export function StatusPill() {
  const t = useTranslations("common");
  const [status, setStatus] = React.useState<"idle" | "checking" | "online" | "warning" | "offline">("idle");
  const [latency, setLatency] = React.useState<number | null>(null);

  const checkStatus = React.useCallback(async () => {
    setStatus("checking");
    try {
      const res = await fetch("/api/databricks/test-connection", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setStatus("online");
        setLatency(data.latencyMs);
      } else if (data.warehouseStatus === "STARTING") {
        setStatus("warning");
        setLatency(data.latencyMs);
      } else {
        setStatus("offline");
      }
    } catch {
      setStatus("offline");
    }
  }, []);

  React.useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  if (status === "checking") {
    return (
      <Badge variant="outline" className="gap-1.5 py-1 text-xs font-normal text-muted-foreground border-border/50">
        <RefreshCw className="h-3 w-3 animate-spin text-primary" />
        <span>Databricks: {t("checking")}</span>
      </Badge>
    );
  }

  if (status === "online") {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 py-1 text-xs font-medium border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 cursor-pointer"
        onClick={checkStatus}
        title="Klik untuk uji ulang koneksi"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
        </span>
        <span>Databricks UC {latency ? `(${latency}ms)` : t("connected")}</span>
      </Badge>
    );
  }

  if (status === "warning") {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 py-1 text-xs font-medium border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 cursor-pointer"
        onClick={checkStatus}
      >
        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <span>Warehouse Starting...</span>
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="gap-1.5 py-1 text-xs font-medium border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 cursor-pointer"
      onClick={checkStatus}
      title="Klik untuk memeriksa ulang"
    >
      <span className="h-2 w-2 rounded-full bg-rose-500" />
      <span>Databricks: {t("disconnected")}</span>
    </Badge>
  );
}
