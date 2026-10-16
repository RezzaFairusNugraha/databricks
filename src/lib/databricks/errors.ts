import { DatabricksError } from "./types";

export function mapDatabricksError(error: unknown): DatabricksError {
  if (error instanceof DatabricksError) {
    return error;
  }

  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown Databricks error";
  const lowerMsg = message.toLowerCase();

  // 1. Permission Denied
  if (
    lowerMsg.includes("permission_denied") ||
    lowerMsg.includes("access_denied") ||
    lowerMsg.includes("does not have privilege") ||
    lowerMsg.includes("forbidden") ||
    lowerMsg.includes("403")
  ) {
    return new DatabricksError({
      code: "ERR_PERMISSION_DENIED",
      message,
      friendlyMessageId:
        "Izin ditolak oleh Databricks Unity Catalog. Pengguna atau Service Principal tidak memiliki hak akses yang cukup.",
      friendlyMessageEn:
        "Permission denied by Databricks Unity Catalog. The user or service principal lacks required privileges.",
      suggestion:
        "Jalankan SQL Grant: USE CATALOG, USE SCHEMA, READ/WRITE VOLUME, atau CAN_USE ON SQL WAREHOUSE.",
      statusCode: 403,
      rawDetails: error,
    });
  }

  // 2. Authentication Failure
  if (
    lowerMsg.includes("unauthorized") ||
    lowerMsg.includes("invalid token") ||
    lowerMsg.includes("expired") ||
    lowerMsg.includes("invalid_client") ||
    lowerMsg.includes("401")
  ) {
    return new DatabricksError({
      code: "ERR_AUTH_FAILED",
      message,
      friendlyMessageId:
        "Autentikasi gagal. Token akses Databricks tidak valid atau masa berlakunya telah habis.",
      friendlyMessageEn:
        "Authentication failed. Databricks access token is invalid or has expired.",
      suggestion:
        "Periksa nilai DATABRICKS_TOKEN atau DATABRICKS_CLIENT_ID / CLIENT_SECRET pada file .env.local Anda.",
      statusCode: 401,
      rawDetails: error,
    });
  }

  // 3. Warehouse Starting / Stopped
  if (
    lowerMsg.includes("starting") ||
    lowerMsg.includes("warehouse is starting") ||
    lowerMsg.includes("warehouse_starting") ||
    lowerMsg.includes("temporarily unavailable")
  ) {
    return new DatabricksError({
      code: "ERR_WAREHOUSE_STARTING",
      message,
      friendlyMessageId:
        "SQL Warehouse sedang booting/memulai komputasi. Tunggu beberapa detik, sistem akan mengulang otomatis.",
      friendlyMessageEn:
        "SQL Warehouse is currently booting up. Please wait a moment, the system is retrying automatically.",
      suggestion:
        "Databricks Serverless / Classic SQL Warehouse membutuhkan waktu 10-60 detik untuk pemanasan dingin.",
      statusCode: 503,
      rawDetails: error,
    });
  }

  if (
    lowerMsg.includes("stopped") ||
    lowerMsg.includes("warehouse is stopped")
  ) {
    return new DatabricksError({
      code: "ERR_WAREHOUSE_STOPPED",
      message,
      friendlyMessageId:
        "SQL Warehouse saat ini dalam kondisi berhenti (STOPPED).",
      friendlyMessageEn: "SQL Warehouse is currently in STOPPED state.",
      suggestion:
        "Jalankan atau aktifkan warehouse melalui Databricks Console atau panggil API Start Warehouse.",
      statusCode: 503,
      rawDetails: error,
    });
  }

  // 4. Schema Not Found
  if (
    lowerMsg.includes("schema_not_found") ||
    lowerMsg.includes("database_not_found") ||
    (lowerMsg.includes("schema") && lowerMsg.includes("not found"))
  ) {
    return new DatabricksError({
      code: "ERR_SCHEMA_NOT_FOUND",
      message,
      friendlyMessageId:
        "Skema (Schema) tidak ditemukan di dalam Katalog Unity Catalog yang dipilih.",
      friendlyMessageEn:
        "Schema was not found inside the selected Unity Catalog.",
      suggestion:
        "Buat skema terlebih dahulu dengan perintah: CREATE SCHEMA IF NOT EXISTS <catalog>.<schema>;",
      statusCode: 404,
      rawDetails: error,
    });
  }

  // 5. Catalog Not Found
  if (
    lowerMsg.includes("catalog_not_found") ||
    (lowerMsg.includes("catalog") && lowerMsg.includes("not found"))
  ) {
    return new DatabricksError({
      code: "ERR_CATALOG_NOT_FOUND",
      message,
      friendlyMessageId: "Katalog Unity Catalog tidak ditemukan.",
      friendlyMessageEn: "Unity Catalog was not found in the workspace.",
      suggestion:
        "Pastikan nama katalog di konfigurasi (DATABRICKS_DEFAULT_CATALOG) sesuai dengan katalog yang ada di workspace.",
      statusCode: 404,
      rawDetails: error,
    });
  }

  // 6. Volume Not Found
  if (
    lowerMsg.includes("volume") &&
    (lowerMsg.includes("not found") || lowerMsg.includes("does not exist"))
  ) {
    return new DatabricksError({
      code: "ERR_VOLUME_NOT_FOUND",
      message,
      friendlyMessageId: "Volume Unity Catalog tujuan tidak ditemukan.",
      friendlyMessageEn:
        "Target Unity Catalog Volume was not found in the workspace.",
      suggestion:
        "Buat volume terlebih dahulu dengan perintah: CREATE VOLUME IF NOT EXISTS <catalog>.<schema>.<volume>;",
      statusCode: 404,
      rawDetails: error,
    });
  }

  // Default / Unknown error
  return new DatabricksError({
    code: "ERR_UNKNOWN",
    message,
    friendlyMessageId: `Terjadi kesalahan saat berkomunikasi dengan Databricks: ${message}`,
    friendlyMessageEn: `An unexpected error occurred while communicating with Databricks: ${message}`,
    statusCode: 500,
    rawDetails: error,
  });
}
