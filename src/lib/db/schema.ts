import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const templates = sqliteTable("templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  targetTableName: text("target_table_name").notNull().default("cleaned_table"),
  configJson: text("config_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const jobExecutions = sqliteTable("job_executions", {
  id: text("id").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  targetCatalog: text("target_catalog").notNull(),
  targetSchema: text("target_schema").notNull(),
  targetTable: text("target_table").notNull(),
  writeMode: text("write_mode").notNull().default("create"),
  status: text("status").notNull().default("pending"),
  cleanStatementId: text("clean_statement_id"),
  quarantineStatementId: text("quarantine_statement_id"),
  rowsClean: integer("rows_clean").default(0),
  rowsQuarantine: integer("rows_quarantine").default(0),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type TemplateRecord = typeof templates.$inferSelect;
export type NewTemplateRecord = typeof templates.$inferInsert;
export type JobExecutionRecord = typeof jobExecutions.$inferSelect;
export type NewJobExecutionRecord = typeof jobExecutions.$inferInsert;
