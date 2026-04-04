import { z } from "zod";
// import { User } from "@supabase/supabase-js";
// import { SelectUser } from "../db/schema";

export const userSchema = z.object({
  id: z.string().uuid({}),
  name: z.string().min(1, "Name is required").nullable(),
  id_number: z.int().nullable(),
  phone_number: z.string().nullable(),
  description: z.string().nullable(),
  contributions: z.int(),
});

// export const CurrentUserData = z.object({ supabaseUser, publicUser });

export const findUserSchema = userSchema
  .omit({ phone_number: true })
  .partial()
  .extend({
    ids: z.array(z.string().uuid()).optional(),
  });
export const updateUserSchema = userSchema.omit({ id: true }).partial();
export type FindUserSchema = z.infer<typeof findUserSchema>;
export type UpdateUserSchema = z.infer<typeof updateUserSchema>;
