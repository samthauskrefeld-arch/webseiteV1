/** Domain enums mirrored from the Prisma schema (kept framework-free for client bundles). */

export const ROLE_TYPES = ["APPLICANT", "PRIVATE_POSTER", "BUSINESS_POSTER", "ADMIN"] as const;
export type RoleType = (typeof ROLE_TYPES)[number];
export const SWITCHABLE_ROLES = ["APPLICANT", "PRIVATE_POSTER", "BUSINESS_POSTER"] as const;
export const ROLE_LABELS: Record<RoleType, string> = {
  APPLICANT: "Bewerber",
  PRIVATE_POSTER: "Privat",
  BUSINESS_POSTER: "Gewerblich",
  ADMIN: "Administration",
};

export const LISTING_CATEGORIES = [
  "GARTEN",
  "HAUSHALT",
  "EINKAUF",
  "NACHHILFE",
  "EVENT",
  "GASTRONOMIE",
  "BUERO",
  "HANDWERK",
  "BETREUUNG",
  "LOGISTIK",
  "IT",
  "SONSTIGES",
] as const;
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];
export const CATEGORY_LABELS: Record<ListingCategory, string> = {
  GARTEN: "Gartenarbeit",
  HAUSHALT: "Haushalt",
  EINKAUF: "Einkaufshilfe",
  NACHHILFE: "Nachhilfe",
  EVENT: "Eventhilfe",
  GASTRONOMIE: "Gastronomie",
  BUERO: "Büro",
  HANDWERK: "Handwerk",
  BETREUUNG: "Betreuung",
  LOGISTIK: "Logistik & Umzug",
  IT: "IT & Technik",
  SONSTIGES: "Sonstiges",
};

export const EMPLOYMENT_TYPES = [
  "MINIJOB",
  "TEILZEIT",
  "VOLLZEIT",
  "BEFRISTET",
  "EINMALIG",
  "PROJEKT",
  "AUSBILDUNG",
  "PRAKTIKUM",
  "WERKSTUDENT",
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  MINIJOB: "Minijob",
  TEILZEIT: "Teilzeit",
  VOLLZEIT: "Vollzeit",
  BEFRISTET: "Befristet",
  EINMALIG: "Einmaliger Auftrag",
  PROJEKT: "Projekt",
  AUSBILDUNG: "Ausbildung",
  PRAKTIKUM: "Praktikum",
  WERKSTUDENT: "Werkstudent",
};
/** Private posters may only offer these forms (others need a business profile). */
export const PRIVATE_EMPLOYMENT_TYPES: EmploymentType[] = ["EINMALIG", "MINIJOB", "BEFRISTET", "PROJEKT"];

export const QUALIFICATION_KINDS = [
  "AUSBILDUNGSBERUF",
  "BERUF",
  "STUDIENFACH",
  "MEISTER_FORTBILDUNG",
  "ZERTIFIKAT",
] as const;
export type QualificationKind = (typeof QUALIFICATION_KINDS)[number];
export const QUALIFICATION_KIND_LABELS: Record<QualificationKind, string> = {
  AUSBILDUNGSBERUF: "Ausbildungsberuf",
  BERUF: "Berufsbezeichnung",
  STUDIENFACH: "Studienfach",
  MEISTER_FORTBILDUNG: "Meister/Fortbildung",
  ZERTIFIKAT: "Zertifikat",
};

export const REQUIREMENT_TYPES = ["AUSBILDUNG", "STUDIUM", "MEISTER", "ZERTIFIKAT", "ERFAHRUNG", "FAEHIGKEIT", "SPRACHE", "FUEHRERSCHEIN"] as const;
export type RequirementType = (typeof REQUIREMENT_TYPES)[number];
export const REQUIREMENT_LABELS: Record<RequirementType, string> = {
  AUSBILDUNG: "Ausbildung",
  STUDIUM: "Studium",
  MEISTER: "Meister/Fortbildung",
  ZERTIFIKAT: "Zertifikat",
  ERFAHRUNG: "Erfahrung",
  FAEHIGKEIT: "Fähigkeit",
  SPRACHE: "Sprache",
  FUEHRERSCHEIN: "Führerschein",
};
export const REQUIREMENT_LEVELS = ["REQUIRED", "PREFERRED"] as const;
export type RequirementLevel = (typeof REQUIREMENT_LEVELS)[number];

export const PAYMENT_METHODS = ["BANK_TRANSFER", "PAYPAL", "OTHER_CASHLESS"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Überweisung",
  PAYPAL: "PayPal",
  OTHER_CASHLESS: "Andere bargeldlose Zahlung",
};

export const LISTING_STATUSES = ["DRAFT", "PUBLISHED", "PAUSED", "CLOSED", "ARCHIVED"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: "Entwurf",
  PUBLISHED: "Veröffentlicht",
  PAUSED: "Pausiert",
  CLOSED: "Geschlossen",
  ARCHIVED: "Archiviert",
};
export type ListingAction = "publish" | "pause" | "resume" | "close" | "archive";
const LISTING_TRANSITIONS: Record<ListingAction, { from: ListingStatus[]; to: ListingStatus }> = {
  publish: { from: ["DRAFT"], to: "PUBLISHED" },
  pause: { from: ["PUBLISHED"], to: "PAUSED" },
  resume: { from: ["PAUSED"], to: "PUBLISHED" },
  close: { from: ["PUBLISHED", "PAUSED"], to: "CLOSED" },
  archive: { from: ["DRAFT", "CLOSED"], to: "ARCHIVED" },
};
export function nextListingStatus(current: ListingStatus, action: ListingAction): ListingStatus | null {
  const t = LISTING_TRANSITIONS[action];
  return t.from.includes(current) ? t.to : null;
}

export const APPLICATION_STATUSES = ["submitted", "viewed", "shortlisted", "accepted", "rejected", "withdrawn"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: "Gesendet",
  viewed: "Angesehen",
  shortlisted: "In der engeren Wahl",
  accepted: "Zusage erhalten",
  rejected: "Abgesagt",
  withdrawn: "Zurückgezogen",
};
type AppActor = "applicant" | "poster" | "system";
const APPLICATION_TRANSITIONS: Array<{ from: ApplicationStatus[]; to: ApplicationStatus; by: AppActor }> = [
  { from: ["submitted"], to: "viewed", by: "poster" },
  { from: ["submitted", "viewed"], to: "shortlisted", by: "poster" },
  { from: ["submitted", "viewed", "shortlisted"], to: "accepted", by: "poster" },
  { from: ["submitted", "viewed", "shortlisted"], to: "rejected", by: "poster" },
  { from: ["submitted", "viewed", "shortlisted"], to: "withdrawn", by: "applicant" },
  // Offer declined/expired/cancelled before a fee arose -> back to rejected
  { from: ["accepted"], to: "rejected", by: "system" },
  { from: ["accepted"], to: "withdrawn", by: "applicant" },
];
export function canTransitionApplication(from: ApplicationStatus, to: ApplicationStatus, by: AppActor): boolean {
  return APPLICATION_TRANSITIONS.some((t) => t.to === to && t.by === by && t.from.includes(from));
}

/**
 * Mediation lifecycle — deliberately separate from the application status:
 *  - Application "accepted": poster gave a binding, fee-acknowledged offer (no fee yet).
 *  - Mediation CONFIRMED: applicant accepted the offer → placement happened → fee event (exactly once).
 *  - COMPLETED: both sides marked the job as done → reviews unlocked.
 */
export const MEDIATION_STATUSES = ["PENDING_APPLICANT", "CONFIRMED", "DECLINED", "EXPIRED", "WITHDRAWN_BY_POSTER", "CANCELLED", "COMPLETED"] as const;
export type MediationStatus = (typeof MEDIATION_STATUSES)[number];
export const MEDIATION_STATUS_LABELS: Record<MediationStatus, string> = {
  PENDING_APPLICANT: "Wartet auf Bestätigung der Person",
  CONFIRMED: "Vermittlung bestätigt",
  DECLINED: "Von der Person abgelehnt",
  EXPIRED: "Abgelaufen",
  WITHDRAWN_BY_POSTER: "Zusage zurückgenommen",
  CANCELLED: "Storniert (Gebühr erstattet)",
  COMPLETED: "Auftrag abgeschlossen",
};
/** Statuses that occupy one of the listing's positions. */
export const SLOT_OCCUPYING: MediationStatus[] = ["PENDING_APPLICANT", "CONFIRMED", "COMPLETED"];
/** Statuses that are fee-relevant (a fee event exists). */
export const FEE_BEARING: MediationStatus[] = ["CONFIRMED", "COMPLETED"];

export const REPORT_TARGETS = ["LISTING", "USER", "MESSAGE", "REVIEW"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const VISIBILITY_LEVELS = ["PUBLIC", "APPLICATIONS", "PRIVATE"] as const;
export type Visibility = (typeof VISIBILITY_LEVELS)[number];
export const VISIBILITY_LABELS: Record<Visibility, string> = {
  PUBLIC: "Öffentlich",
  APPLICATIONS: "Nur bei Bewerbungen",
  PRIVATE: "Nur ich",
};
export const PROFILE_VISIBILITY_FIELDS = ["region", "experience", "education", "qualifications", "languages", "availability", "desiredWage", "documents"] as const;
export type ProfileVisibilityField = (typeof PROFILE_VISIBILITY_FIELDS)[number];

export const NOTIFICATION_TYPES = [
  "APPLICATION_RECEIVED",
  "APPLICATION_STATUS",
  "OFFER_RECEIVED",
  "OFFER_RESPONSE",
  "MESSAGE",
  "INVOICE",
  "REVIEW",
  "SYSTEM",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  APPLICATION_RECEIVED: "Neue Bewerbungen",
  APPLICATION_STATUS: "Status meiner Bewerbungen",
  OFFER_RECEIVED: "Zusagen für mich",
  OFFER_RESPONSE: "Antworten auf meine Zusagen",
  MESSAGE: "Nachrichten",
  INVOICE: "Rechnungen",
  REVIEW: "Bewertungen",
  SYSTEM: "Konto & Sicherheit",
};
