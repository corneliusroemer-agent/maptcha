import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
mkdirSync("dist/space-bunny", { recursive: true });
execFileSync("cp", ["-R", "variants/space-bunny/dist/.", "dist/space-bunny/"]);
