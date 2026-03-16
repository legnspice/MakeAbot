import { z } from "zod";
// import { User } from "@supabase/supabase-js";
// import { SelectUser } from "../db/schema";

export const userSchema = z.object({
  id: z.string().uuid({}),
  name: z.string().min(1, "Name is required").nullable(),
  phone_number: z.string().nullable(),
});

// export const CurrentUserData = z.object({ supabaseUser, publicUser });

export const findUserSchema = userSchema.omit({ phone_number: true }).partial();
export const updateUserSchema = userSchema.omit({ id: true }).partial();
export type FindUserSchema = z.infer<typeof findUserSchema>;
export type UpdateUserSchema = z.infer<typeof updateUserSchema>;
