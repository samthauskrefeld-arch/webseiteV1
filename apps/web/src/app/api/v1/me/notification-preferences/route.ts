import { notificationPrefsSchema } from "@myminijob/core";
import { route } from "@/server/http";
import { getPreferences, setPreferences } from "@/server/services/notifications";
export const GET = route({ auth: "required" }, async ({ user }) => ({ prefs: await getPreferences(user!.id) }));
export const PUT = route({ auth: "required" }, async (ctx) => ({ prefs: await setPreferences(ctx.user!.id, (await ctx.body(notificationPrefsSchema)).prefs) }));
