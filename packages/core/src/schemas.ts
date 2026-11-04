import { z } from "zod";
import { LIMITS } from "./config";
import {
  EMPLOYMENT_TYPES,
  LISTING_CATEGORIES,
  PAYMENT_METHODS,
  PROFILE_VISIBILITY_FIELDS,
  REPORT_TARGETS,
  REQUIREMENT_LEVELS,
  REQUIREMENT_TYPES,
  SWITCHABLE_ROLES,
  VISIBILITY_LEVELS,
  NOTIFICATION_TYPES,
} from "./domain";

const trimmed = (max: number) => z.string().trim().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT");
const postalCode = z.string().regex(/^\d{5}$/, "Fünfstellige Postleitzahl");

export const passwordSchema = z
  .string()
  .min(10, "Mindestens 10 Zeichen")
  .max(200)
  .refine((p) => /[a-zA-ZäöüÄÖÜß]/.test(p) && /\d|[^a-zA-Z0-9]/.test(p), "Bitte Buchstaben und mindestens eine Ziffer oder ein Sonderzeichen verwenden");

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ungültige E-Mail-Adresse").max(254),
  password: passwordSchema,
  username: z
    .string()
    .trim()
    .min(3, "Mindestens 3 Zeichen")
    .max(30)
    .regex(/^[a-zA-Z0-9äöüÄÖÜß._-]+$/, "Nur Buchstaben, Ziffern, Punkt, Unterstrich und Bindestrich"),
  acceptTerms: z.literal(true, { error: "Bitte AGB und Datenschutzhinweise bestätigen" }),
  initialRole: z.enum(SWITCHABLE_ROLES).default("APPLICANT"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

export const tokenSchema = z.object({ token: z.string().min(20).max(200) });
export const requestResetSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });
export const changeRoleSchema = z.object({ role: z.enum(SWITCHABLE_ROLES) });

export const profileSchema = z.object({
  username: registerSchema.shape.username,
  city: trimmed(80).optional().nullable(),
  postalCode: postalCode.optional().nullable().or(z.literal("").transform(() => null)),
  about: trimmed(1500).optional().nullable(),
  skills: z.array(trimmed(60).min(1)).max(30).default([]),
  languages: z.array(z.object({ name: trimmed(40).min(1), level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2", "MUTTERSPRACHE"]) })).max(15).default([]),
  availability: trimmed(500).optional().nullable(),
  desiredHourlyCents: z.number().int().min(0).max(100000).optional().nullable(),
  visibility: z.partialRecord(z.enum(PROFILE_VISIBILITY_FIELDS), z.enum(VISIBILITY_LEVELS)).default({}),
});

const experienceEntry = z.object({
  title: trimmed(120).min(1),
  organization: trimmed(120).optional().default(""),
  from: z.string().regex(/^\d{4}(-\d{2})?$/).optional().nullable(),
  to: z.string().regex(/^\d{4}(-\d{2})?$/).optional().nullable(),
  description: trimmed(1500).optional().default(""),
});
const educationEntry = z.object({
  title: trimmed(160).min(1),
  institution: trimmed(160).optional().default(""),
  from: z.string().regex(/^\d{4}(-\d{2})?$/).optional().nullable(),
  to: z.string().regex(/^\d{4}(-\d{2})?$/).optional().nullable(),
  qualificationId: z.string().uuid().optional().nullable(),
});

export const resumeSchema = z.object({
  headline: trimmed(160).optional().default(""),
  summary: trimmed(3000).optional().default(""),
  experience: z.array(experienceEntry).max(30).default([]),
  education: z.array(educationEntry).max(20).default([]),
});

export const resumeQualificationSchema = z.object({
  qualificationId: z.string().uuid(),
  note: trimmed(300).optional().default(""),
  documentFileId: z.string().uuid().optional().nullable(),
});

export const listingRequirementSchema = z
  .object({
    type: z.enum(REQUIREMENT_TYPES),
    level: z.enum(REQUIREMENT_LEVELS),
    qualificationId: z.string().uuid().optional().nullable(),
    text: trimmed(200).optional().nullable(),
  })
  .refine((r) => !!r.qualificationId || !!r.text?.length, "Anforderung braucht eine Qualifikation oder einen Text");

export const listingInputSchema = z
  .object({
    posterType: z.enum(["PRIVATE", "BUSINESS"]),
    title: trimmed(LIMITS.listingTitleMax).min(5, "Titel: mindestens 5 Zeichen"),
    description: trimmed(LIMITS.listingDescriptionMax).min(20, "Beschreibung: mindestens 20 Zeichen"),
    category: z.enum(LISTING_CATEGORIES),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    remote: z.boolean().default(false),
    city: trimmed(80).optional().nullable(),
    postalCode: postalCode.optional().nullable().or(z.literal("").transform(() => null)),
    startDate: isoDate.optional().nullable(),
    endDate: isoDate.optional().nullable(),
    hoursPerWeek: z.number().min(0.5).max(60).optional().nullable(),
    hoursTotal: z.number().min(0.5).max(2000).optional().nullable(),
    scheduleText: trimmed(500).optional().nullable(),
    weekend: z.boolean().default(false),
    evening: z.boolean().default(false),
    positions: z.number().int().min(1).max(LIMITS.maxPositionsPerListing),
    hourlyWageCents: z.number().int().min(1, "Stundenlohn ist Pflicht").max(100000),
    compensationNotes: trimmed(1000).optional().nullable(),
    paymentMethod: z.enum(PAYMENT_METHODS),
    paymentNotes: trimmed(500).optional().nullable(),
    requirements: z.array(listingRequirementSchema).max(20).default([]),
  })
  .superRefine((l, ctx) => {
    if (!l.remote && !l.city && !l.postalCode) ctx.addIssue({ code: "custom", path: ["city"], message: "Ort oder PLZ angeben – oder „Remote“ wählen" });
    if (l.startDate && l.endDate && l.endDate < l.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Ende liegt vor Beginn" });
    if (!l.hoursPerWeek && !l.hoursTotal) ctx.addIssue({ code: "custom", path: ["hoursPerWeek"], message: "Stundenumfang angeben (pro Woche oder gesamt)" });
    const forbiddenCash = /\b(bar|cash|bargeld|schwarz|ohne rechnung)\b/i;
    for (const key of ["paymentNotes", "compensationNotes"] as const) {
      if (l[key] && forbiddenCash.test(l[key]!)) ctx.addIssue({ code: "custom", path: [key], message: "Barzahlung bzw. Zahlung ohne Nachweis kann hier nicht angeboten werden" });
    }
  });
export type ListingInput = z.infer<typeof listingInputSchema>;

export const listingActionSchema = z.object({ action: z.enum(["publish", "pause", "resume", "close", "archive"]) });

export const applySchema = z.object({
  message: trimmed(2000).optional().default(""),
  documentFileIds: z.array(z.string().uuid()).max(5).default([]),
});

export const acceptApplicationSchema = z.object({
  feeAcknowledged: z.literal(true, { error: "Bitte den Gebührenhinweis bestätigen" }),
  feeNoticeVersion: z.string().min(1).max(40),
});

export const applicationNoteSchema = z.object({ note: trimmed(500).optional().default("") });

export const messageSchema = z.object({
  body: trimmed(LIMITS.maxMessageLength).default(""),
  attachmentFileId: z.string().uuid().optional().nullable(),
}).refine((m) => m.body.length > 0 || !!m.attachmentFileId, "Nachricht ist leer");

export const reviewSchema = z.object({ rating: z.number().int().min(1).max(5), text: trimmed(1500).optional().default("") });
export const reportSchema = z.object({ targetType: z.enum(REPORT_TARGETS), targetId: z.string().uuid(), reason: z.enum(["SPAM", "BETRUG", "BELEIDIGUNG", "DISKRIMINIERUNG", "ILLEGAL", "FALSCHE_ANGABEN", "SONSTIGES"]), details: trimmed(1500).optional().default("") });
export const disputeSchema = z.object({ reason: trimmed(1500).min(10, "Bitte kurz begründen (mind. 10 Zeichen)") });
export const cancelMediationSchema = z.object({ reason: z.enum(["NO_SHOW", "BOTH_AGREED", "OTHER"]), details: trimmed(1000).optional().default("") });

export const businessSchema = z.object({
  name: trimmed(160).min(2),
  legalForm: trimmed(60).optional().nullable(),
  street: trimmed(120).optional().nullable(),
  postalCode: postalCode.optional().nullable(),
  city: trimmed(80).optional().nullable(),
  vatId: z.string().trim().regex(/^DE\d{9}$/, "USt-IdNr. im Format DE123456789").optional().nullable().or(z.literal("").transform(() => null)),
  website: z.string().trim().url().max(200).optional().nullable().or(z.literal("").transform(() => null)),
  description: trimmed(2000).optional().nullable(),
});

export const billingAddressSchema = z.object({
  name: trimmed(160).min(2),
  street: trimmed(120).min(2),
  postalCode,
  city: trimmed(80).min(2),
});

export const notificationPrefsSchema = z.object({
  prefs: z.array(z.object({ type: z.enum(NOTIFICATION_TYPES), email: z.boolean(), push: z.boolean(), inApp: z.boolean() })).max(20),
});

export const aiChatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(LIMITS.aiMessageMax) }))
    .min(1)
    .max(20),
});

export const deleteAccountSchema = z.object({ password: z.string().min(1).max(200), confirm: z.literal("LÖSCHEN") });
export const consentSchema = z.object({ type: z.enum(["GEOLOCATION", "AI_PROCESSING", "MARKETING_EMAIL"]), granted: z.boolean() });
export const aliasSchema = z.object({ qualificationId: z.string().uuid(), alias: trimmed(120).min(2), kind: z.enum(["SYNONYM", "ABBREVIATION", "SPELLING", "COLLOQUIAL"]) });
