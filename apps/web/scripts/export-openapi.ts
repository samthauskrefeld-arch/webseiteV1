import fs from "node:fs";
import { buildOpenApi } from "@/server/openapi";
fs.writeFileSync("../../docs/openapi.json", JSON.stringify(buildOpenApi(), null, 2));
console.log("docs/openapi.json geschrieben");
