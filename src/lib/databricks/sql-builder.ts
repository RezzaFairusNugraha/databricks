import { IdentifierSchema } from "./types";

/**
 * Escapes and safely quotes a SQL identifier with backticks.
 * Complies with Databricks Spark SQL identifier syntax.
 * Replaces any existing backtick with a doubled backtick.
 */
export function quoteIdentifier(rawName: string): string {
  const validated = IdentifierSchema.parse(rawName.trim());
  const escaped = validated.replace(/`/g, "``");
  return `\`${escaped}\``;
}

/**
 * Safely quotes a 2-part identifier: `catalog`.`schema`
 */
export function quoteSchema(catalog: string, schema: string): string {
  return `${quoteIdentifier(catalog)}.${quoteIdentifier(schema)}`;
}

/**
 * Safely quotes a 3-part identifier: `catalog`.`schema`.`table`
 */
export function quoteTable(
  catalog: string,
  schema: string,
  table: string
): string {
  return `${quoteIdentifier(catalog)}.${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}

/**
 * Safely quotes a 3-part volume identifier: `catalog`.`schema`.`volume`
 */
export function quoteVolume(
  catalog: string,
  schema: string,
  volume: string
): string {
  return `${quoteIdentifier(catalog)}.${quoteIdentifier(schema)}.${quoteIdentifier(volume)}`;
}

/**
 * Generates safely quoted SQL for checking connection vitality.
 */
export function buildTestQuery(): string {
  return "SELECT 1 AS alive, current_timestamp() AS ts;";
}

/**
 * Generates safely quoted SQL to list Unity Catalogs.
 */
export function buildListCatalogsQuery(): string {
  return "SHOW CATALOGS;";
}

/**
 * Generates safely quoted SQL to list schemas inside a catalog.
 */
export function buildListSchemasQuery(catalog: string): string {
  return `SHOW SCHEMAS IN ${quoteIdentifier(catalog)};`;
}

/**
 * Generates safely quoted SQL to list tables inside a schema.
 */
export function buildListTablesQuery(catalog: string, schema: string): string {
  return `SHOW TABLES IN ${quoteSchema(catalog, schema)};`;
}

/**
 * Generates safely quoted SQL to list volumes inside a schema.
 */
export function buildListVolumesQuery(catalog: string, schema: string): string {
  return `SHOW VOLUMES IN ${quoteSchema(catalog, schema)};`;
}

/**
 * Normalizes a Unity Catalog volume path:
 * e.g. /Volumes/main/csv_tidy/raw_uploads/myfile.csv
 */
export function buildVolumeFilePath(
  catalog: string,
  schema: string,
  volume: string,
  subpath: string
): string {
  const safeCatalog = IdentifierSchema.parse(catalog.trim());
  const safeSchema = IdentifierSchema.parse(schema.trim());
  const safeVolume = IdentifierSchema.parse(volume.trim());
  const cleanSubpath = subpath.replace(/^\/+/, "");
  return `/Volumes/${safeCatalog}/${safeSchema}/${safeVolume}/${cleanSubpath}`;
}
