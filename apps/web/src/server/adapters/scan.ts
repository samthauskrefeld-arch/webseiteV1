import "server-only";
import net from "node:net";
import { env } from "../env";

export type ScanResult = "CLEAN" | "INFECTED" | "NOT_SCANNED";

/**
 * Virus scan via clamd INSTREAM protocol. Without CLAMAV_HOST the file is stored as
 * NOT_SCANNED and shown with a warning; in production a scanner should be mandatory (see OPEN-ITEMS).
 */
export async function scanBuffer(data: Buffer): Promise<ScanResult> {
  const { CLAMAV_HOST, CLAMAV_PORT } = env();
  if (!CLAMAV_HOST) return "NOT_SCANNED";
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: CLAMAV_HOST, port: CLAMAV_PORT });
    let reply = "";
    socket.setTimeout(15_000, () => {
      socket.destroy();
      reject(new Error("ClamAV Timeout"));
    });
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let i = 0; i < data.length; i += 64 * 1024) {
        const chunk = data.subarray(i, i + 64 * 1024);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(chunk.length);
        socket.write(len);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on("data", (d) => (reply += d.toString()));
    socket.on("end", () => resolve(/FOUND/.test(reply) ? "INFECTED" : /OK/.test(reply) ? "CLEAN" : "NOT_SCANNED"));
    socket.on("error", reject);
  });
}

/** Magic-byte sniffing – the client-supplied MIME type is never trusted. */
export function sniffMime(data: Buffer): "application/pdf" | "image/png" | "image/jpeg" | "image/webp" | null {
  if (data.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.subarray(0, 4).toString("latin1") === "RIFF" && data.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

/** Rejects PDFs with active content (JavaScript / auto-actions / embedded files). */
export function pdfHasActiveContent(data: Buffer): boolean {
  const s = data.toString("latin1");
  return /\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia)\b/.test(s);
}
