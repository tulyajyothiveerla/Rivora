ALTER TABLE "ParkingListing"
  ADD COLUMN IF NOT EXISTS "mediaUrls" TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "CarListing"
  ADD COLUMN IF NOT EXISTS "mediaUrls" TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS "MediaAsset" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL REFERENCES "AppUser"("id") ON DELETE CASCADE,
  "visibility" VARCHAR(12) NOT NULL DEFAULT 'PRIVATE'
    CHECK ("visibility" IN ('PRIVATE', 'MEMBERS')),
  "contentType" VARCHAR(32) NOT NULL
    CHECK ("contentType" IN ('image/jpeg', 'image/png', 'image/webp')),
  "fileName" VARCHAR(180) NOT NULL,
  "byteLength" INTEGER NOT NULL CHECK ("byteLength" BETWEEN 1 AND 5242880),
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MediaAsset_owner_created_idx"
  ON "MediaAsset" ("ownerId", "createdAt" DESC);
