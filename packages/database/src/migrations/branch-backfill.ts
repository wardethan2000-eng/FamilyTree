import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../schema.js";
import { previewBranchBackfill, backfillBranches } from "../scripts/branch-backfill.js";

function formatSummary(summary: Awaited<ReturnType<typeof previewBranchBackfill>>) {
  const heading = summary.dryRun
    ? "Branch backfill dry run"
    : "Branch backfill applied";

  console.log(heading);
  console.log(`Trees processed: ${summary.treesProcessed}`);
  console.log(`Default branches created: ${summary.defaultBranchesCreated}`);
  console.log(`Memories tagged: ${summary.memoriesTagged}`);

  if (summary.errors.length > 0) {
    console.log("");
    console.log("Errors:");
    for (const error of summary.errors) {
      console.log(`  - ${error}`);
    }
  }
}

const apply = process.argv.includes("--apply");
const json = process.argv.includes("--json");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  try {
    const summary = apply
      ? await backfillBranches(db)
      : await previewBranchBackfill(db);

    if (json) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      formatSummary(summary);
      if (!apply) {
        console.log("");
        console.log("Re-run with --apply to execute the backfill.");
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});