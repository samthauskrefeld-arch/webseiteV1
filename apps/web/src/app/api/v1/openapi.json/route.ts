import { buildOpenApi } from "@/server/openapi";
export const dynamic = "force-static";
export function GET() {
  return Response.json(buildOpenApi());
}
