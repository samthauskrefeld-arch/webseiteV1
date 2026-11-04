import "server-only";
import type { z } from "zod";
import { PROFILE_VISIBILITY_FIELDS, type ProfileVisibilityField, type Visibility, profileSchema, resumeSchema } from "@myminijob/core";
import { audit } from "../audit";
import { db } from "../db";
import { ApiError, notFound } from "../errors";
import { resolvePlace } from "./catalog";

export const DEFAULT_VISIBILITY: Record<ProfileVisibilityField, Visibility> = {
  region: "PUBLIC",
  experience: "APPLICATIONS",
  education: "APPLICATIONS",
  qualifications: "APPLICATIONS",
  languages: "APPLICATIONS",
  availability: "APPLICATIONS",
  desiredWage: "PRIVATE",
  documents: "APPLICATIONS",
};

export function effectiveVisibility(raw: unknown): Record<ProfileVisibilityField, Visibility> {
  const v = { ...DEFAULT_VISIBILITY };
  if (raw && typeof raw === "object") {
    for (const f of PROFILE_VISIBILITY_FIELDS) {
      const val = (raw as Record<string, unknown>)[f];
      if (val === "PUBLIC" || val === "APPLICATIONS" || val === "PRIVATE") v[f] = val;
    }
  }
  return v;
}

export async function getMyProfile(userId: string) {
  const [profile, resume] = await Promise.all([
    db().profile.findUnique({ where: { userId } }),
    db().resume.findUnique({
      where: { userId },
      include: { qualifications: { include: { qualification: { select: { id: true, name: true, kind: true, isOfficial: true } }, documentFile: { select: { id: true, originalName: true } } }, orderBy: { createdAt: "asc" } } },
    }),
  ]);
  if (!profile || !resume) throw notFound("Profil");
  return { profile: { ...profile, visibility: effectiveVisibility(profile.visibility) }, resume };
}

export async function updateProfile(userId: string, input: z.infer<typeof profileSchema>) {
  const taken = await db().profile.findFirst({ where: { username: input.username, NOT: { userId } } });
  if (taken) throw new ApiError("CONFLICT", "Benutzername ist vergeben", { username: "Benutzername ist vergeben" });
  const place = await resolvePlace(input.postalCode || input.city);
  await db().profile.update({
    where: { userId },
    data: {
      username: input.username,
      city: input.city ?? place?.name ?? null,
      postalCode: input.postalCode ?? null,
      lat: place?.lat ?? null,
      lng: place?.lng ?? null,
      about: input.about ?? null,
      skills: input.skills,
      languages: input.languages,
      availability: input.availability ?? null,
      desiredHourlyCents: input.desiredHourlyCents ?? null,
      visibility: effectiveVisibility(input.visibility),
    },
  });
  return getMyProfile(userId);
}

export async function updateResume(userId: string, input: z.infer<typeof resumeSchema>) {
  const ids = input.education.map((e) => e.qualificationId).filter((x): x is string => !!x);
  if (ids.length) {
    const found = await db().qualification.count({ where: { id: { in: ids }, active: true } });
    if (found !== new Set(ids).size) throw new ApiError("VALIDATION", "Unbekannte Qualifikation im Bildungsweg");
  }
  await db().resume.update({ where: { userId }, data: { headline: input.headline, summary: input.summary, experience: input.experience, education: input.education } });
  return getMyProfile(userId);
}

/** Adds a catalog qualification as SELF_DECLARED (or PENDING_REVIEW with proof). Never auto-verified. */
export async function addResumeQualification(userId: string, qualificationId: string, note: string, documentFileId?: string | null) {
  const resume = await db().resume.findUniqueOrThrow({ where: { userId } });
  const q = await db().qualification.findFirst({ where: { id: qualificationId, active: true } });
  if (!q) throw notFound("Qualifikation");
  if (documentFileId) {
    const f = await db().uploadedFile.findFirst({ where: { id: documentFileId, ownerId: userId, deletedAt: null } });
    if (!f) throw notFound("Nachweis");
  }
  return db().resumeQualification.upsert({
    where: { resumeId_qualificationId: { resumeId: resume.id, qualificationId } },
    create: { resumeId: resume.id, qualificationId, note, documentFileId: documentFileId ?? null, status: documentFileId ? "PENDING_REVIEW" : "SELF_DECLARED" },
    update: { note, ...(documentFileId ? { documentFileId, status: "PENDING_REVIEW" } : {}) },
  });
}

export async function removeResumeQualification(userId: string, entryId: string) {
  const r = await db().resumeQualification.findFirst({ where: { id: entryId, resume: { userId } } });
  if (!r) throw notFound("Eintrag");
  await db().resumeQualification.delete({ where: { id: entryId } });
}

export async function verifyResumeQualification(adminId: string, entryId: string, approve: boolean) {
  const r = await db().resumeQualification.findUnique({ where: { id: entryId } });
  if (!r) throw notFound("Eintrag");
  if (approve && !r.documentFileId) throw new ApiError("BAD_REQUEST", "Ohne Nachweis kann nicht verifiziert werden.");
  await db().resumeQualification.update({ where: { id: entryId }, data: approve ? { status: "VERIFIED", verifiedAt: new Date(), verifiedById: adminId } : { status: "REJECTED" } });
  await audit({ actorId: adminId, action: approve ? "qualification.verified" : "qualification.rejected", entityType: "ResumeQualification", entityId: entryId });
}

/**
 * Builds the resume snapshot sent with an application, honouring visibility settings.
 * Fields marked PRIVATE are never included.
 */
export async function buildApplicationSnapshot(userId: string) {
  const { profile, resume } = await getMyProfile(userId);
  const v = profile.visibility;
  const share = (f: ProfileVisibilityField) => v[f] !== "PRIVATE";
  return {
    username: profile.username,
    headline: resume.headline,
    summary: resume.summary,
    about: profile.about,
    skills: profile.skills,
    region: share("region") ? { city: profile.city, postalCode: profile.postalCode } : null,
    experience: share("experience") ? resume.experience : null,
    education: share("education") ? resume.education : null,
    qualifications: share("qualifications")
      ? resume.qualifications.map((q) => ({ id: q.qualification.id, name: q.qualification.name, kind: q.qualification.kind, status: q.status }))
      : null,
    languages: share("languages") ? profile.languages : null,
    availability: share("availability") ? profile.availability : null,
    desiredHourlyCents: share("desiredWage") ? profile.desiredHourlyCents : null,
    snapshotAt: new Date().toISOString(),
  };
}

/** Public profile: only PUBLIC fields plus visible reviews. */
export async function getPublicProfile(username: string) {
  const profile = await db().profile.findUnique({ where: { username }, include: { user: { select: { id: true, status: true, createdAt: true, resume: { include: { qualifications: { include: { qualification: true } } } } } } } });
  if (!profile || profile.user.status !== "ACTIVE") throw notFound("Profil");
  const v = effectiveVisibility(profile.visibility);
  const reviews = await db().review.findMany({ where: { subjectId: profile.userId, status: "VISIBLE" }, orderBy: { createdAt: "desc" }, take: 20, include: { author: { select: { profile: { select: { username: true } } } } } });
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const resume = profile.user.resume;
  return {
    userId: profile.userId,
    username: profile.username,
    memberSince: profile.user.createdAt,
    about: profile.about,
    skills: profile.skills,
    city: v.region === "PUBLIC" ? profile.city : null,
    headline: resume?.headline ?? "",
    qualifications: v.qualifications === "PUBLIC" ? (resume?.qualifications ?? []).map((q) => ({ name: q.qualification.name, kind: q.qualification.kind, status: q.status })) : [],
    languages: v.languages === "PUBLIC" ? profile.languages : [],
    rating: avg !== null ? { average: Math.round(avg * 10) / 10, count: reviews.length } : null,
    reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, text: r.text, author: r.author.profile?.username ?? "Gelöschtes Konto", createdAt: r.createdAt })),
  };
}
