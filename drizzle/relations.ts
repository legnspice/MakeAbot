import { relations } from "drizzle-orm/relations";
import { users_table, posts_table, usersInAuth, profiles } from "./schema";

export const posts_tableRelations = relations(posts_table, ({one}) => ({
	users_table: one(users_table, {
		fields: [posts_table.user_id],
		references: [users_table.id]
	}),
}));

export const users_tableRelations = relations(users_table, ({many}) => ({
	posts_tables: many(posts_table),
}));

export const profilesRelations = relations(profiles, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [profiles.id],
		references: [usersInAuth.id]
	}),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	profiles: many(profiles),
}));