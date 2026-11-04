import "server-only";
import { getPrisma } from "@myminijob/db";

export const db = () => getPrisma();
export type Db = ReturnType<typeof getPrisma>;
/** Transaction client type */
export type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];
