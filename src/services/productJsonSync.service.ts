import fs from "fs";
import path from "path";

const DATA_PATH = path.join(__dirname, "..", "..", "prisma", "data", "all_products.json");

interface SyncProductToJsonInput {
  vendor: string | null;
  oldName: string;
  newName?: string;
  newDescription?: string;
}

/**
 * The web admin's edits must stay reflected in prisma/data/all_products.json, since that
 * file (not the DB) is treated as the source of truth and drives `seed:products` reseeds.
 * Only name/description are synced — vendor is the JSON's top-level grouping key, so an
 * admin-side vendor change can't be mapped back without restructuring the file.
 */
export function syncProductToJson({ vendor, oldName, newName, newDescription }: SyncProductToJsonInput): void {
  if (!vendor) return;
  if (newName == null && newDescription == null) return;

  let raw: Record<string, any>;
  try {
    raw = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  } catch {
    return;
  }

  const group = raw[vendor];
  if (!Array.isArray(group)) return;

  let touched = false;
  for (const entry of group) {
    if (entry.product_name !== oldName) continue;
    if (newName != null && newName !== oldName) {
      entry.product_name = newName;
      touched = true;
    }
    if (newDescription != null && newDescription !== entry.product_description) {
      entry.product_description = newDescription;
      touched = true;
    }
  }

  if (touched) {
    fs.writeFileSync(DATA_PATH, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
  }
}
