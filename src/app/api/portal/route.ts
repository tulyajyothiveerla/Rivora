import { NextResponse } from "next/server";
import { getSessionUser, hasPermission, hasRole } from "@/lib/auth";
import { pool } from "@/lib/db";
import { platformFeatureEnabled } from "@/lib/platform-settings";

type PortalView =
  | "dashboard" | "profile" | "vehicles" | "membership" | "services" | "bookings"
  | "history" | "payments" | "support" | "notifications" | "club" | "parking" | "cars"
  | "customers" | "plans" | "subscriptions" | "operations" | "teams" | "communities"
  | "finance" | "moderation" | "reports" | "audit" | "jobs" | "attendance"
  | "myParking" | "myCars" | "rentalRequests" | "carEnquiries" | "savedCars"
  | "parkingManage" | "carListings" | "rentalManagement" | "carEnquiryManagement"
  | "catalog" | "serviceCatalog" | "myBids" | "inquiries" | "parkingIncomingBids"
  | "settings" | "staffPermissions";

const adminViews = new Set<PortalView>([
  "customers", "plans", "subscriptions", "operations", "teams", "communities",
  "finance", "moderation", "reports", "audit", "parkingManage", "carListings", "support",
  "rentalManagement", "carEnquiryManagement", "inquiries", "settings", "staffPermissions",
]);

const viewPermissions: Partial<Record<PortalView, string>> = {
  operations: "OPERATIONS",
  plans: "OPERATIONS",
  subscriptions: "OPERATIONS",
  customers: "CUSTOMERS",
  teams: "TEAM_MANAGEMENT",
  communities: "COMMUNITIES",
  support: "SUPPORT",
  inquiries: "SUPPORT",
  finance: "FINANCE",
  moderation: "MODERATION",
  parkingManage: "MARKETPLACE",
  carListings: "MARKETPLACE",
  carEnquiryManagement: "MARKETPLACE",
  rentalManagement: "MARKETPLACE",
  reports: "REPORTS",
  audit: "AUDIT",
};

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const rawView = new URL(request.url).searchParams.get("view") ?? "dashboard";
  if (!isPortalView(rawView)) return NextResponse.json({ error: "Unknown portal view." }, { status: 400 });
  const view = rawView;
  const isAdmin = hasRole(user, "ADMIN");
  const isWorker = hasRole(user, "WORKER");
  const requiredPermission = viewPermissions[view];
  const hasViewPermission = requiredPermission ? hasPermission(user, requiredPermission) : false;
  const isCustomerSupportView = view === "support" && hasRole(user, "CUSTOMER");
  if (adminViews.has(view) && !isAdmin && !hasViewPermission && !isCustomerSupportView) {
    return NextResponse.json({ error: "You do not have access to this workspace." }, { status: 403 });
  }
  if ((view === "jobs" || view === "attendance") && !isAdmin && !isWorker) {
    return NextResponse.json({ error: "You do not have access to this workspace." }, { status: 403 });
  }

  const parkingViews: PortalView[] = [
    "parking", "myParking", "myBids", "rentalRequests", "parkingManage",
    "rentalManagement", "parkingIncomingBids",
  ];
  const carViews: PortalView[] = [
    "cars", "myCars", "savedCars", "carEnquiries", "carListings", "carEnquiryManagement",
  ];
  if (!isAdmin && parkingViews.includes(view) && !(await platformFeatureEnabled("parkingEnabled"))) {
    return NextResponse.json({ error: "The parking marketplace is temporarily unavailable." }, { status: 503 });
  }
  if (!isAdmin && carViews.includes(view) && !(await platformFeatureEnabled("carMarketplaceEnabled"))) {
    return NextResponse.json({ error: "The car marketplace is temporarily unavailable." }, { status: 503 });
  }

  const id = user.id;
  let data: unknown;

  switch (view) {
    case "dashboard":
      if (isAdmin) {
        const { rows } = await pool.query(
          `SELECT
            (SELECT COUNT(*)::int FROM "AppUser" WHERE "role" = 'CUSTOMER') AS "customers",
            (SELECT COUNT(*)::int FROM "Subscription" WHERE "status" = 'ACTIVE') AS "activeSubscriptions",
            (SELECT COUNT(*)::int FROM "Booking" WHERE "status" IN ('REQUESTED', 'CONFIRMED')) AS "pendingBookings",
            (SELECT COUNT(*)::int FROM "SupportTicket" WHERE "status" IN ('OPEN', 'IN_PROGRESS')) AS "openTickets",
            (SELECT COUNT(*)::int FROM "ContentReport" WHERE "status" IN ('OPEN', 'REVIEWING')) AS "openReports",
            (SELECT COUNT(*)::int FROM "ContactInquiry" WHERE "status" IN ('NEW', 'CONTACTED')) AS "openInquiries",
            (SELECT COALESCE(SUM("amountMinor"), 0)::bigint FROM "Payment" WHERE "status" = 'PAID') AS "revenueMinor",
            (SELECT COUNT(*)::int FROM "ServiceJob" WHERE "status" = 'COMPLETED' AND "completedAt"::date = CURRENT_DATE) AS "completedToday"`
        );
        data = rows[0];
      } else if (isWorker) {
        const { rows } = await pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE j."status" IN ('ASSIGNED','ARRIVED','STARTED'))::int AS "activeJobs",
             COUNT(*) FILTER (WHERE j."status" = 'COMPLETED' AND j."completedAt"::date = CURRENT_DATE)::int AS "completedToday",
             COUNT(*) FILTER (WHERE b."status" = 'MISSED')::int AS "missedVisits"
           FROM "ServiceJob" j JOIN "Booking" b ON b."id" = j."bookingId"
           WHERE j."workerId" = $1 AND b."slotId" IN (
             SELECT "id" FROM "ServiceSlot" WHERE "startsAt"::date = CURRENT_DATE
           )`,
          [id],
        );
        data = rows[0];
      } else {
        const { rows } = await pool.query(
          `SELECT
             (SELECT COUNT(*)::int FROM "Vehicle" WHERE "ownerId" = $1) AS "vehicles",
             (SELECT COUNT(*)::int FROM "Subscription" WHERE "userId" = $1 AND "status" = 'ACTIVE') AS "activeSubscriptions",
             (SELECT COUNT(*)::int FROM "Booking" WHERE "userId" = $1 AND "status" IN ('REQUESTED','CONFIRMED')) AS "upcomingBookings",
             (SELECT COUNT(*)::int FROM "SupportTicket" WHERE "userId" = $1 AND "status" IN ('OPEN','IN_PROGRESS')) AS "openTickets",
             (SELECT COUNT(*)::int FROM "Notification" WHERE "userId" = $1 AND "readAt" IS NULL) AS "unreadNotifications"`,
          [id],
        );
        data = rows[0];
      }
      break;
    case "profile": {
      const { rows } = await pool.query(
        `SELECT u."memberId", u."name", u."email", u."phone", u."city",u."communityRequest",u."apartment",
                u."communityId"::text AS "communityId", c."name" AS "communityName",
                c."city" AS "communityCity"
         FROM "AppUser" u LEFT JOIN "Community" c ON c."id" = u."communityId"
         WHERE u."id" = $1`,
        [id],
      );
      data = rows[0];
      break;
    }
    case "settings": {
      const { rows } = await pool.query(
        `SELECT "key","value" FROM "PlatformSetting" ORDER BY "key"`,
      );
      const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
      data = {
        registrationEnabled: stored.registrationEnabled ?? true,
        clubEnabled: stored.clubEnabled ?? true,
        parkingEnabled: stored.parkingEnabled ?? true,
        carMarketplaceEnabled: stored.carMarketplaceEnabled ?? true,
        supportEmail: stored.supportEmail ?? "",
      };
      break;
    }
    case "staffPermissions":
      data = await rows(
        `SELECT u."id",u."name",u."memberId",u."email",u."status",
          COALESCE(array_agg(p."scope") FILTER (WHERE p."scope" IS NOT NULL),ARRAY[]::text[]) AS "permissions"
         FROM "AppUser" u LEFT JOIN "StaffPermission" p ON p."userId"=u."id"
         WHERE u."role"='WORKER' GROUP BY u."id" ORDER BY u."name"`,
      );
      break;
    case "vehicles":
      data = await rows(`SELECT v."id", v."make", v."model", v."year", v."registration", v."color",
           v."parkingLocation", v."createdAt"
         FROM "Vehicle" v ${isAdmin ? "" : 'WHERE v."ownerId" = $1'}
         ORDER BY v."createdAt" DESC LIMIT 100`, isAdmin ? [] : [id]);
      break;
    case "membership":
    case "subscriptions":
      data = await rows(
        `SELECT s."id", s."status", s."startsAt", s."endsAt", s."autoRenew", s."createdAt",
                p."name" AS "planName", p."priceMinor", p."currency", p."durationDays", p."clubAccess",
                u."name" AS "customerName", u."email" AS "customerEmail",
                COALESCE(json_agg(json_build_object('title', pb."title", 'description', pb."description"))
                  FILTER (WHERE pb."id" IS NOT NULL), '[]'::json) AS "benefits"
         FROM "Subscription" s JOIN "ServicePlan" p ON p."id" = s."planId"
         JOIN "AppUser" u ON u."id" = s."userId"
         LEFT JOIN "PlanBenefit" pb ON pb."planId" = p."id"
         ${isAdmin ? "" : 'WHERE s."userId" = $1'}
         GROUP BY s."id", p."id", u."id" ORDER BY s."createdAt" DESC LIMIT 100`,
        isAdmin ? [] : [id],
      );
      break;
    case "myBids":
      if (!(await hasActiveMembership(id))) return NextResponse.json({ error: "An active membership is required." }, { status: 403 });
      data = await rows(
        `SELECT b."id",b."amountMinor",b."createdAt",b."status" AS "bidStatus",
                l."title",l."status" AS "listingStatus",c."name" AS "communityName"
         FROM "ParkingBid" b JOIN "ParkingListing" l ON l."id"=b."listingId"
         JOIN "Community" c ON c."id"=l."communityId"
         WHERE b."bidderId"=$1 ORDER BY b."createdAt" DESC LIMIT 100`,
        [id],
      );
      break;
    case "parkingIncomingBids":
      const marketplaceAccess = hasPermission(user, "MARKETPLACE");
      if (!marketplaceAccess && !(await hasActiveMembership(id))) {
        return NextResponse.json({ error: "An active membership is required." }, { status: 403 });
      }
      data = await rows(
        `SELECT b."id",b."amountMinor",b."status",b."createdAt",
                l."title",l."id" AS "listingId",bidder."name" AS "bidderName",
                bidder."memberId" AS "bidderMemberId",c."name" AS "communityName"
         FROM "ParkingBid" b
         JOIN "ParkingListing" l ON l."id"=b."listingId"
         JOIN "AppUser" bidder ON bidder."id"=b."bidderId"
         JOIN "Community" c ON c."id"=l."communityId"
         WHERE ${marketplaceAccess ? "TRUE" : 'l."ownerId"=$1'}
         ORDER BY CASE WHEN b."status"='PENDING' THEN 0 ELSE 1 END,b."createdAt" DESC LIMIT 200`,
        marketplaceAccess ? [] : [id],
      );
      break;
    case "services":
      data = await rows(
        `        SELECT s."id" AS "serviceId", s."name", s."description", sl."id" AS "slotId", sl."startsAt", sl."endsAt",
                c."name" AS "communityName", c."city",
                (sl."capacity" - COUNT(b."id") FILTER (WHERE b."status" IN ('REQUESTED','CONFIRMED')))::int AS "remaining"
         FROM "ServiceCatalog" s
         JOIN "PlanService" ps ON ps."serviceId" = s."id"
         JOIN "Subscription" sub ON sub."planId" = ps."planId" AND sub."userId" = $1 AND sub."status" = 'ACTIVE'
         JOIN "ServiceSlot" sl ON sl."serviceId" = s."id" AND sl."communityId" = $2 AND sl."startsAt" > CURRENT_TIMESTAMP
         JOIN "Community" c ON c."id" = sl."communityId" AND c."active" = TRUE
         LEFT JOIN "Booking" b ON b."slotId" = sl."id"
         WHERE s."active" = TRUE
         GROUP BY s."id", sl."id", c."id" HAVING COUNT(b."id") FILTER (WHERE b."status" IN ('REQUESTED','CONFIRMED')) < sl."capacity"
         ORDER BY sl."startsAt" LIMIT 100`,
        [id, user.communityId],
      );
      break;
    case "bookings":
    case "history":
    case "operations":
        const fullOperationsAccess = isAdmin || (view === "operations" && hasViewPermission);
        data = await rows(
        `SELECT b."id", b."status", b."notes", b."createdAt",
                sl."startsAt", sl."endsAt", c."name" AS "communityName", c."city",
                sc."name" AS "serviceName", v."make", v."model", v."registration",
                u."name" AS "customerName", u."email" AS "customerEmail",
                j."status" AS "jobStatus", w."name" AS "workerName", j."completionNotes", j."proofUrls", j."issue"
         FROM "Booking" b JOIN "ServiceSlot" sl ON sl."id" = b."slotId"
         JOIN "Community" c ON c."id" = sl."communityId"
         JOIN "ServiceCatalog" sc ON sc."id" = b."serviceId"
         JOIN "Vehicle" v ON v."id" = b."vehicleId"
         JOIN "AppUser" u ON u."id" = b."userId"
         LEFT JOIN "ServiceJob" j ON j."bookingId" = b."id"
         LEFT JOIN "AppUser" w ON w."id" = j."workerId"
         ${fullOperationsAccess ? "" : isWorker ? 'WHERE j."workerId" = $1' : 'WHERE b."userId" = $1'}
           ${view === "history" && !fullOperationsAccess ? "AND b.\"status\" IN ('COMPLETED','MISSED','CANCELLED')" : ""}
           ${view === "bookings" && !fullOperationsAccess ? "AND b.\"status\" IN ('REQUESTED','CONFIRMED')" : ""}
         ORDER BY sl."startsAt" ${view === "history" ? "DESC" : "ASC"} LIMIT 150`,
        fullOperationsAccess ? [] : [id],
      );
      break;
    case "payments":
    case "finance":
      const fullFinanceAccess = isAdmin || (view === "finance" && hasViewPermission);
      data = await rows(
        `SELECT p."id", p."amountMinor", p."currency", p."status", p."providerReference", p."paidAt", p."createdAt",
                p."subscriptionId", u."name" AS "customerName", u."email" AS "customerEmail", sp."name" AS "planName"
         FROM "Payment" p JOIN "AppUser" u ON u."id" = p."userId"
         LEFT JOIN "Subscription" s ON s."id" = p."subscriptionId"
         LEFT JOIN "ServicePlan" sp ON sp."id" = s."planId"
         ${fullFinanceAccess ? "" : 'WHERE p."userId" = $1'} ORDER BY p."createdAt" DESC LIMIT 100`,
        fullFinanceAccess ? [] : [id],
      );
      break;
    case "support":
      const fullSupportAccess = isAdmin || hasViewPermission;
      data = await rows(
        `SELECT t."id", t."subject", t."description", t."status", t."resolution", t."createdAt", t."updatedAt",
                u."name" AS "customerName", b."id" AS "bookingId"
         FROM "SupportTicket" t JOIN "AppUser" u ON u."id" = t."userId"
         LEFT JOIN "Booking" b ON b."id" = t."bookingId"
         ${fullSupportAccess ? "" : 'WHERE t."userId" = $1'} ORDER BY t."updatedAt" DESC LIMIT 100`,
        fullSupportAccess ? [] : [id],
      );
      break;
    case "inquiries":
      data = await rows(
        `SELECT "id","name","email","city","community","message","consent","status","createdAt","updatedAt"
         FROM "ContactInquiry"
         ORDER BY CASE WHEN "status"='NEW' THEN 0 WHEN "status"='CONTACTED' THEN 1 ELSE 2 END,
           "createdAt" DESC LIMIT 200`,
      );
      break;
    case "notifications":
      data = await rows(
        `SELECT "id", "title", "body", "readAt", "createdAt" FROM "Notification"
         WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 100`,
        [id],
      );
      break;
    case "plans":
      data = await rows(
        `SELECT p."id", p."name", p."description", p."priceMinor", p."currency", p."durationDays",
                p."clubAccess", p."published",
                COALESCE(json_agg(json_build_object('title', b."title", 'description', b."description", 'visitsPerPeriod', b."visitsPerPeriod"))
                  FILTER (WHERE b."id" IS NOT NULL), '[]'::json) AS "benefits",
                COALESCE((SELECT json_agg(ps."serviceId") FROM "PlanService" ps WHERE ps."planId"=p."id"), '[]'::json) AS "serviceIds"
         FROM "ServicePlan" p LEFT JOIN "PlanBenefit" b ON b."planId" = p."id"
         ${isAdmin ? "" : 'WHERE p."published"=TRUE'}
         GROUP BY p."id" ORDER BY p."name"`,
      );
      break;
    case "catalog":
      {
      const plans = await rows(
        `SELECT "id","name","description","priceMinor","currency","durationDays","clubAccess"
         FROM "ServicePlan" p WHERE p."published"=TRUE ORDER BY p."priceMinor"`,
      );
      const benefits = await rows(
        `SELECT "planId","title","description" FROM "PlanBenefit" WHERE "planId"=ANY($1::uuid[])`,
        [plans.map((plan) => plan.id)],
      );
      data = plans.map((plan) => ({
        ...plan,
        benefits: benefits.filter((benefit) => benefit.planId === plan.id)
          .map(({ title, description }) => ({ title, description })),
      }));
      }
      break;
    case "serviceCatalog":
      if (!hasPermission(user, "OPERATIONS")) return NextResponse.json({ error: "Operations permission required." }, { status: 403 });
      data = await rows(
        `SELECT s."id",s."name",s."description",s."active" FROM "ServiceCatalog" s ORDER BY s."name"`,
      );
      break;
    case "customers":
      data = await rows(
        `SELECT u."id", u."memberId", u."name", u."email", u."phone", u."role", u."status",
                u."apartment",u."city",u."communityRequest", u."createdAt", c."name" AS "communityName", c."city" AS "communityCity",
                (SELECT COUNT(*)::int FROM "Vehicle" v WHERE v."ownerId" = u."id") AS "vehicleCount",
                (SELECT COUNT(*)::int FROM "Subscription" s WHERE s."userId" = u."id" AND s."status" = 'ACTIVE') AS "activeSubscriptions"
         FROM "AppUser" u LEFT JOIN "Community" c ON c."id" = u."communityId"
         WHERE u."role" = 'CUSTOMER' ORDER BY u."createdAt" DESC LIMIT 200`,
      );
      break;
    case "teams":
      data = await rows(
        `SELECT u."id", u."memberId", u."name", u."email", u."phone", u."status", u."createdAt",
                (SELECT COALESCE(array_agg(p."scope"),ARRAY[]::text[]) FROM "StaffPermission" p WHERE p."userId"=u."id") AS "permissions",
                COUNT(DISTINCT j."id") FILTER (WHERE j."status" NOT IN ('COMPLETED','ISSUE'))::int AS "activeJobs",
                COUNT(DISTINCT a."id") FILTER (WHERE a."workDate" = CURRENT_DATE)::int AS "attendanceToday"
         FROM "AppUser" u LEFT JOIN "ServiceJob" j ON j."workerId" = u."id"
         LEFT JOIN "WorkerAttendance" a ON a."workerId" = u."id"
         WHERE u."role" = 'WORKER' GROUP BY u."id" ORDER BY u."name"`,
      );
      break;
    case "communities":
      data = await rows(
        `SELECT c."id", c."name", c."city", c."address", c."capacity", c."active",
                COUNT(DISTINCT u."id") FILTER (WHERE u."role" = 'CUSTOMER')::int AS "customers",
                COUNT(DISTINCT sl."id") FILTER (WHERE sl."startsAt" > CURRENT_TIMESTAMP)::int AS "upcomingSlots"
         FROM "Community" c LEFT JOIN "AppUser" u ON u."communityId" = c."id"
         LEFT JOIN "ServiceSlot" sl ON sl."communityId" = c."id"
         GROUP BY c."id" ORDER BY c."city", c."name"`,
      );
      break;
    case "jobs":
      data = await rows(
        `SELECT j."id", j."status", j."arrivalAt", j."startedAt", j."completedAt", j."completionNotes", j."issue",
                b."id" AS "bookingId", sl."startsAt", sl."endsAt", sc."name" AS "serviceName",
                v."make", v."model", v."registration", u."name" AS "customerName",
                u."phone" AS "customerPhone", u."apartment", c."name" AS "communityName", c."city",
                b."notes" AS "customerNotes"
         FROM "ServiceJob" j JOIN "Booking" b ON b."id" = j."bookingId"
         JOIN "ServiceSlot" sl ON sl."id" = b."slotId"
         JOIN "ServiceCatalog" sc ON sc."id" = b."serviceId"
         JOIN "Vehicle" v ON v."id" = b."vehicleId"
         JOIN "AppUser" u ON u."id" = b."userId"
         JOIN "Community" c ON c."id" = sl."communityId"
         WHERE b."status"<>'CANCELLED' AND ${isAdmin ? "TRUE" : 'j."workerId" = $1'}
         ORDER BY sl."startsAt" DESC LIMIT 150`,
        isAdmin ? [] : [id],
      );
      break;
    case "attendance":
      data = await rows(
        `SELECT a."id", a."workerId", a."workDate", a."clockInAt", a."clockOutAt", u."name" AS "workerName"
         FROM "WorkerAttendance" a JOIN "AppUser" u ON u."id" = a."workerId"
         WHERE ${isAdmin ? "TRUE" : 'a."workerId" = $1'}
         ORDER BY a."workDate" DESC LIMIT 100`,
        isAdmin ? [] : [id],
      );
      break;
    case "club":
      if (!(await platformFeatureEnabled("clubEnabled"))) {
        return NextResponse.json({ error: "RIVORA Club is temporarily unavailable." }, { status: 503 });
      }
      if (!(await hasActiveClubAccess(id))) {
        return NextResponse.json({ error: "An active Signature or Privilege membership is required for RIVORA Club." }, { status: 403 });
      }
      const posts = await rows(
        `SELECT p."id", p."body", p."audience", p."mediaUrls", p."createdAt",
                author."id" AS "authorId", COALESCE(profile."displayName", author."name") AS "authorName",
                author."memberId", community."name" AS "communityName",
                COUNT(r."postId") FILTER (WHERE r."reaction" = 'LIKE')::int AS "likes",
                COUNT(r."postId") FILTER (WHERE r."reaction" = 'LOVE')::int AS "loves",
                MAX(r."reaction") FILTER (WHERE r."userId" = $1) AS "myReaction"
         FROM "ClubPost" p JOIN "AppUser" author ON author."id" = p."userId"
         LEFT JOIN "ClubProfile" profile ON profile."userId" = author."id"
         LEFT JOIN "Community" community ON community."id" = author."communityId"
         LEFT JOIN "ClubReaction" r ON r."postId" = p."id"
         WHERE p."hidden"=FALSE AND (p."userId" = $1
            OR ((p."audience" = 'CLUB' OR (p."audience" = 'COMMUNITY' AND p."communityId" = $2))
              AND EXISTS (SELECT 1 FROM "Subscription" s JOIN "ServicePlan" plan ON plan."id"=s."planId"
                WHERE s."userId"=p."userId" AND s."status"='ACTIVE' AND plan."clubAccess"=TRUE
                  AND (s."endsAt" IS NULL OR s."endsAt">CURRENT_TIMESTAMP))
              AND NOT EXISTS (
                SELECT 1 FROM "ClubBlock" b WHERE (b."blockerId" = $1 AND b."blockedId" = p."userId")
                  OR (b."blockerId" = p."userId" AND b."blockedId" = $1))))
         GROUP BY p."id", author."id", profile."userId", community."id"
         ORDER BY p."createdAt" DESC LIMIT 100`,
        [id, user.communityId],
      );
      const profile = await rows(
        `SELECT "bio","displayName","audience","acceptRequests","pauseMessaging"
         FROM "ClubProfile" WHERE "userId"=$1`,
        [id],
      );
      const conversations = await rows(
        `SELECT c."id",c."requesterId",c."recipientId",c."status",c."lockedByRequester",c."lockedByRecipient",
                c."updatedAt",
                CASE WHEN c."requesterId"=$1 THEN recipient."name" ELSE requester."name" END AS "otherName",
                CASE WHEN c."requesterId"=$1 THEN recipient."memberId" ELSE requester."memberId" END AS "otherMemberId",
                (SELECT json_agg(json_build_object('id',m."id",'senderId',m."senderId",'body',m."body",'createdAt',m."createdAt")
                   ORDER BY m."createdAt") FROM "ClubMessage" m
                 WHERE m."conversationId"=c."id" AND m."hidden"=FALSE) AS "messages"
         FROM "ClubConversation" c
         JOIN "AppUser" requester ON requester."id"=c."requesterId"
         JOIN "AppUser" recipient ON recipient."id"=c."recipientId"
         WHERE (c."requesterId"=$1 OR c."recipientId"=$1)
           AND NOT EXISTS (SELECT 1 FROM "ClubBlock" b WHERE
             (b."blockerId"=c."requesterId" AND b."blockedId"=c."recipientId") OR
             (b."blockerId"=c."recipientId" AND b."blockedId"=c."requesterId"))
         ORDER BY c."updatedAt" DESC LIMIT 50`,
        [id],
      );
      data = { posts, profile: profile[0] ?? null, conversations };
      break;
    case "parking":
      if (!(await platformFeatureEnabled("parkingEnabled"))) {
        return NextResponse.json({ error: "The parking marketplace is temporarily unavailable." }, { status: 503 });
      }
      if (!(await hasActiveMembership(id))) return NextResponse.json({ error: "An active membership is required for the parking marketplace." }, { status: 403 });
      data = await rows(
        `SELECT l."id", l."title", l."description", l."priceMinor", l."availableFrom", l."availableTo",l."mediaUrls",
                l."createdAt", c."name" AS "communityName", c."city", u."name" AS "ownerName",
                (SELECT COUNT(*)::int FROM "ParkingBid" bid WHERE bid."listingId" = l."id") AS "bidCount",
                (SELECT COUNT(*)::int FROM "ParkingRentalRequest" r WHERE r."listingId" = l."id" AND r."renterId" = $1 AND r."status" = 'REQUESTED') AS "myRequests"
         FROM "ParkingListing" l JOIN "Community" c ON c."id" = l."communityId"
         JOIN "AppUser" u ON u."id" = l."ownerId"
         WHERE l."status" = 'ACTIVE' AND l."ownerId" <> $1 AND l."communityId" = $2
         ORDER BY l."createdAt" DESC LIMIT 100`,
        [id, user.communityId],
      );
      break;
    case "myParking":
      if (!(await hasActiveMembership(id))) return NextResponse.json({ error: "An active membership is required for the parking marketplace." }, { status: 403 });
      data = await rows(
        `SELECT l."id",l."title",l."description",l."priceMinor",l."availableFrom",l."availableTo",l."status",l."mediaUrls",
                c."name" AS "communityName",c."city",
                (SELECT COUNT(*)::int FROM "ParkingBid" b WHERE b."listingId"=l."id") AS "bidCount"
         FROM "ParkingListing" l JOIN "Community" c ON c."id"=l."communityId"
         WHERE l."ownerId"=$1 ORDER BY l."createdAt" DESC LIMIT 100`,
        [id],
      );
      break;
    case "rentalRequests":
    case "rentalManagement":
      const fullRentalAccess = isAdmin || (view === "rentalManagement" && hasViewPermission);
      if (!fullRentalAccess && !(await hasActiveMembership(id))) return NextResponse.json({ error: "An active membership is required." }, { status: 403 });
      data = await rows(
        `SELECT r."id",r."startsOn",r."endsOn",r."status",r."createdAt",
                l."id" AS "listingId",l."title",l."priceMinor",owner."name" AS "ownerName",
                renter."name" AS "renterName",l."ownerId"::text AS "ownerId",r."renterId"::text AS "renterId"
         FROM "ParkingRentalRequest" r JOIN "ParkingListing" l ON l."id"=r."listingId"
         JOIN "AppUser" owner ON owner."id"=l."ownerId"
         JOIN "AppUser" renter ON renter."id"=r."renterId"
         WHERE ${fullRentalAccess ? "TRUE" : '(r."renterId"=$1 OR l."ownerId"=$1)'}
         ORDER BY r."createdAt" DESC LIMIT 100`,
        fullRentalAccess ? [] : [id],
      );
      break;
    case "parkingManage":
      data = await rows(
        `SELECT l."id",l."title",l."description",l."priceMinor",l."availableFrom",l."availableTo",l."status",
                c."name" AS "communityName",c."city",u."name" AS "ownerName"
         FROM "ParkingListing" l JOIN "Community" c ON c."id"=l."communityId"
         JOIN "AppUser" u ON u."id"=l."ownerId"
         ORDER BY CASE WHEN l."status"='DRAFT' THEN 0 ELSE 1 END,l."createdAt" DESC LIMIT 200`,
      );
      break;
    case "cars":
      if (!(await platformFeatureEnabled("carMarketplaceEnabled"))) {
        return NextResponse.json({ error: "The car marketplace is temporarily unavailable." }, { status: 503 });
      }
      if (!(await hasActiveMembership(id))) return NextResponse.json({ error: "An active membership is required for the car marketplace." }, { status: 403 });
      data = await rows(
        `SELECT l."id", l."make", l."model", l."year", l."description", l."priceMinor",l."mediaUrls",
                l."createdAt", u."name" AS "sellerName",
                EXISTS (SELECT 1 FROM "SavedCarListing" s WHERE s."listingId" = l."id" AND s."userId" = $1) AS "saved"
         FROM "CarListing" l JOIN "AppUser" u ON u."id" = l."sellerId"
         WHERE l."status" = 'ACTIVE' AND l."sellerId" <> $1
         ORDER BY l."createdAt" DESC LIMIT 100`,
        [id],
      );
      break;
    case "myCars":
      if (!(await hasActiveMembership(id))) return NextResponse.json({ error: "An active membership is required for the car marketplace." }, { status: 403 });
      data = await rows(
        `SELECT l."id",l."make",l."model",l."year",l."description",l."priceMinor",l."status",l."createdAt",l."mediaUrls",
                (SELECT COUNT(*)::int FROM "CarEnquiry" e WHERE e."listingId"=l."id") AS "enquiryCount"
         FROM "CarListing" l WHERE l."sellerId"=$1 ORDER BY l."createdAt" DESC LIMIT 100`,
        [id],
      );
      break;
    case "carListings":
      data = await rows(
        `SELECT l."id",l."make",l."model",l."year",l."description",l."priceMinor",l."status",l."createdAt",l."mediaUrls",
                u."name" AS "sellerName",u."email" AS "sellerEmail"
         FROM "CarListing" l JOIN "AppUser" u ON u."id"=l."sellerId"
         ORDER BY CASE WHEN l."status"='DRAFT' THEN 0 ELSE 1 END,l."createdAt" DESC LIMIT 200`,
      );
      break;
    case "carEnquiries":
    case "carEnquiryManagement":
      const fullCarEnquiryAccess = isAdmin || (view === "carEnquiryManagement" && hasViewPermission);
      data = await rows(
        `SELECT e."id",e."message",e."createdAt",l."make",l."model",
                seller."name" AS "sellerName",buyer."name" AS "buyerName"
         FROM "CarEnquiry" e JOIN "CarListing" l ON l."id"=e."listingId"
         JOIN "AppUser" seller ON seller."id"=l."sellerId"
         JOIN "AppUser" buyer ON buyer."id"=e."buyerId"
         WHERE ${fullCarEnquiryAccess ? "TRUE" : '(e."buyerId"=$1 OR l."sellerId"=$1)'}
         ORDER BY e."createdAt" DESC LIMIT 100`,
        fullCarEnquiryAccess ? [] : [id],
      );
      break;
    case "savedCars":
      if (!(await hasActiveMembership(id))) return NextResponse.json({ error: "An active membership is required." }, { status: 403 });
      data = await rows(
        `SELECT l."id",l."make",l."model",l."year",l."description",l."priceMinor",u."name" AS "sellerName"
         FROM "SavedCarListing" s JOIN "CarListing" l ON l."id"=s."listingId"
         JOIN "AppUser" u ON u."id"=l."sellerId" WHERE s."userId"=$1 AND l."status"='ACTIVE'
         ORDER BY s."createdAt" DESC LIMIT 100`,
        [id],
      );
      break;
    case "moderation":
      data = await rows(
        `SELECT r."id", r."targetType", r."targetId", r."reason", r."status", r."createdAt",
                u."name" AS "reporterName", reviewer."name" AS "reviewerName"
         FROM "ContentReport" r JOIN "AppUser" u ON u."id" = r."reporterId"
         LEFT JOIN "AppUser" reviewer ON reviewer."id" = r."reviewedBy"
         ORDER BY CASE WHEN r."status" IN ('OPEN','REVIEWING') THEN 0 ELSE 1 END, r."createdAt" DESC LIMIT 200`,
      );
      break;
    case "reports":
      data = await rows(
        `WITH booking_totals AS (
           SELECT DATE_TRUNC('day',s."startsAt")::date AS "day",COUNT(*)::int AS "bookings",
             COUNT(*) FILTER (WHERE b."status"='COMPLETED')::int AS "completed",
             COUNT(*) FILTER (WHERE b."status"='MISSED')::int AS "missed"
           FROM "Booking" b JOIN "ServiceSlot" s ON s."id"=b."slotId"
           GROUP BY DATE_TRUNC('day',s."startsAt")
         ), payment_totals AS (
           SELECT DATE_TRUNC('day',"createdAt")::date AS "day",
             COUNT(*) FILTER (WHERE "status"='PAID')::int AS "payments",
             COALESCE(SUM("amountMinor") FILTER (WHERE "status"='PAID'),0)::bigint AS "revenueMinor"
           FROM "Payment" GROUP BY DATE_TRUNC('day',"createdAt")
         )
         SELECT COALESCE(b."day",p."day") AS "day",COALESCE(b."bookings",0) AS "bookings",
           COALESCE(b."completed",0) AS "completed",COALESCE(b."missed",0) AS "missed",
           COALESCE(p."payments",0) AS "payments",COALESCE(p."revenueMinor",0) AS "revenueMinor"
         FROM booking_totals b FULL JOIN payment_totals p USING ("day")
         ORDER BY "day" DESC LIMIT 60`,
      );
      break;
    case "audit":
      data = await rows(
        `SELECT a."id", a."action", a."entityType", a."entityId", a."metadata", a."createdAt", u."name" AS "actorName"
         FROM "AuditLog" a LEFT JOIN "AppUser" u ON u."id" = a."actorId"
         ORDER BY a."createdAt" DESC LIMIT 200`,
      );
      break;
  }

  return NextResponse.json({ view, data });
}

function isPortalView(value: string): value is PortalView {
  return [
    "dashboard", "profile", "vehicles", "membership", "services", "bookings", "history",
    "payments", "support", "notifications", "club", "parking", "cars", "customers",
    "plans", "subscriptions", "operations", "teams", "communities", "finance",
    "moderation", "reports", "audit", "jobs", "attendance",
    "myParking", "myCars", "rentalRequests", "carEnquiries", "savedCars", "parkingManage",
    "carListings", "rentalManagement", "carEnquiryManagement",
    "catalog", "serviceCatalog", "myBids", "inquiries", "parkingIncomingBids",
    "settings", "staffPermissions",
  ].includes(value);
}

async function rows(sql: string, params: unknown[] = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function hasActiveMembership(userId: string) {
  const { rows: result } = await pool.query(
    `SELECT 1 FROM "Subscription" WHERE "userId" = $1 AND "status" = 'ACTIVE'
      AND ("endsAt" IS NULL OR "endsAt">CURRENT_TIMESTAMP) LIMIT 1`,
    [userId],
  );
  return result.length > 0;
}

async function hasActiveClubAccess(userId: string) {
  const { rows: result } = await pool.query(
    `SELECT 1 FROM "Subscription" s JOIN "ServicePlan" p ON p."id" = s."planId"
     WHERE s."userId" = $1 AND s."status" = 'ACTIVE' AND p."clubAccess" = TRUE
       AND (s."endsAt" IS NULL OR s."endsAt">CURRENT_TIMESTAMP) LIMIT 1`,
    [userId],
  );
  return result.length > 0;
}
