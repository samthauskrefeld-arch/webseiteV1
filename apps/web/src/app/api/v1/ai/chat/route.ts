import { aiChatSchema } from "@myminijob/core";
import { route } from "@/server/http";
import { chatWithAssistant } from "@/server/services/assistant";
export const POST = route({ auth: "optional", rateLimit: { name: "ai-chat", limit: 20, windowSec: 300 } }, async (ctx) => {
  const { messages } = await ctx.body(aiChatSchema);
  return chatWithAssistant(ctx.user, ctx.clientKey, messages);
});
