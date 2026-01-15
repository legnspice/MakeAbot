import { pgTable, foreignKey, serial, text, integer, timestamp, unique, pgPolicy, check, uuid } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const posts_table = pgTable("posts_table", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	content: text().notNull(),
	user_id: integer().notNull(),
	created_at: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.user_id],
			foreignColumns: [users_table.id],
			name: "posts_table_user_id_users_table_id_fk"
		}).onDelete("cascade"),
]);

export const users_table = pgTable("users_table", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	age: integer().notNull(),
	email: text().notNull(),
}, (table) => [
	unique("users_table_email_unique").on(table.email),
]);

export const profiles = pgTable("profiles", {
	id: uuid().primaryKey().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }),
	username: text(),
	full_name: text(),
	avatar_url: text(),
	website: text(),
}, (table) => [
	foreignKey({
			columns: [table.id],
			foreignColumns: [users.id],
			name: "profiles_id_fkey"
		}).onDelete("cascade"),
	unique("profiles_username_key").on(table.username),
	pgPolicy("Users can update own profile.", { as: "permissive", for: "update", to: ["public"], using: sql`(( SELECT auth.uid() AS uid) = id)` }),
	pgPolicy("Users can insert their own profile.", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Public profiles are viewable by everyone.", { as: "permissive", for: "select", to: ["public"] }),
	check("username_length", sql`char_length(username) >= 3`),
]);
