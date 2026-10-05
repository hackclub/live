// CLI twin of the /admin/purchases "refund everyone" panel (same logic, in
// src/lib/refundAll.ts).
//
//   bun scripts/refund-all-purchases.ts            # dry run: report + backup only
//   bun scripts/refund-all-purchases.ts --apply    # actually delete the rows
//
// Needs the AIRTABLE_* env vars (e.g. .env.local — bun loads it). Pause the
// shop before --apply.
import { mkdirSync, writeFileSync } from "node:fs";
import { buildRefundPlan, refundBatch } from "../src/lib/refundAll";

const apply = process.argv.includes("--apply");

async function main() {
  const plan = await buildRefundPlan();

  mkdirSync("backups", { recursive: true });
  const backupPath = `backups/redemptions-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(backupPath, JSON.stringify(plan.backup, null, 2));
  console.log(`Backed up ${plan.backup.length} redemption rows -> ${backupPath}\n`);

  console.log(`${"email".padEnd(40)} ${"earned".padStart(8)} ${"spent".padStart(8)} ${"was".padStart(8)} ${"now".padStart(8)}`);
  for (const r of plan.rows) {
    const flag = r.flag === "overspent" ? "  <- was overspent" : r.flag === "high_hours" ? "  <- high hours" : "";
    console.log(
      `${r.email.padEnd(40)} ${r.earned.toFixed(2).padStart(8)} ${r.spent.toFixed(2).padStart(8)} ${r.balanceBefore.toFixed(2).padStart(8)} ${r.balanceAfter.toFixed(2).padStart(8)}${flag}`,
    );
  }
  console.log(`\nRefundable rows: ${plan.refundableCount} (leaving ${plan.keptCount} cost-0 rows untouched)`);
  console.log(`Hours refunded: ${plan.totalRefunded.toFixed(2)}; hours outstanding after: ${plan.totalEarned.toFixed(2)}`);
  if (plan.badHours.length) console.log(`\nInvalid-hours approved records (counted as 0):\n  ${plan.badHours.join("\n  ")}`);
  if (plan.duplicateCodeUrls.length) {
    console.log("\nCode URLs approved more than once:");
    for (const d of plan.duplicateCodeUrls) console.log(`  ${d.url}: ${d.emails.join(", ")}`);
  }

  if (!apply) {
    console.log("\nDRY RUN — nothing deleted. Re-run with --apply to refund.");
    return;
  }

  let deleted = 0;
  for (;;) {
    const batch = await refundBatch(20);
    deleted += batch.deleted;
    console.log(`deleted ${deleted}, ${batch.remaining} remaining`);
    if (batch.remaining === 0 || batch.deleted === 0) break;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
