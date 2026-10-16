import { AuthMode, ConfigStatus, DatabricksConfig, DatabricksError } from "./types";

let cachedOAuthToken: { token: string; expiresAt: number } | null = null;

export function getDatabricksConfig(): DatabricksConfig {
  const rawHost = process.env.DATABRICKS_HOST || "";
  const warehouseId = process.env.DATABRICKS_WAREHOUSE_ID || "";
  const token = process.env.DATABRICKS_TOKEN || "";
  const clientId = process.env.DATABRICKS_CLIENT_ID || "";
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET || "";

  const defaultCatalog = process.env.DATABRICKS_DEFAULT_CATALOG || "main";
  const defaultSchema = process.env.DATABRICKS_DEFAULT_SCHEMA || "csv_tidy";
  const defaultVolume = process.env.DATABRICKS_DEFAULT_VOLUME || "raw_uploads";

  const maxUploadSizeMb = parseInt(
    process.env.MAX_UPLOAD_SIZE_MB || "500",
    10
  );

  let host = rawHost.trim();
  if (host && !host.startsWith("http://") && !host.startsWith("https://")) {
    host = `https://${host}`;
  }
  host = host.replace(/\/+$/, "");

  return {
    host,
    warehouseId: warehouseId.trim(),
    token: token.trim(),
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    defaultCatalog: defaultCatalog.trim(),
    defaultSchema: defaultSchema.trim(),
    defaultVolume: defaultVolume.trim(),
    maxUploadSizeMb: isNaN(maxUploadSizeMb) ? 500 : maxUploadSizeMb,
  };
}

export function getAuthMode(config: DatabricksConfig): AuthMode {
  if (config.token) return "pat";
  if (config.clientId && config.clientSecret) return "oauth_m2m";
  return "unconfigured";
}

export function getConfigStatus(): ConfigStatus {
  const config = getDatabricksConfig();
  const authMode = getAuthMode(config);
  const warnings: string[] = [];

  if (!config.host) {
    warnings.push("DATABRICKS_HOST belum dikonfigurasi di environment variables.");
  }
  if (!config.warehouseId) {
    warnings.push("DATABRICKS_WAREHOUSE_ID belum ditentukan.");
  }
  if (authMode === "unconfigured") {
    warnings.push("Kredensial autentikasi (DATABRICKS_TOKEN atau DATABRICKS_CLIENT_ID/SECRET) belum diatur.");
  }

  const maskString = (str: string, keepStart = 4, keepEnd = 3) => {
    if (!str) return "Tidak Dikonfigurasi";
    if (str.length <= keepStart + keepEnd) return "••••••••";
    return `${str.substring(0, keepStart)}••••${str.substring(str.length - keepEnd)}`;
  };

  const maskedHost = config.host
    ? config.host.replace(/^(https?:\/\/)?([^.]+)/, (match, p1, p2) => {
        return `${p1 || "https://"}${p2.substring(0, 4)}••••`;
      })
    : "Belum Dikonfigurasi";

  const volumePath = `/Volumes/${config.defaultCatalog}/${config.defaultSchema}/${config.defaultVolume}`;

  return {
    isConfigured: !!(config.host && config.warehouseId && authMode !== "unconfigured"),
    host: config.host,
    maskedHost,
    warehouseId: config.warehouseId,
    maskedWarehouseId: maskString(config.warehouseId, 4, 3),
    authMode,
    defaultCatalog: config.defaultCatalog,
    defaultSchema: config.defaultSchema,
    defaultVolume: config.defaultVolume,
    volumePath,
    maxUploadSizeMb: config.maxUploadSizeMb,
    warnings,
  };
}

/**
 * Retrieves the active bearer token.
 * If configured with OAuth M2M (client ID & secret), it fetches an access token
 * from the Databricks OIDC endpoint and caches it until expiry.
 */
export async function getDatabricksBearerToken(): Promise<string> {
  const config = getDatabricksConfig();
  const authMode = getAuthMode(config);

  if (authMode === "pat" && config.token) {
    return config.token;
  }

  if (authMode === "oauth_m2m" && config.clientId && config.clientSecret) {
    const now = Date.now();
    if (cachedOAuthToken && cachedOAuthToken.expiresAt > now + 60_000) {
      return cachedOAuthToken.token;
    }

    try {
      const tokenEndpoint = `${config.host}/oidc/v1/token`;
      const basicAuth = Buffer.from(
        `${config.clientId}:${config.clientSecret}`
      ).toString("base64");

      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: "all-apis",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new DatabricksError({
          code: "ERR_AUTH_FAILED",
          message: `OAuth M2M token request failed: ${response.status} ${errorText}`,
          friendlyMessageId: "Gagal mendapatkan token autentikasi OAuth M2M dari Databricks.",
          friendlyMessageEn: "Failed to obtain OAuth M2M token from Databricks OIDC provider.",
          statusCode: response.status,
        });
      }

      const data = (await response.json()) as {
        access_token: string;
        expires_in: number;
      };

      cachedOAuthToken = {
        token: data.access_token,
        expiresAt: now + (data.expires_in || 3600) * 1000,
      };

      return data.access_token;
    } catch (err) {
      if (err instanceof DatabricksError) throw err;
      throw new DatabricksError({
        code: "ERR_AUTH_FAILED",
        message: err instanceof Error ? err.message : "OAuth M2M error",
        friendlyMessageId: "Gagal menghubungi endpoint OAuth Databricks.",
        friendlyMessageEn: "Failed to connect to Databricks OAuth endpoint.",
        statusCode: 401,
      });
    }
  }

  throw new DatabricksError({
    code: "ERR_AUTH_FAILED",
    message: "No Databricks credentials configured in server environment variables.",
    friendlyMessageId: "Kredensial Databricks tidak ditemukan pada environment variables server.",
    friendlyMessageEn: "Databricks credentials not configured in server environment variables.",
    statusCode: 401,
  });
}
