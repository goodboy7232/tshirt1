import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable(
	"users",
	{
		id: text("id").primaryKey(),
		email: text("email").notNull(),
		passwordHash: text("password_hash").notNull(),
		role: text("role").notNull().default("customer"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessions = pgTable(
	"sessions",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index("sessions_user_id_idx").on(table.userId), index("sessions_expires_at_idx").on(table.expiresAt)],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;