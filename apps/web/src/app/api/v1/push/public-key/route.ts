import { route } from "@/server/http";
import { pushPublicKey } from "@/server/adapters/push";
export const GET = route({ auth: "none" }, async () => ({ publicKey: pushPublicKey() }));
