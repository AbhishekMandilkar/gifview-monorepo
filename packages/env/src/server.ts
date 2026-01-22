import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  CORS_ORIGIN: z.string().url(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  OPENAI_API_KEY: z.string().min(1),
  // GIF Providers
  GIPHY_API_KEY: z.string().min(1),
  TENOR_API_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
