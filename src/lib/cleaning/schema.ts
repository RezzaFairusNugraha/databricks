import { z } from "zod";

export const RenameOperationSchema = z.object({
  type: z.literal("rename"),
  source: z.string().min(1),
  target: z.string().min(1),
});

export const CastOperationSchema = z.object({
  type: z.literal("cast"),
  column: z.string().min(1),
  targetType: z.enum([
    "STRING",
    "INT",
    "BIGINT",
    "DECIMAL",
    "DOUBLE",
    "BOOLEAN",
    "DATE",
    "TIMESTAMP",
  ]),
  precision: z.number().int().min(1).max(38).optional(),
  scale: z.number().int().min(0).max(38).optional(),
});

export const TrimOperationSchema = z.object({
  type: z.literal("trim"),
  column: z.string().min(1),
  mode: z.enum(["both", "left", "right"]).optional(),
});

export const CaseChangeOperationSchema = z.object({
  type: z.literal("case_change"),
  column: z.string().min(1),
  mode: z.enum(["upper", "lower", "title"]),
});

export const ReplaceOperationSchema = z.object({
  type: z.literal("replace"),
  column: z.string().min(1),
  pattern: z.string(),
  replacement: z.string().optional(),
  isRegex: z.boolean().optional(),
});

export const ParseDateOperationSchema = z.object({
  type: z.literal("parse_date"),
  column: z.string().min(1),
  format: z.string().min(1),
  outputColumn: z.string().optional(),
});

export const ParseNumberOperationSchema = z.object({
  type: z.literal("parse_number"),
  column: z.string().min(1),
  decimalSeparator: z.enum([",", "."]).optional(),
  thousandSeparator: z.enum([".", ","]).optional(),
});

export const StripCurrencyOperationSchema = z.object({
  type: z.literal("strip_currency"),
  column: z.string().min(1),
  currency: z.string().optional(),
  decimalSeparator: z.enum([",", "."]).optional(),
});

export const MapValuesOperationSchema = z.object({
  type: z.literal("map_values"),
  column: z.string().min(1),
  mapping: z.record(z.string(), z.string()),
  defaultValue: z.string().optional(),
});

export const FillNullOperationSchema = z.object({
  type: z.literal("fill_null"),
  column: z.string().min(1),
  fillValue: z.union([z.string(), z.number(), z.boolean()]),
});

export const DropDuplicatesOperationSchema = z.object({
  type: z.literal("drop_duplicates"),
  columns: z.array(z.string().min(1)).min(1),
});

export const ParseBooleanOperationSchema = z.object({
  type: z.literal("parse_boolean"),
  column: z.string().min(1),
  trueValues: z.array(z.string()).optional(),
  falseValues: z.array(z.string()).optional(),
});

export const CleaningOperationSchema = z.discriminatedUnion("type", [
  RenameOperationSchema,
  CastOperationSchema,
  TrimOperationSchema,
  CaseChangeOperationSchema,
  ReplaceOperationSchema,
  ParseDateOperationSchema,
  ParseNumberOperationSchema,
  StripCurrencyOperationSchema,
  MapValuesOperationSchema,
  FillNullOperationSchema,
  DropDuplicatesOperationSchema,
  ParseBooleanOperationSchema,
]);

export type CleaningOperation = z.infer<typeof CleaningOperationSchema>;

export const TableTargetSchema = z.object({
  catalog: z.string().min(1),
  schema: z.string().min(1),
  table: z.string().min(1),
});

export const TargetColumnSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.enum([
    "STRING",
    "INT",
    "BIGINT",
    "DECIMAL",
    "DOUBLE",
    "BOOLEAN",
    "DATE",
    "TIMESTAMP",
  ]),
  nullable: z.boolean().default(true),
  description: z.string().optional(),
  precision: z.number().int().min(1).max(38).optional(),
  scale: z.number().int().min(0).max(38).optional(),
});
export type TargetColumn = z.infer<typeof TargetColumnSchema>;

export const ColumnMappingSourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("csv_column"),
    sourceColumn: z.string().min(1),
  }),
  z.object({
    type: z.literal("constant"),
    value: z.string(),
  }),
  z.object({
    type: z.literal("empty"),
  }),
  z.object({
    type: z.literal("split"),
    sourceColumn: z.string().min(1),
    delimiter: z.string().min(1),
    partIndex: z.number().int().min(1),
  }),
  z.object({
    type: z.literal("merge"),
    sourceColumns: z.array(z.string().min(1)).min(1),
    separator: z.string(),
  }),
]);
export type ColumnMappingSource = z.infer<typeof ColumnMappingSourceSchema>;

export const ColumnMappingItemSchema = z.object({
  targetColumnName: z.string().min(1),
  mapping: ColumnMappingSourceSchema,
});
export type ColumnMappingItem = z.infer<typeof ColumnMappingItemSchema>;

export const WriteModeSchema = z.enum(["create", "append", "overwrite", "merge"]);
export type WriteMode = z.infer<typeof WriteModeSchema>;

export const SourceOptionsSchema = z.object({
  delimiter: z.string().optional(),
  header: z.boolean().optional(),
  headerRowIndex: z.number().int().min(0).optional(),
  encoding: z.string().optional(),
});

export const CleaningPlanSchema = z.object({
  version: z.literal("1.0"),
  jobId: z.string().min(1),
  sourceVolumePath: z.string().min(1),
  sourceOptions: SourceOptionsSchema.optional(),
  targetTable: TableTargetSchema.optional(),
  quarantineTable: TableTargetSchema.optional(),
  targetColumns: z.array(TargetColumnSchema).optional(),
  columnMappings: z.array(ColumnMappingItemSchema).optional(),
  writeMode: WriteModeSchema.optional().default("create"),
  mergeKeyColumns: z.array(z.string()).optional(),
  operations: z.array(CleaningOperationSchema),
});

export type CleaningPlan = z.infer<typeof CleaningPlanSchema>;
