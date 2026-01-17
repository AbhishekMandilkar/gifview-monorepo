import { z } from "zod";

const envSchema = z.object({
  VITE_SERVER_URL: z.string().url(),
});

export const env = envSchema.parse((import.meta as any).env);
