import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../env";

/**
 * Private object storage. Files are NEVER publicly addressable; downloads go through an
 * authorised API route that streams the object after an object-level permission check.
 */
export interface Storage {
  kind: "s3" | "local";
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

let instance: Storage | null = null;

export function storage(): Storage {
  if (instance) return instance;
  const e = env();
  if (e.S3_BUCKET && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY) {
    const client = new S3Client({
      region: e.S3_REGION,
      endpoint: e.S3_ENDPOINT,
      forcePathStyle: e.S3_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY },
    });
    const Bucket = e.S3_BUCKET;
    instance = {
      kind: "s3",
      async put(Key, Body, ContentType) {
        await client.send(new PutObjectCommand({ Bucket, Key, Body, ContentType, ServerSideEncryption: "AES256" }));
      },
      async get(Key) {
        const r = await client.send(new GetObjectCommand({ Bucket, Key }));
        return Buffer.from(await r.Body!.transformToByteArray());
      },
      async delete(Key) {
        await client.send(new DeleteObjectCommand({ Bucket, Key }));
      },
    };
  } else {
    if (e.NODE_ENV === "production" && process.env.ALLOW_LOCAL_STORAGE !== "1") throw new Error("In Produktion ist ein S3-kompatibler Speicher Pflicht (S3_* Variablen).");
    const root = path.resolve(e.STORAGE_DIR ?? path.join(process.cwd(), ".storage"));
    const resolve = (key: string) => {
      const p = path.resolve(root, key);
      if (!p.startsWith(root + path.sep)) throw new Error("Ungültiger Speicherschlüssel");
      return p;
    };
    instance = {
      kind: "local",
      async put(key, data) {
        const p = resolve(key);
        await fs.mkdir(path.dirname(p), { recursive: true });
        await fs.writeFile(p, data, { mode: 0o600 });
      },
      get: (key) => fs.readFile(resolve(key)),
      async delete(key) {
        await fs.rm(resolve(key), { force: true });
      },
    };
  }
  return instance;
}
