-- AlterTable
ALTER TABLE "documents" ADD COLUMN "name" TEXT;
ALTER TABLE "documents" ADD COLUMN "number" INTEGER;

-- AlterTable
ALTER TABLE "partners" ADD COLUMN "importConfig" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_catalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "article" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "brand_id" TEXT,
    "location_id" TEXT,
    "comment" TEXT,
    "parent_id" TEXT,
    CONSTRAINT "catalog_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "catalog_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "catalog_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "catalog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_catalog" ("article", "brand_id", "comment", "id", "location_id", "name", "parent_id", "type") SELECT "article", "brand_id", "comment", "id", "location_id", "name", "parent_id", "type" FROM "catalog";
DROP TABLE "catalog";
ALTER TABLE "new_catalog" RENAME TO "catalog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
