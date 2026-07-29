import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable(
  "logo_projects",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    brandName: text("brand_name").notNull(),
    briefJson: text("brief_json").notNull(),
    status: text("status").notNull().default("created"),
    selectedGenerationId: text("selected_generation_id"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("logo_projects_user_created_idx").on(
      table.userEmail,
      table.createdAt,
    ),
  ],
);

export const generations = sqliteTable(
  "logo_generations",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userEmail: text("user_email").notNull(),
    directionKey: text("direction_key").notNull(),
    directionTitle: text("direction_title").notNull(),
    prompt: text("prompt").notNull(),
    objectKey: text("object_key").notNull(),
    status: text("status").notNull().default("completed"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("logo_generations_project_idx").on(table.projectId),
    index("logo_generations_user_idx").on(table.userEmail),
  ],
);
