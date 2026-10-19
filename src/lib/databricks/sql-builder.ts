import { IdentifierSchema } from "./types";

export function quoteIdentifier(rawName: string): string {
  const validated = IdentifierSchema.parse(rawName.trim());
  const escaped = validated.replace(/`/g, "``");
  return `\`${escaped}\``;
}

export function quoteSchema(catalog: string, schema: string): string {
  return `${quoteIdentifier(catalog)}.${quoteIdentifier(schema)}`;
}

export function quoteTable(
  catalog: string,
  schema: string,
  table: string
): string {
  return `${quoteIdentifier(catalog)}.${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}

export function quoteVolume(
  catalog: string,
  schema: string,
  volume: string
): string {
  return `${quoteIdentifier(catalog)}.${quoteIdentifier(schema)}.${quoteIdentifier(volume)}`;
}

export function buildTestQuery(): string {
  return "SELECT 1 AS alive, current_timestamp() AS ts;";
}

export function buildListCatalogsQuery(): string {
  return "SHOW CATALOGS;";
}

export function buildListSchemasQuery(catalog: string): string {
  return `SHOW SCHEMAS IN ${quoteIdentifier(catalog)};`;
}

export function buildListTablesQuery(catalog: string, schema: string): string {
  return `SHOW TABLES IN ${quoteSchema(catalog, schema)};`;
}

export function buildListVolumesQuery(catalog: string, schema: string): string {
  return `SHOW VOLUMES IN ${quoteSchema(catalog, schema)};`;
}

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

export function buildProfileQuery(
  volumeFilePath: string,
  options: {
    delimiter?: string;
    header?: boolean;
    columns?: string[];
  } = {}
): string {
  const cleanPath = volumeFilePath.replace(/'/g, "''");
  const delimiter = (options.delimiter || ",").replace(/'/g, "''");
  const header = options.header !== false;

  const columnAggregations = (options.columns || []).map((col) => {
    const qCol = quoteIdentifier(col);
    const safeColName = col.replace(/`/g, "``");
    return `COUNT_IF(${qCol} IS NULL OR TRIM(CAST(${qCol} AS STRING)) = '') AS \`null_count_${safeColName}\`, COUNT(DISTINCT ${qCol}) AS \`distinct_count_${safeColName}\``;
  });

  const selectList = [
    "COUNT(*) AS total_rows",
    ...columnAggregations,
  ].join(",\n  ");

  return `SELECT
  ${selectList}
FROM read_files(
  '${cleanPath}',
  format => 'csv',
  header => ${header ? "true" : "false"},
  delimiter => '${delimiter}'
);`;
}

export function buildSampleRowsQuery(
  volumeFilePath: string,
  options: {
    delimiter?: string;
    header?: boolean;
    limit?: number;
  } = {}
): string {
  const cleanPath = volumeFilePath.replace(/'/g, "''");
  const delimiter = (options.delimiter || ",").replace(/'/g, "''");
  const header = options.header !== false;
  const limit = Math.min(Math.max(options.limit || 50, 1), 1000);

  return `SELECT *
FROM read_files(
  '${cleanPath}',
  format => 'csv',
  header => ${header ? "true" : "false"},
  delimiter => '${delimiter}'
)
LIMIT ${limit};`;
}
