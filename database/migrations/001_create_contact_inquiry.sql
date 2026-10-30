CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');

CREATE TABLE "ContactInquiry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(80) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "city" VARCHAR(80) NOT NULL,
    "community" VARCHAR(120),
    "message" VARCHAR(1000),
    "consent" BOOLEAN NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactInquiry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactInquiry_status_createdAt_idx"
    ON "ContactInquiry" ("status", "createdAt");
