import { route } from "@/server/http";
import { deleteFile, readFile } from "@/server/services/files";

/** Authorised download. Served as attachment with nosniff; never inline-executed. */
export const GET = route<{ id: string }>({ auth: "required" }, async ({ user, params }) => {
  const { file, data } = await readFile(user!, params.id);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Cache-Control": "private, no-store",
    },
  });
});
export const DELETE = route<{ id: string }>({ auth: "required" }, async ({ user, params }) => deleteFile(user!.id, params.id));
