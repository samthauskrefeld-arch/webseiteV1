import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32).default("dev-only-insecure-session-secret-change-me!!"),
  REDIS_URL: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("eu-central-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.string().optional(),
  STORAGE_DIR: z.string().optional(),
  CLAMAV_HOST: z.string().optional(),
  CLAMAV_PORT: z.coerce.number().default(3310),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("My Minijob <no-reply@example.invalid>"),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:kontakt@example.invalid"),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-haiku-5-5"),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(100).max(4000).default(800),
  PAYMENT_PROVIDER: z.enum(["test"]).default("test"),
  INVOICE_TAX_MODE: z.enum(["REGULAR", "KLEINUNTERNEHMER"]).default("REGULAR"),
  OPERATOR_NAME: z.string().default("[Betreibername eintragen]"),
  OPERATOR_ADDRESS: z.string().default("[Straße Nr., PLZ Ort]"),
  OPERATOR_VAT_ID: z.string().default("[USt-IdNr. oder Steuernummer]"),
  OPERATOR_EMAIL: z.string().default("[kontakt@domain.de]"),
  OPERATOR_IBAN: z.string().default("[IBAN]"),
});

export type Env = z.infer<typeof schema>;
let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.parse(process.env);
  if (parsed.NODE_ENV === "production" && parsed.SESSION_SECRET.startsWith("dev-only")) {
    throw new Error("SESSION_SECRET muss in Produktion gesetzt sein");
  }
  cached = parsed;
  return cached;
}

export const isProd = () => env().NODE_ENV === "production";
