import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { LIMITS } from "@myminijob/core";
import { pdfHasActiveContent, scanBuffer, sniffMime } from "../adapters/scan";
import { storage } from "../adapters/storage";
import type { SessionUser } from "../auth/session";
import { audit } from "../audit";
import { db } from "../db";
import { ApiError, forbidden, notFound } from "../errors";

type Purpose = "RESUME_DOC" | "QUALIFICATION_PROOF" | "CHAT_ATTACHMENT" | "BUSINESS_DOC";
const ALLOWED: Record<Purpose, string[]> = {
  RESUME_DOC: ["application/pdf"],
  QUALIFICATION_PROOF: ["application/pdf", "image/png", "image/jpeg"],
  CHAT_ATTACHMENT: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
  BUSINESS_DOC: ["application/pdf"],
};

export async function uploadFile(ownerId: string, purpose: Purpose, originalName: string, data: Buffer) {
  if (data.length === 0) throw new ApiError("BAD_REQUEST", "Datei ist leer");
  if (data.length > LIMITS.maxUploadBytes) throw new ApiError("PAYLOAD_TOO_LARGE", `Maximal ${LIMITS.maxUploadBytes / 1024 / 1024} MB`);
  const mime = sniffMime(data);
  if (!mime || !ALLOWED[purpose].includes(mime)) throw new ApiError("BAD_REQUEST", `Dateityp nicht erlaubt (erlaubt: ${ALLOWED[purpose].join(", ")})`);
  if (mime === "application/pdf" && pdfHasActiveContent(data)) throw new ApiError("BAD_REQUEST", "PDF enthält aktive Inhalte (z. B. JavaScript) und wurde abgelehnt.");
  const count = await db().uploadedFile.count({ where: { ownerId, deletedAt: null } });
  if (count >= 100) throw new ApiError("BAD_REQUEST", "Maximale Anzahl an Dateien erreicht. Bitte alte Dateien löschen.");
  const scan = await scanBuffer(data).catch(() => "NOT_SCANNED" as const);
  if (scan === "INFECTED") {
    await audit({ actorId: ownerId, action: "file.rejected_infected", entityType: "UploadedFile" });
    throw new ApiError("BAD_REQUEST", "Die Datei wurde vom Virenscanner abgelehnt.");
  }
  const id = randomUUID();
  const key = `${purpose.toLowerCase()}/${ownerId}/${id}`;
  await storage().put(key, data, mime);
  const safeName = originalName.replace(/[^\w.\- äöüÄÖÜß()]/g, "_").slice(0, 120) || "datei";
  return db().uploadedFile.create({
    data: { id, ownerId, purpose, storageKey: key, originalName: safeName, mimeType: mime, sizeBytes: data.length, sha256: createHash("sha256").update(data).digest("hex"), scanStatus: scan },
    select: { id: true, originalName: true, mimeType: true, sizeBytes: true, scanStatus: true, purpose: true, createdAt: true },
  });
}

/**
 * Object-level authorisation for file downloads:
 *  - owner, admin
 *  - poster of a listing for documents attached to an application to that listing
 *  - participants of the conversation a chat attachment belongs to
 */
export async function canReadFile(user: SessionUser, fileId: string) {
  const file = await db().uploadedFile.findUnique({ where: { id: fileId } });
  if (!file) throw notFound("Datei");
  if (!file.deletedAt && (file.ownerId === user.id || user.isAdmin)) return file;
  const viaApplication = await db().applicationDocument.findFirst({ where: { fileId, application: { listing: { ownerId: user.id } } } });
  if (viaApplication) return file;
  const viaChat = await db().message.findFirst({ where: { attachmentFileId: fileId, hiddenAt: null, conversation: { participants: { some: { userId: user.id } } } } });
  if (viaChat && !file.deletedAt) return file;
  if (file.deletedAt) throw notFound("Datei");
  throw forbidden("Kein Zugriff auf diese Datei");
}

export async function readFile(user: SessionUser, fileId: string) {
  const file = await canReadFile(user, fileId);
  const data = await storage().get(file.storageKey);
  if (file.ownerId !== user.id) await audit({ actorId: user.id, action: "file.read", entityType: "UploadedFile", entityId: file.id });
  return { file, data };
}

export async function listMyFiles(userId: string, purpose?: Purpose) {
  return db().uploadedFile.findMany({
    where: { ownerId: userId, deletedAt: null, ...(purpose ? { purpose } : {}) },
    orderBy: { createdAt: "desc" },
    select: { id: true, originalName: true, mimeType: true, sizeBytes: true, scanStatus: true, purpose: true, createdAt: true },
  });
}

export async function deleteFile(userId: string, fileId: string) {
  const file = await db().uploadedFile.findUnique({ where: { id: fileId } });
  if (!file || file.ownerId !== userId || file.deletedAt) throw notFound("Datei");
  // Files attached to submitted applications stay readable by the poster until the application is gone.
  const attached = await db().applicationDocument.count({ where: { fileId } });
  if (attached) {
    await db().uploadedFile.update({ where: { id: fileId }, data: { deletedAt: new Date() } });
    return { softDeleted: true };
  }
  await storage().delete(file.storageKey);
  await db().uploadedFile.update({ where: { id: fileId }, data: { deletedAt: new Date() } });
  return { softDeleted: false };
}
