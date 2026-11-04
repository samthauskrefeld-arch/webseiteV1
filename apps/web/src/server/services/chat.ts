import "server-only";
import type { SessionUser } from "../auth/session";
import { requireVerified } from "../auth/session";
import { publishRealtime } from "../adapters/redis";
import { db } from "../db";
import { ApiError, forbidden, notFound } from "../errors";
import { rateLimit } from "../ratelimit";
import { isBlockedBetween } from "./applications";
import { notify } from "./notifications";

/** Only the two participants of the conversation (applicant + listing owner) have access. */
async function requireParticipant(userId: string, conversationId: string) {
  const conv = await db().conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: { include: { user: { select: { id: true, status: true, profile: { select: { username: true } } } } } },
      application: { select: { id: true, listing: { select: { id: true, title: true } } } },
    },
  });
  if (!conv) throw notFound("Unterhaltung");
  const me = conv.participants.find((p) => p.userId === userId);
  if (!me) throw forbidden("Kein Zugriff auf diese Unterhaltung");
  const other = conv.participants.find((p) => p.userId !== userId)!;
  return { conv, me, other };
}

export async function listConversations(userId: string) {
  const parts = await db().conversationParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          participants: { include: { user: { select: { status: true, profile: { select: { username: true } } } } } },
          application: { select: { listing: { select: { id: true, title: true } } } },
          messages: { where: { hiddenAt: null }, orderBy: { createdAt: "desc" }, take: 1, select: { body: true, senderId: true, createdAt: true, attachmentFileId: true } },
        },
      },
    },
    orderBy: { conversation: { lastMessageAt: "desc" } },
  });
  return Promise.all(
    parts.map(async (p) => {
      const other = p.conversation.participants.find((x) => x.userId !== userId);
      const unread = await db().message.count({ where: { conversationId: p.conversationId, senderId: { not: userId }, hiddenAt: null, createdAt: { gt: p.lastReadAt ?? new Date(0) } } });
      const last = p.conversation.messages[0];
      return {
        id: p.conversationId,
        listing: p.conversation.application.listing,
        counterpart: other?.user.status === "ACTIVE" ? (other.user.profile?.username ?? "–") : "Gelöschtes Konto",
        counterpartId: other?.userId ?? null,
        lastMessage: last ? { preview: last.body ? last.body.slice(0, 80) : "📎 Anhang", mine: last.senderId === userId, at: last.createdAt } : null,
        unread,
      };
    }),
  );
}

export async function getMessages(userId: string, conversationId: string, opts: { after?: string } = {}) {
  const { conv, me, other } = await requireParticipant(userId, conversationId);
  const messages = await db().message.findMany({
    where: { conversationId, hiddenAt: null, ...(opts.after ? { createdAt: { gt: new Date(opts.after) } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { attachment: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, scanStatus: true } } },
  });
  // mark messages from the other side as delivered
  await db().message.updateMany({ where: { conversationId, senderId: { not: userId }, deliveredAt: null }, data: { deliveredAt: new Date() } });
  const readReceipts = me.shareReadReceipts && other.shareReadReceipts;
  const blocked = await isBlockedBetween(userId, other.userId);
  return {
    conversation: {
      id: conv.id,
      listing: conv.application.listing,
      applicationId: conv.application.id,
      counterpart: other.user.status === "ACTIVE" ? (other.user.profile?.username ?? "–") : "Gelöschtes Konto",
      counterpartId: other.userId,
      shareReadReceipts: me.shareReadReceipts,
      blocked,
      iBlocked: blocked ? (await db().block.count({ where: { blockerId: userId, blockedId: other.userId } })) > 0 : false,
    },
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      mine: m.senderId === userId,
      createdAt: m.createdAt,
      attachment: m.attachment,
      status: m.senderId !== userId ? null : readReceipts && other.lastReadAt && other.lastReadAt >= m.createdAt ? "read" : m.deliveredAt ? "delivered" : "sent",
    })),
  };
}

export async function sendMessage(user: SessionUser, conversationId: string, input: { body: string; attachmentFileId?: string | null }, clientId?: string | null) {
  requireVerified(user);
  await rateLimit(`msg:${user.id}`, 30, 60);
  const { conv, other } = await requireParticipant(user.id, conversationId);
  if (other.user.status !== "ACTIVE") throw new ApiError("CONFLICT", "Dieses Konto existiert nicht mehr.");
  if (await isBlockedBetween(user.id, other.userId)) throw forbidden("Nachrichten sind in dieser Unterhaltung blockiert.");
  if (input.attachmentFileId) {
    const f = await db().uploadedFile.findFirst({ where: { id: input.attachmentFileId, ownerId: user.id, deletedAt: null, purpose: "CHAT_ATTACHMENT" } });
    if (!f) throw notFound("Anhang");
  }
  const safeClientId = clientId && /^[\w-]{8,64}$/.test(clientId) ? clientId : null;
  if (safeClientId) {
    const dup = await db().message.findUnique({ where: { conversationId_senderId_clientId: { conversationId, senderId: user.id, clientId: safeClientId } } });
    if (dup) return { id: dup.id, replayed: true };
  }
  const msg = await db().message.create({ data: { conversationId, senderId: user.id, body: input.body, attachmentFileId: input.attachmentFileId ?? null, clientId: safeClientId } });
  await db().conversation.update({ where: { id: conversationId }, data: { lastMessageAt: msg.createdAt } });
  await db().conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId: user.id } }, data: { lastReadAt: msg.createdAt } });
  await publishRealtime(`conversation:${conversationId}`, { type: "message", conversationId, id: msg.id });
  const recent = await db().notification.count({ where: { userId: other.userId, type: "MESSAGE", readAt: null, link: `/konto/nachrichten/${conversationId}`, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } } });
  if (!recent) await notify(other.userId, "MESSAGE", "Neue Nachricht", `${user.username} hat dir zu „${conv.application.listing.title}“ geschrieben.`, `/konto/nachrichten/${conversationId}`);
  return { id: msg.id, replayed: false };
}

export async function markConversationRead(userId: string, conversationId: string) {
  await requireParticipant(userId, conversationId);
  await db().conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId } }, data: { lastReadAt: new Date() } });
  await publishRealtime(`conversation:${conversationId}`, { type: "read", conversationId });
}

export async function setReadReceipts(userId: string, conversationId: string, enabled: boolean) {
  await requireParticipant(userId, conversationId);
  await db().conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId } }, data: { shareReadReceipts: enabled } });
}

export async function blockUser(userId: string, targetId: string) {
  if (userId === targetId) throw new ApiError("BAD_REQUEST", "Du kannst dich nicht selbst blockieren.");
  const target = await db().user.findUnique({ where: { id: targetId } });
  if (!target) throw notFound("Person");
  await db().block.upsert({ where: { blockerId_blockedId: { blockerId: userId, blockedId: targetId } }, create: { blockerId: userId, blockedId: targetId }, update: {} });
}

export async function unblockUser(userId: string, targetId: string) {
  await db().block.deleteMany({ where: { blockerId: userId, blockedId: targetId } });
}

/** Used by apps/realtime and tests: may this user subscribe to the conversation channel? */
export async function isParticipant(userId: string, conversationId: string) {
  return (await db().conversationParticipant.count({ where: { userId, conversationId } })) > 0;
}
