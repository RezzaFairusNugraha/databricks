import { AuthMode, ConfigStatus, DatabricksConfig, DatabricksError } from "./types";
import { getDatabricksConfigFromSettings, getSafeSettings } from "./settings";

export function getDatabricksConfig(): DatabricksConfig {
  return getDatabricksConfigFromSettings();
}

export function getAuthMode(config: DatabricksConfig): AuthMode {
  if (config.token) return "pat";
  if (config.clientId && config.clientSecret) return "oauth_m2m";
  return "unconfigured";
}

export function getConfigStatus(): ConfigStatus {
  const safe = getSafeSettings();
  const warnings: string[] = [];

  if (!safe.host) {
    warnings.push("URL Workspace belum dikonfigurasi.");
  }
  if (!safe.warehouseId) {
    warnings.push("SQL Warehouse ID belum ditentukan.");
  }
  if (!safe.hasToken) {
    warnings.push("Personal Access Token belum diatur.");
  }

  const maskString = (str: string, keepStart = 4, keepEnd = 3) => {
    if (!str) return "Tidak Dikonfigurasi";
    if (str.length <= keepStart + keepEnd) return "••••••••";
    return `${str.substring(0, keepStart)}••••${str.substring(str.length - keepEnd)}`;
  };

  const maskedHost = safe.host
    ? safe.host.replace(/^(https?:\/\/)?([^.]+)/, (match, p1, p2) => {
        return `${p1 || "https://"}${p2.substring(0, 4)}••••`;
      })
    : "Belum Dikonfigurasi";

  return {
    isConfigured: safe.isConfigured,
    host: safe.host,
    maskedHost,
    warehouseId: safe.warehouseId,
    maskedWarehouseId: maskString(safe.warehouseId, 4, 3),
    authMode: safe.hasToken ? "pat" : "unconfigured",
    defaultCatalog: safe.defaultCatalog,
    defaultSchema: safe.defaultSchema,
    defaultVolume: safe.defaultVolume,
    volumePath: safe.volumePath,
    maxUploadSizeMb: safe.maxUploadSizeMb,
    warnings,
  };
}

export async function getDatabricksBearerToken(): Promise<string> {
  const config = getDatabricksConfig();

  if (config.token) {
    return config.token;
  }

  throw new DatabricksError({
    code: "ERR_AUTH_FAILED",
    message: "No Databricks Personal Access Token configured in settings.",
    friendlyMessageId: "Personal Access Token Databricks belum dikonfigurasi pada menu Pengaturan.",
    friendlyMessageEn: "Databricks Personal Access Token not configured in settings.",
    suggestion: "Buka halaman Pengaturan untuk memasukkan Personal Access Token Databricks Anda.",
    statusCode: 401,
  });
}
