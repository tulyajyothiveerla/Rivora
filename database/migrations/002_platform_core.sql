CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'WORKER', 'ADMIN');
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "BookingStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'MISSED');
CREATE TYPE "JobStatus" AS ENUM ('ASSIGNED', 'ARRIVED', 'STARTED', 'COMPLETED', 'ISSUE');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "Audience" AS ENUM ('CLUB', 'COMMUNITY', 'PRIVATE');
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED');
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'WITHDRAWN', 'SOLD', 'REJECTED');
CREATE TYPE "RentalStatus" AS ENUM ('REQUESTED', 'APPROVED', 'DECLINED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "MessageRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'LOCKED');

CREATE SEQUENCE rivora_member_number_seq START 100001;

CREATE TABLE "Community" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(120) NOT NULL,
  "city" VARCHAR(80) NOT NULL,
  "address" VARCHAR(300),
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "capacity" INTEGER NOT NULL DEFAULT 0 CHECK ("capacity" >= 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("name", "city")
);

CREATE TABLE "AppUser" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "memberId" TEXT UNIQUE NOT NULL DEFAULT ('RVR-' || nextval('rivora_member_number_seq')),
  "name" VARCHAR(80) NOT NULL,
  "email" VARCHAR(254) UNIQUE NOT NULL,
  "phone" VARCHAR(30),
  "city" VARCHAR(80),
  "communityRequest" VARCHAR(120),
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
  "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "communityId" UUID REFERENCES "Community"("id") ON DELETE SET NULL,
  "apartment" VARCHAR(80),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AppUser_role_status_idx" ON "AppUser" ("role", "status");

CREATE TABLE "AuthSession" (
  "id" UUID PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "AppUser"("id") ON DELETE CASCADE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuthSession_user_expires_idx" ON "AuthSession" ("userId", "expiresAt");

CREATE TABLE "AuthRateLimit" (
  "key" CHAR(64) PRIMARY KEY,
  "attempts" SMALLINT NOT NULL DEFAULT 0,
  "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ServicePlan" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(40) UNIQUE NOT NULL,
  "description" VARCHAR(500) NOT NULL DEFAULT '',
  "priceMinor" INTEGER CHECK ("priceMinor" >= 0),
  "currency" CHAR(3) NOT NULL DEFAULT 'INR',
  "durationDays" INTEGER NOT NULL DEFAULT 30 CHECK ("durationDays" > 0),
  "clubAccess" BOOLEAN NOT NULL DEFAULT FALSE,
  "published" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PlanBenefit" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "planId" UUID NOT NULL REFERENCES "ServicePlan"("id") ON DELETE CASCADE,
  "title" VARCHAR(120) NOT NULL,
  "description" VARCHAR(300) NOT NULL DEFAULT '',
  "visitsPerPeriod" INTEGER CHECK ("visitsPerPeriod" IS NULL OR "visitsPerPeriod" >= 0),
  UNIQUE ("planId", "title")
);

CREATE TABLE "Vehicle" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL REFERENCES "AppUser"("id") ON DELETE CASCADE,
  "make" VARCHAR(60) NOT NULL,
  "model" VARCHAR(80) NOT NULL,
  "year" SMALLINT CHECK ("year" BETWEEN 1950 AND 2100),
  "registration" VARCHAR(20) NOT NULL,
  "color" VARCHAR(40),
  "parkingLocation" VARCHAR(120),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("ownerId", "registration")
);
CREATE INDEX "Vehicle_owner_idx" ON "Vehicle" ("ownerId");

CREATE TABLE "Subscription" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "AppUser"("id") ON DELETE CASCADE,
  "planId" UUID NOT NULL REFERENCES "ServicePlan"("id"),
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "autoRenew" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("endsAt" IS NULL OR "startsAt" IS NULL OR "endsAt" > "startsAt")
);
CREATE INDEX "Subscription_user_status_idx" ON "Subscription" ("userId", "status");
CREATE UNIQUE INDEX "Subscription_user_plan_pending_active_uidx"
  ON "Subscription" ("userId", "planId") WHERE "status" IN ('PENDING','ACTIVE');

CREATE TABLE "ServiceCatalog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(100) UNIQUE NOT NULL,
  "description" VARCHAR(500) NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE "PlanService" (
  "planId" UUID NOT NULL REFERENCES "ServicePlan"("id") ON DELETE CASCADE,
  "serviceId" UUID NOT NULL REFERENCES "ServiceCatalog"("id") ON DELETE CASCADE,
  PRIMARY KEY ("planId", "serviceId")
);

CREATE TABLE "ServiceSlot" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "communityId" UUID NOT NULL REFERENCES "Community"("id"),
  "serviceId" UUID NOT NULL REFERENCES "ServiceCatalog"("id"),
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "capacity" INTEGER NOT NULL CHECK ("capacity" > 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("endsAt" > "startsAt")
);
CREATE INDEX "ServiceSlot_community_start_idx" ON "ServiceSlot" ("communityId", "startsAt");

CREATE TABLE "Booking" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "AppUser"("id"),
  "vehicleId" UUID NOT NULL REFERENCES "Vehicle"("id"),
  "slotId" UUID NOT NULL REFERENCES "ServiceSlot"("id"),
  "serviceId" UUID NOT NULL REFERENCES "ServiceCatalog"("id"),
  "subscriptionId" UUID REFERENCES "Subscription"("id"),
  "status" "BookingStatus" NOT NULL DEFAULT 'REQUESTED',
  "notes" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Booking_user_created_idx" ON "Booking" ("userId", "createdAt");
CREATE INDEX "Booking_slot_status_idx" ON "Booking" ("slotId", "status");

CREATE TABLE "ServiceJob" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "bookingId" UUID UNIQUE NOT NULL REFERENCES "Booking"("id") ON DELETE CASCADE,
  "workerId" UUID REFERENCES "AppUser"("id") ON DELETE SET NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'ASSIGNED',
  "arrivalAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "completionNotes" VARCHAR(1000),
  "proofUrls" TEXT[] NOT NULL DEFAULT '{}',
  "issue" VARCHAR(1000),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ServiceJob_worker_status_idx" ON "ServiceJob" ("workerId", "status");

CREATE TABLE "Payment" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "AppUser"("id"),
  "subscriptionId" UUID REFERENCES "Subscription"("id"),
  "amountMinor" INTEGER NOT NULL CHECK ("amountMinor" >= 0),
  "currency" CHAR(3) NOT NULL DEFAULT 'INR',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "providerReference" VARCHAR(160) UNIQUE,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Payment_user_created_idx" ON "Payment" ("userId", "createdAt");

CREATE TABLE "SupportTicket" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "AppUser"("id"),
  "bookingId" UUID REFERENCES "Booking"("id") ON DELETE SET NULL,
  "subject" VARCHAR(160) NOT NULL,
  "description" VARCHAR(2000) NOT NULL,
  "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
  "assignedTo" UUID REFERENCES "AppUser"("id") ON DELETE SET NULL,
  "resolution" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SupportTicket_status_created_idx" ON "SupportTicket" ("status", "createdAt");

CREATE TABLE "WorkerAttendance" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workerId" UUID NOT NULL REFERENCES "AppUser"("id") ON DELETE CASCADE,
  "workDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "clockInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "clockOutAt" TIMESTAMP(3),
  UNIQUE ("workerId", "workDate"),
  CHECK ("clockOutAt" IS NULL OR "clockOutAt" > "clockInAt")
);

CREATE TABLE "Notification" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "AppUser"("id") ON DELETE CASCADE,
  "title" VARCHAR(120) NOT NULL,
  "body" VARCHAR(500) NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Notification_user_created_idx" ON "Notification" ("userId", "createdAt");

CREATE TABLE "ClubProfile" (
  "userId" UUID PRIMARY KEY REFERENCES "AppUser"("id") ON DELETE CASCADE,
  "bio" VARCHAR(300),
  "displayName" VARCHAR(60),
  "audience" "Audience" NOT NULL DEFAULT 'PRIVATE',
  "acceptRequests" VARCHAR(12) NOT NULL DEFAULT 'ALL' CHECK ("acceptRequests" IN ('ALL', 'COMMUNITY', 'NONE')),
  "pauseMessaging" BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE "ClubPost" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "AppUser"("id") ON DELETE CASCADE,
  "body" VARCHAR(2000) NOT NULL,
  "audience" "Audience" NOT NULL DEFAULT 'PRIVATE',
  "communityId" UUID REFERENCES "Community"("id") ON DELETE SET NULL,
  "mediaUrls" TEXT[] NOT NULL DEFAULT '{}',
  "hidden" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ClubPost_created_idx" ON "ClubPost" ("createdAt" DESC);

CREATE TABLE "ClubReaction" (
  "postId" UUID NOT NULL REFERENCES "ClubPost"("id") ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES "AppUser"("id") ON DELETE CASCADE,
  "reaction" VARCHAR(8) NOT NULL CHECK ("reaction" IN ('LIKE', 'LOVE')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("postId", "userId")
);

CREATE TABLE "ClubConversation" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requesterId" UUID NOT NULL REFERENCES "AppUser"("id"),
  "recipientId" UUID NOT NULL REFERENCES "AppUser"("id"),
  "status" "MessageRequestStatus" NOT NULL DEFAULT 'PENDING',
  "lockedByRequester" BOOLEAN NOT NULL DEFAULT FALSE,
  "lockedByRecipient" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("requesterId" <> "recipientId"),
  UNIQUE ("requesterId", "recipientId")
);

CREATE TABLE "ClubMessage" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" UUID NOT NULL REFERENCES "ClubConversation"("id") ON DELETE CASCADE,
  "senderId" UUID NOT NULL REFERENCES "AppUser"("id"),
  "body" VARCHAR(2000) NOT NULL,
  "hidden" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ClubBlock" (
  "blockerId" UUID NOT NULL REFERENCES "AppUser"("id") ON DELETE CASCADE,
  "blockedId" UUID NOT NULL REFERENCES "AppUser"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("blockerId", "blockedId"),
  CHECK ("blockerId" <> "blockedId")
);

CREATE TABLE "ContentReport" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reporterId" UUID NOT NULL REFERENCES "AppUser"("id"),
  "targetType" VARCHAR(20) NOT NULL CHECK ("targetType" IN ('PROFILE', 'POST', 'MESSAGE', 'LISTING', 'PARKING')),
  "targetId" UUID NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
  "reviewedBy" UUID REFERENCES "AppUser"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3)
);
CREATE INDEX "ContentReport_status_created_idx" ON "ContentReport" ("status", "createdAt");

CREATE TABLE "ParkingListing" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL REFERENCES "AppUser"("id"),
  "communityId" UUID NOT NULL REFERENCES "Community"("id"),
  "title" VARCHAR(120) NOT NULL,
  "description" VARCHAR(1000) NOT NULL DEFAULT '',
  "priceMinor" INTEGER NOT NULL CHECK ("priceMinor" >= 0),
  "availableFrom" DATE NOT NULL,
  "availableTo" DATE,
  "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("availableTo" IS NULL OR "availableTo" >= "availableFrom")
);

CREATE TABLE "ParkingBid" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "listingId" UUID NOT NULL REFERENCES "ParkingListing"("id") ON DELETE CASCADE,
  "bidderId" UUID NOT NULL REFERENCES "AppUser"("id"),
  "amountMinor" INTEGER NOT NULL CHECK ("amountMinor" > 0),
  "status" VARCHAR(12) NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'ACCEPTED', 'DECLINED')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ParkingRentalRequest" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "listingId" UUID NOT NULL REFERENCES "ParkingListing"("id"),
  "renterId" UUID NOT NULL REFERENCES "AppUser"("id"),
  "startsOn" DATE NOT NULL,
  "endsOn" DATE NOT NULL,
  "status" "RentalStatus" NOT NULL DEFAULT 'REQUESTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("endsOn" >= "startsOn")
);

CREATE TABLE "CarListing" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sellerId" UUID NOT NULL REFERENCES "AppUser"("id"),
  "make" VARCHAR(60) NOT NULL,
  "model" VARCHAR(80) NOT NULL,
  "year" SMALLINT CHECK ("year" BETWEEN 1950 AND 2100),
  "description" VARCHAR(2000) NOT NULL,
  "priceMinor" INTEGER NOT NULL CHECK ("priceMinor" >= 0),
  "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "CarEnquiry" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "listingId" UUID NOT NULL REFERENCES "CarListing"("id") ON DELETE CASCADE,
  "buyerId" UUID NOT NULL REFERENCES "AppUser"("id"),
  "message" VARCHAR(1000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SavedCarListing" (
  "userId" UUID NOT NULL REFERENCES "AppUser"("id") ON DELETE CASCADE,
  "listingId" UUID NOT NULL REFERENCES "CarListing"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "listingId")
);

CREATE TABLE "AuditLog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorId" UUID REFERENCES "AppUser"("id") ON DELETE SET NULL,
  "action" VARCHAR(100) NOT NULL,
  "entityType" VARCHAR(60) NOT NULL,
  "entityId" UUID,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditLog_created_idx" ON "AuditLog" ("createdAt" DESC);

INSERT INTO "ServicePlan" ("name", "description", "priceMinor", "durationDays", "clubAccess", "published") VALUES
  ('Discovery', 'Entry-level access to RIVORA car care.', NULL, 30, FALSE, FALSE),
  ('Signature', 'Recurring care for your everyday drive.', NULL, 30, TRUE, FALSE),
  ('Privilege', 'Our most considered ownership experience.', NULL, 30, TRUE, FALSE);

INSERT INTO "ServiceCatalog" ("name", "description") VALUES
  ('Exterior wash', 'Careful exterior wash and dry.'),
  ('Interior refresh', 'Interior surfaces and cabin refresh.'),
  ('Tyre assistance', 'Plan-eligible tyre assistance.');
