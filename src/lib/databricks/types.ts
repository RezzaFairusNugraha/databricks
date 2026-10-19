import { z } from "zod";

export type AuthMode = "pat" | "oauth_m2m" | "unconfigured";

export interface DatabricksConfig {
  host: string;
  warehouseId: string;
  token?: string;
  clientId?: string;
  clientSecret?: string;
  defaultCatalog: string;
  defaultSchema: string;
  defaultVolume: string;
  maxUploadSizeMb: number;
}

export interface ConfigStatus {
  isConfigured: boolean;
  host: string;
  maskedHost: string;
  warehouseId: string;
  maskedWarehouseId: string;
  authMode: AuthMode;
  defaultCatalog: string;
  defaultSchema: string;
  defaultVolume: string;
  volumePath: string;
  maxUploadSizeMb: number;
  warnings: string[];
}

export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  warehouseStatus?: "RUNNING" | "STARTING" | "STOPPED" | "STOPPING" | "DELETING" | "UNKNOWN";
  warehouseName?: string;
  userOrPrincipal?: string;
  catalogCount?: number;
  message: string;
  suggestion?: string;
  failedStep?: "url" | "token" | "warehouse" | "target" | "permission" | "unknown";
  diagnostics: Array<{
    step: string;
    status: "success" | "warning" | "error";
    detail: string;
    action?: string;
  }>;
  error?: string;
}

export interface SqlColumn {
  name: string;
  type_name: string;
  type_text?: string;
  position: number;
}

export interface SqlStatementResult {
  statementId: string;
  status: "SUCCEEDED" | "FAILED" | "CANCELED" | "CLOSED" | "PENDING" | "RUNNING";
  columns: SqlColumn[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  executionDurationMs?: number;
}

export interface CatalogItem {
  name: string;
  comment?: string;
  owner?: string;
}

export interface SchemaItem {
  name: string;
  catalog: string;
  comment?: string;
}

export interface TableItem {
  name: string;
  schema: string;
  catalog: string;
  tableType?: string;
}

export interface UploadResult {
  jobId: string;
  fileName: string;
  fileSize?: number;
  volumeFilePath: string;
  fullVolumePath: string;
  catalog: string;
  schema: string;
  volume: string;
  uploadedAt: string;
  status: "uploaded" | "failed";
}

export const IdentifierSchema = z
  .string()
  .min(1, "Identifier cannot be empty")
  .max(255, "Identifier too long");

export type DatabricksErrorCode =
  | "ERR_AUTH_FAILED"
  | "ERR_PERMISSION_DENIED"
  | "ERR_WAREHOUSE_STARTING"
  | "ERR_WAREHOUSE_STOPPED"
  | "ERR_SCHEMA_NOT_FOUND"
  | "ERR_CATALOG_NOT_FOUND"
  | "ERR_VOLUME_NOT_FOUND"
  | "ERR_FILE_TOO_LARGE"
  | "ERR_TIMEOUT"
  | "ERR_UNKNOWN";

export class DatabricksError extends Error {
  code: DatabricksErrorCode;
  statusCode?: number;
  friendlyMessageId: string;
  friendlyMessageEn: string;
  suggestion?: string;
  rawDetails?: unknown;

  constructor(params: {
    code: DatabricksErrorCode;
    message: string;
    friendlyMessageId: string;
    friendlyMessageEn: string;
    suggestion?: string;
    statusCode?: number;
    rawDetails?: unknown;
  }) {
    super(params.message);
    this.name = "DatabricksError";
    this.code = params.code;
    this.friendlyMessageId = params.friendlyMessageId;
    this.friendlyMessageEn = params.friendlyMessageEn;
    this.suggestion = params.suggestion;
    this.statusCode = params.statusCode;
    this.rawDetails = params.rawDetails;
  }
}
