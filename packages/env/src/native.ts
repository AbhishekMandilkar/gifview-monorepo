import { z } from "zod";

const envSchema = z.object({
  EXPO_PUBLIC_SERVER_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
