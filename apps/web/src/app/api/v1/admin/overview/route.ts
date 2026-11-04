import { db } from "@/server/db";
import { route } from "@/server/http";
import { catalogInfo } from "@/server/services/catalog";
import { listReports } from "@/server/services/community";

export const GET = route({ auth: "admin" }, async () => {
  const [reports, disputes, businesses, proofs, catalog] = await Promise.all([
    listReports("OPEN"),
    db().dispute.findMany({ where: { status: "OPEN" }, include: { mediationEvent: { include: { listing: { select: { title: true } } } } }, orderBy: { createdAt: "asc" } }),
    db().business.findMany({ where: { verificationStatus: "PENDING" }, include: { owner: { select: { profile: { select: { username: true } }, files: { where: { purpose: "BUSINESS_DOC", deletedAt: null }, select: { id: true, originalName: true } } } } } }),
    db().resumeQualification.findMany({ where: { status: "PENDING_REVIEW" }, include: { qualification: { select: { name: true } }, documentFile: { select: { id: true, originalName: true } }, resume: { select: { user: { select: { profile: { select: { username: true } } } } } } } }),
    catalogInfo(),
  ]);
  return { reports, disputes, businesses, proofs, catalog };
});
