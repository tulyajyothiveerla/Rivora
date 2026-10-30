import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, hasPermission, hasRole, isSameOrigin } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { platformFeatureEnabled } from "@/lib/platform-settings";

const bodySchema = z.record(z.string(), z.unknown());
const uuid = z.uuid();

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail("Cross-origin request rejected.", 403);
  const user = await getSessionUser();
  if (!user) return fail("Sign in to continue.", 401);
  const raw = await request.json().catch((error: unknown) => {
    if (error instanceof SyntaxError) return null;
    throw error;
  });
  const bodyResult = bodySchema.safeParse(raw);
  if (!bodyResult.success || typeof bodyResult.data.action !== "string") {
    return fail("Invalid action request.", 400);
  }
  const body = bodyResult.data;
  const action = body.action;
  if (typeof action !== "string") return fail("Invalid action request.", 400);
  if (action.startsWith("club.") && !(await platformFeatureEnabled("clubEnabled"))) {
    return fail("RIVORA Club is temporarily unavailable.", 503);
  }
  if (action.startsWith("parking.") && !(await platformFeatureEnabled("parkingEnabled"))) {
    return fail("The parking marketplace is temporarily unavailable.", 503);
  }
  if (action.startsWith("car.") && !(await platformFeatureEnabled("carMarketplaceEnabled"))) {
    return fail("The car marketplace is temporarily unavailable.", 503);
  }

  switch (body.action) {
    case "vehicle.add":
      return addVehicle(user, body);
    case "booking.request":
      return requestBooking(user, body);
    case "booking.cancel":
      return cancelBooking(user, body);
    case "support.create":
      return createTicket(user, body);
    case "membership.request":
      return requestMembership(user, body);
    case "profile.update":
      return updateProfile(user, body);
    case "notification.read":
      return markNotificationRead(user, body);
    case "plan.save":
      return savePlan(user, body);
    case "service.save":
      return saveService(user, body);
    case "slot.create":
      return createSlot(user, body);
    case "booking.assign":
      return assignWorker(user, body);
    case "booking.update":
      return updateBooking(user, body);
    case "subscription.update":
      return updateSubscription(user, body);
    case "ticket.update":
      return updateTicket(user, body);
    case "inquiry.update":
      return updateInquiry(user, body);
    case "payment.submit-reference":
      return submitPaymentReference(user, body);
    case "payment.reconcile":
      return reconcilePayment(user, body);
    case "community.save":
      return saveCommunity(user, body);
    case "customer.community":
      return setCustomerCommunity(user, body);
    case "customer.status":
      return setAccountStatus(user, body);
    case "worker.status":
      return setWorkerStatus(user, body);
    case "worker.create":
      return createWorker(user, body);
    case "job.status":
      return updateJob(user, body);
    case "attendance.clock-in":
      return clockIn(user);
    case "attendance.clock-out":
      return clockOut(user);
    case "club.post":
      return createClubPost(user, body);
    case "club.react":
      return reactToPost(user, body);
    case "club.privacy":
      return updateClubPrivacy(user, body);
    case "club.request":
      return requestConversation(user, body);
    case "club.reply":
      return replyToConversation(user, body);
    case "club.message":
      return sendClubMessage(user, body);
    case "club.decline":
      return declineConversation(user, body);
    case "club.lock":
      return lockConversation(user, body);
    case "club.block":
      return blockMember(user, body);
    case "club.report":
      return reportContent(user, body);
    case "parking.create":
      return createParkingListing(user, body);
    case "parking.bid":
      return placeParkingBid(user, body);
    case "parking.bid.review":
      return reviewParkingBid(user, body);
    case "parking.rent":
      return requestParkingRental(user, body);
    case "parking.status":
      return updateParkingStatus(user, body);
    case "rental.update":
      return updateRental(user, body);
    case "car.create":
      return createCarListing(user, body);
    case "car.status":
      return updateCarStatus(user, body);
    case "car.enquire":
      return enquireCar(user, body);
    case "car.save":
      return saveCar(user, body);
    case "settings.save":
      return savePlatformSettings(user, body);
    case "staff.permission":
      return setStaffPermission(user, body);
    case "report.review":
      return reviewReport(user, body);
    default:
      return fail("Unknown action.", 400);
  }
}

async function addVehicle(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("Customer access required.", 403);
  const parsed = z.object({
    make: z.string().trim().min(1).max(60), model: z.string().trim().min(1).max(80),
    year: z.preprocess(
      (value) => value === "" || value == null ? undefined : value,
      z.coerce.number().int().min(1950).max(2100).optional(),
    ),
    registration: z.string().trim().min(2).max(20).transform((x) => x.toUpperCase()),
    color: z.string().trim().max(40).optional(), parkingLocation: z.string().trim().max(120).optional(),
  }).safeParse(input);
  if (!parsed.success) return fail("Please check the vehicle details.", 400);
  const { rows } = await pool.query(
    `INSERT INTO "Vehicle" ("ownerId","make","model","year","registration","color","parkingLocation")
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING "id","make","model","year","registration","color","parkingLocation","createdAt"`,
    [user.id, parsed.data.make, parsed.data.model, parsed.data.year ?? null, parsed.data.registration,
      parsed.data.color || null, parsed.data.parkingLocation || null],
  );
  return ok({ vehicle: rows[0] }, 201);
}

async function requestBooking(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("Customer access required.", 403);
  const parsed = z.object({
    vehicleId: uuid, slotId: uuid, serviceId: uuid, notes: z.string().trim().max(500).optional(),
  }).safeParse(input);
  if (!parsed.success) return fail("Choose a vehicle, service and available time.", 400);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const vehicle = await client.query(
      `SELECT "id" FROM "Vehicle" WHERE "id" = $1 AND "ownerId" = $2`,
      [parsed.data.vehicleId, user.id],
    );
    if (vehicle.rowCount === 0) {
      await client.query("ROLLBACK");
      return fail("That vehicle is not in your account.", 404);
    }
    const slot = await client.query<{
      communityId: string; serviceId: string; capacity: number; startsAt: Date;
    }>(
      `SELECT "communityId","serviceId","capacity","startsAt"
       FROM "ServiceSlot" WHERE "id" = $1 FOR UPDATE`,
      [parsed.data.slotId],
    );
    if (slot.rowCount === 0 || slot.rows[0].serviceId !== parsed.data.serviceId ||
        slot.rows[0].communityId !== user.communityId || slot.rows[0].startsAt <= new Date()) {
      await client.query("ROLLBACK");
      return fail("That service time is no longer available.", 409);
    }
    const eligibility = await client.query(
      `SELECT s."id" FROM "Subscription" s
       JOIN "PlanService" ps ON ps."planId" = s."planId"
       WHERE s."userId" = $1 AND s."status" = 'ACTIVE' AND ps."serviceId" = $2
         AND (s."endsAt" IS NULL OR s."endsAt" > CURRENT_TIMESTAMP) LIMIT 1`,
      [user.id, parsed.data.serviceId],
    );
    if (eligibility.rowCount === 0) {
      await client.query("ROLLBACK");
      return fail("This service is not included in your active membership.", 403);
    }
    const count = await client.query(
      `SELECT COUNT(*)::int AS "booked" FROM "Booking"
       WHERE "slotId" = $1 AND "status" IN ('REQUESTED','CONFIRMED')`,
      [parsed.data.slotId],
    );
    if (count.rows[0].booked >= slot.rows[0].capacity) {
      await client.query("ROLLBACK");
      return fail("That service time is full. Please choose another.", 409);
    }
    const { rows } = await client.query(
      `INSERT INTO "Booking" ("userId","vehicleId","slotId","serviceId","subscriptionId","status","notes")
       VALUES ($1,$2,$3,$4,$5,'CONFIRMED',$6)
       RETURNING "id","status","createdAt"`,
      [user.id, parsed.data.vehicleId, parsed.data.slotId, parsed.data.serviceId,
        eligibility.rows[0].id, parsed.data.notes || null],
    );
    await client.query(
      `INSERT INTO "ServiceJob" ("bookingId") VALUES ($1)`,
      [rows[0].id],
    );
    await audit(client, user.id, "booking.confirmed", "Booking", rows[0].id);
    await client.query("COMMIT");
    return ok({ booking: rows[0] }, 201);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function cancelBooking(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER", "ADMIN")) return fail("Not authorized.", 403);
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return fail("Invalid booking.", 400);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE "Booking" b SET "status"='CANCELLED',"updatedAt"=CURRENT_TIMESTAMP
       FROM "ServiceSlot" sl
       WHERE b."id"=$1 AND b."slotId"=sl."id"
         AND b."status" IN ('REQUESTED','CONFIRMED') AND sl."startsAt">CURRENT_TIMESTAMP
         AND NOT EXISTS (SELECT 1 FROM "ServiceJob" j
           WHERE j."bookingId"=b."id" AND j."status"<>'ASSIGNED')
         AND ($2='ADMIN' OR b."userId"=$3)
       RETURNING b."id","status"`,
      [parsed.data.id, user.role, user.id],
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return fail("Booking not found, not yours, or too late to cancel.", 404);
    }
    await client.query(
      `UPDATE "ServiceJob" SET "workerId"=NULL,"updatedAt"=CURRENT_TIMESTAMP
       WHERE "bookingId"=$1 AND "status"='ASSIGNED'`,
      [rows[0].id],
    );
    await audit(client, user.id, "booking.cancelled", "Booking", rows[0].id);
    await client.query("COMMIT");
    return ok({ booking: rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createTicket(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("Customer access required.", 403);
  const parsed = z.object({
    subject: z.string().trim().min(3).max(160),
    description: z.string().trim().min(5).max(2000),
    bookingId: uuid.optional().or(z.literal("")),
  }).safeParse(input);
  if (!parsed.success) return fail("Please provide a subject and a little more detail.", 400);
  if (parsed.data.bookingId) {
    const owns = await pool.query(
      `SELECT 1 FROM "Booking" WHERE "id" = $1 AND "userId" = $2`,
      [parsed.data.bookingId, user.id],
    );
    if (!owns.rowCount) return fail("That booking is not in your account.", 404);
  }
  const { rows } = await pool.query(
    `INSERT INTO "SupportTicket" ("userId","bookingId","subject","description")
     VALUES ($1,NULLIF($2,'')::uuid,$3,$4) RETURNING "id","subject","status","createdAt"`,
    [user.id, parsed.data.bookingId || "", parsed.data.subject, parsed.data.description],
  );
  await writeAudit(user.id, "support.created", "SupportTicket", rows[0].id);
  return ok({ ticket: rows[0] }, 201);
}

async function requestMembership(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("Customer access required.", 403);
  const parsed = z.object({ planId: uuid }).safeParse(input);
  if (!parsed.success) return fail("Select an available membership.", 400);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const plan = await client.query(
      `SELECT "id","priceMinor","currency" FROM "ServicePlan"
       WHERE "id"=$1 AND "published"=TRUE AND "priceMinor">0 FOR SHARE`,
      [parsed.data.planId],
    );
    if (!plan.rows[0]) {
      await client.query("ROLLBACK");
      return fail("That membership is not currently available.", 404);
    }
    const { rows } = await client.query(
      `INSERT INTO "Subscription" ("userId","planId","status") VALUES ($1,$2,'PENDING')
       RETURNING "id","status","createdAt"`,
      [user.id, parsed.data.planId],
    );
    await client.query(
      `INSERT INTO "Payment" ("userId","subscriptionId","amountMinor","currency","status")
       VALUES ($1,$2,$3,$4,'PENDING')`,
      [user.id, rows[0].id, plan.rows[0].priceMinor, plan.rows[0].currency],
    );
    await audit(client, user.id, "subscription.requested", "Subscription", rows[0].id);
    await client.query("COMMIT");
    return ok({ subscription: rows[0], message: "Request recorded. Membership activates only after verified payment." }, 201);
  } catch (error) {
    await client.query("ROLLBACK");
    if (isDbCode(error, "23505")) {
      return fail("You already have a pending or active request for this membership.", 409);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function updateProfile(user: SessionUser, input: Record<string, unknown>) {
  const parsed = z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
    city: z.string().trim().min(2).max(80).optional(),
    communityRequest: z.string().trim().max(120).optional().or(z.literal("")),
    apartment: z.string().trim().max(80).optional().or(z.literal("")),
  }).safeParse(input);
  if (!parsed.success) return fail("Please check the profile details.", 400);
  const { rows } = await pool.query(
    `UPDATE "AppUser" SET "name" = $2, "phone" = NULLIF($3,''), "city" = COALESCE($4,"city"),
       "communityRequest" = NULLIF($5,''), "apartment" = NULLIF($6,''),
     "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1
     RETURNING "memberId","name","email","phone","city","communityRequest","apartment"`,
    [user.id, parsed.data.name, parsed.data.phone ?? "", parsed.data.city ?? null,
      parsed.data.communityRequest ?? "", parsed.data.apartment ?? ""],
  );
  await writeAudit(user.id, "profile.updated", "AppUser", user.id);
  return ok({ profile: rows[0] });
}

async function markNotificationRead(user: SessionUser, input: Record<string, unknown>) {
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return fail("Invalid notification.", 400);
  await pool.query(
    `UPDATE "Notification" SET "readAt" = COALESCE("readAt",CURRENT_TIMESTAMP)
     WHERE "id" = $1 AND "userId" = $2`,
    [parsed.data.id, user.id],
  );
  return ok({ message: "Notification updated." });
}

async function savePlan(user: SessionUser, input: Record<string, unknown>) {
  if (!hasPermission(user, "OPERATIONS")) return fail("Operations permission required.", 403);
  const parsed = z.object({
    id: uuid.optional(),
    name: z.enum(["Discovery", "Signature", "Privilege"]),
    description: z.string().trim().max(500),
    priceMinor: z.preprocess(
      (value) => value === "" || value == null ? undefined : value,
      z.coerce.number().int().min(0).optional(),
    ),
    currency: z.string().length(3).transform((x) => x.toUpperCase()).default("INR"),
    durationDays: z.coerce.number().int().min(1).max(3650),
    clubAccess: z.boolean(),
    published: z.boolean(),
    benefits: z.array(z.object({
      title: z.string().trim().min(1).max(120),
      description: z.string().trim().max(300).default(""),
      visitsPerPeriod: z.coerce.number().int().min(0).nullable().optional(),
    })).max(30),
    serviceIds: z.array(uuid).max(30),
  }).safeParse(input);
  if (!parsed.success) return fail("Please check the membership settings.", 400);
  if (parsed.data.published && (parsed.data.priceMinor == null || parsed.data.priceMinor === 0)) {
    return fail("Published memberships require a confirmed non-zero price.", 400);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let planId = parsed.data.id;
    if (planId) {
      const { rowCount } = await client.query(
        `UPDATE "ServicePlan" SET "description"=$2,"priceMinor"=$3,"currency"=$4,"durationDays"=$5,
         "clubAccess"=$6,"published"=$7,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "name"=$8`,
        [planId, parsed.data.description, parsed.data.priceMinor ?? null, parsed.data.currency,
          parsed.data.durationDays, parsed.data.clubAccess, parsed.data.published, parsed.data.name],
      );
      if (!rowCount) {
        await client.query("ROLLBACK");
        return fail("Membership not found.", 404);
      }
      await client.query(`DELETE FROM "PlanBenefit" WHERE "planId"=$1`, [planId]);
      await client.query(`DELETE FROM "PlanService" WHERE "planId"=$1`, [planId]);
    } else {
      const { rows } = await client.query(
        `INSERT INTO "ServicePlan" ("name","description","priceMinor","currency","durationDays","clubAccess","published")
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING "id"`,
        [parsed.data.name, parsed.data.description, parsed.data.priceMinor ?? null,
          parsed.data.currency, parsed.data.durationDays, parsed.data.clubAccess, parsed.data.published],
      );
      planId = rows[0].id;
    }
    for (const benefit of parsed.data.benefits) {
      await client.query(
        `INSERT INTO "PlanBenefit" ("planId","title","description","visitsPerPeriod") VALUES ($1,$2,$3,$4)`,
        [planId, benefit.title, benefit.description, benefit.visitsPerPeriod ?? null],
      );
    }
    for (const serviceId of parsed.data.serviceIds) {
      await client.query(
        `INSERT INTO "PlanService" ("planId","serviceId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [planId, serviceId],
      );
    }
    if (!planId) throw new Error("Membership save did not produce a plan ID.");
    await audit(client, user.id, "plan.saved", "ServicePlan", planId);
    await client.query("COMMIT");
    return ok({ message: "Membership settings saved." });
  } catch (error) {
    await client.query("ROLLBACK");
    if (isDbCode(error, "23505")) return fail("That membership already exists.", 409);
    throw error;
  } finally {
    client.release();
  }
}

async function saveService(user: SessionUser, input: Record<string, unknown>) {
  if (!hasPermission(user, "OPERATIONS")) return fail("Operations permission required.", 403);
  const parsed = z.object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).default(""),
    active: z.boolean().default(true),
  }).safeParse(input);
  if (!parsed.success) return fail("Please check the service details.", 400);
  const { rows } = await pool.query(
    `INSERT INTO "ServiceCatalog" ("name","description","active") VALUES ($1,$2,$3)
     ON CONFLICT ("name") DO UPDATE SET "description"=EXCLUDED."description","active"=EXCLUDED."active"
     RETURNING "id","name","description","active"`,
    [parsed.data.name, parsed.data.description, parsed.data.active],
  );
  await writeAudit(user.id, "service.saved", "ServiceCatalog", rows[0].id);
  return ok({ service: rows[0] }, 201);
}

async function createSlot(user: SessionUser, input: Record<string, unknown>) {
  if (!hasPermission(user, "OPERATIONS")) return fail("Operations permission required.", 403);
  const parsed = z.object({
    communityId: uuid, serviceId: uuid,
    startsAt: z.iso.datetime(), endsAt: z.iso.datetime(),
    capacity: z.coerce.number().int().min(1).max(50),
  }).safeParse(input);
  if (!parsed.success) return fail("Please check the service window details.", 400);
  if (new Date(parsed.data.startsAt) <= new Date() ||
      new Date(parsed.data.endsAt) <= new Date(parsed.data.startsAt)) {
    return fail("Choose a valid future time, community, service and capacity.", 400);
  }
  const { rows } = await pool.query(
    `INSERT INTO "ServiceSlot" ("communityId","serviceId","startsAt","endsAt","capacity")
     SELECT c."id",s."id",$3,$4,$5 FROM "Community" c CROSS JOIN "ServiceCatalog" s
     WHERE c."id"=$1 AND c."active"=TRUE AND s."id"=$2 AND s."active"=TRUE
     RETURNING "id","startsAt","endsAt","capacity"`,
    [parsed.data.communityId, parsed.data.serviceId, parsed.data.startsAt, parsed.data.endsAt, parsed.data.capacity],
  );
  if (!rows[0]) return fail("Community or service is unavailable.", 404);
  await writeAudit(user.id, "service_slot.created", "ServiceSlot", rows[0].id);
  return ok({ slot: rows[0] }, 201);
}

async function assignWorker(user: SessionUser, input: Record<string, unknown>) {
  if (!hasPermission(user, "OPERATIONS")) return fail("Operations permission required.", 403);
  const parsed = z.object({ bookingId: uuid, workerId: uuid }).safeParse(input);
  if (!parsed.success) return fail("Choose a booking and worker.", 400);
  const { rows } = await pool.query(
    `UPDATE "ServiceJob" j SET "workerId"=$2,"updatedAt"=CURRENT_TIMESTAMP
     FROM "AppUser" u,"Booking" b
     WHERE j."bookingId"=$1 AND u."id"=$2 AND u."role"='WORKER' AND u."status"='ACTIVE'
       AND b."id"=j."bookingId" AND j."status"='ASSIGNED' AND b."status" IN ('REQUESTED','CONFIRMED')
     RETURNING j."id","bookingId","workerId"`,
    [parsed.data.bookingId, parsed.data.workerId],
  );
  if (!rows[0]) return fail("Pending job or active worker not found.", 404);
  await writeAudit(user.id, "job.assigned", "ServiceJob", rows[0].id, { workerId: rows[0].workerId });
  return ok({ assignment: rows[0] });
}

async function updateBooking(user: SessionUser, input: Record<string, unknown>) {
  if (!hasPermission(user, "OPERATIONS")) return fail("Operations permission required.", 403);
  const parsed = z.object({
    id: uuid, status: z.enum(["REQUESTED", "CONFIRMED", "CANCELLED", "MISSED"]),
    slotId: uuid.optional(),
  }).safeParse(input);
  if (!parsed.success) return fail("Invalid booking update.", 400);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ id: string; slotId: string; serviceId: string; status: string }>(
      `SELECT "id","slotId","serviceId","status" FROM "Booking" WHERE "id"=$1 FOR UPDATE`,
      [parsed.data.id],
    );
    if (!current.rows[0]) {
      await client.query("ROLLBACK");
      return fail("Booking not found.", 404);
    }
    const allowed = current.rows[0].status === "REQUESTED"
      ? ["REQUESTED", "CONFIRMED", "CANCELLED", "MISSED"]
      : current.rows[0].status === "CONFIRMED"
        ? ["CONFIRMED", "CANCELLED", "MISSED"]
        : [];
    if (!allowed.includes(parsed.data.status)) {
      await client.query("ROLLBACK");
      return fail("This booking can no longer be moved to that status.", 409);
    }
    if (parsed.data.status === "CANCELLED") {
      const job = await client.query<{ status: string }>(
        `SELECT "status" FROM "ServiceJob" WHERE "bookingId"=$1 FOR UPDATE`,
        [parsed.data.id],
      );
      if (job.rows[0] && job.rows[0].status !== "ASSIGNED") {
        await client.query("ROLLBACK");
        return fail("A service already in progress cannot be cancelled from the schedule.", 409);
      }
    }
    const slotId = parsed.data.slotId ?? current.rows[0].slotId;
    if (parsed.data.slotId) {
      const slot = await client.query<{ serviceId: string; capacity: number; startsAt: Date }>(
        `SELECT "serviceId","capacity","startsAt" FROM "ServiceSlot" WHERE "id"=$1 FOR UPDATE`,
        [parsed.data.slotId],
      );
      if (!slot.rows[0] || slot.rows[0].serviceId !== current.rows[0].serviceId || slot.rows[0].startsAt <= new Date()) {
        await client.query("ROLLBACK");
        return fail("Choose a future slot for the same service.", 409);
      }
      const seats = await client.query(
        `SELECT COUNT(*)::int AS "booked" FROM "Booking"
         WHERE "slotId"=$1 AND "status" IN ('REQUESTED','CONFIRMED') AND "id"<>$2`,
        [slotId, parsed.data.id],
      );
      if (seats.rows[0].booked >= slot.rows[0].capacity) {
        await client.query("ROLLBACK");
        return fail("That service slot is full.", 409);
      }
    }
    const { rows } = await client.query(
      `UPDATE "Booking" SET "status"=$2,"slotId"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1
       RETURNING "id","status","slotId"`,
      [parsed.data.id, parsed.data.status, slotId],
    );
    if (parsed.data.status === "CANCELLED") {
      await client.query(
        `UPDATE "ServiceJob" SET "workerId"=NULL,"updatedAt"=CURRENT_TIMESTAMP
         WHERE "bookingId"=$1 AND "status"='ASSIGNED'`,
        [rows[0].id],
      );
    }
    await audit(client, user.id, "booking.updated", "Booking", rows[0].id, { status: rows[0].status });
    await client.query("COMMIT");
    return ok({ booking: rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateSubscription(user: SessionUser, input: Record<string, unknown>) {
  if (!hasPermission(user, "OPERATIONS")) return fail("Operations permission required.", 403);
  const parsed = z.object({
    id: uuid, status: z.enum(["PAUSED", "CANCELLED"]),
  }).safeParse(input);
  if (!parsed.success) return fail("Invalid subscription update.", 400);
  const { rows } = await pool.query(
    `UPDATE "Subscription" SET "status"=$2,"updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=$1 AND "status" IN ('ACTIVE','PAUSED')
     RETURNING "id","status"`,
    [parsed.data.id, parsed.data.status],
  );
  if (!rows[0]) return fail("Subscription not found or cannot be changed.", 404);
  await writeAudit(user.id, "subscription.updated", "Subscription", rows[0].id, { status: rows[0].status });
  return ok({ subscription: rows[0] });
}

async function createWorker(user: SessionUser, input: Record<string, unknown>) {
  if (!hasPermission(user, "TEAM_MANAGEMENT")) return fail("Team-management permission required.", 403);
  const parsed = z.object({
    name: z.string().trim().min(2).max(80),
    email: z.email().max(254).transform((value) => value.toLowerCase()),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
    password: z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
  }).safeParse(input);
  if (!parsed.success) return fail("Provide a name, valid email, and temporary password of at least 12 characters.", 400);
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  try {
    const { rows } = await pool.query(
      `INSERT INTO "AppUser" ("name","email","phone","passwordHash","role","emailVerifiedAt")
       VALUES ($1,$2,NULLIF($3,''),$4,'WORKER',CURRENT_TIMESTAMP)
       RETURNING "id","memberId","name","email","role","status"`,
      [parsed.data.name, parsed.data.email, parsed.data.phone ?? "", passwordHash],
    );
    await writeAudit(user.id, "worker.account_created", "AppUser", rows[0].id);
    return ok({ worker: rows[0] }, 201);
  } catch (error) {
    if (isDbCode(error, "23505")) return fail("An account with this email already exists.", 409);
    throw error;
  }
}

async function updateTicket(user: SessionUser, input: Record<string, unknown>) {
  if (!hasPermission(user, "SUPPORT")) return fail("Support permission required.", 403);
  const parsed = z.object({
    id: uuid, status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
    resolution: z.string().trim().max(1000).optional(),
  }).safeParse(input);
  if (!parsed.success) return fail("Invalid support update.", 400);
  if (parsed.data.status === "RESOLVED" && !parsed.data.resolution?.trim()) {
    return fail("Add a resolution note before resolving a ticket.", 400);
  }
  const { rows } = await pool.query(
    `UPDATE "SupportTicket" SET "status"=$2,"resolution"=NULLIF($3,''),"updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=$1 RETURNING "id","status"`,
    [parsed.data.id, parsed.data.status, parsed.data.resolution ?? ""],
  );
  if (!rows[0]) return fail("Support request not found.", 404);
  await writeAudit(user.id, "support.updated", "SupportTicket", rows[0].id, { status: rows[0].status });
  return ok({ ticket: rows[0] });
}

async function updateInquiry(user: SessionUser, input: Record<string, unknown>) {
  if (!hasPermission(user, "SUPPORT")) return fail("Support permission required.", 403);
  const parsed = z.object({
    id: uuid, status: z.enum(["NEW", "CONTACTED", "CLOSED"]),
  }).safeParse(input);
  if (!parsed.success) return fail("Invalid public enquiry update.", 400);
  const { rows } = await pool.query(
    `UPDATE "ContactInquiry" SET "status"=$2,"updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=$1 RETURNING "id","status"`,
    [parsed.data.id, parsed.data.status],
  );
  if (!rows[0]) return fail("Public enquiry not found.", 404);
  await writeAudit(user.id, "public_inquiry.updated", "ContactInquiry", rows[0].id,
    { status: rows[0].status });
  return ok({ inquiry: rows[0] });
}

async function submitPaymentReference(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("Customer access required.", 403);
  const parsed = z.object({
    id: uuid, providerReference: z.string().trim().min(4).max(160),
  }).safeParse(input);
  if (!parsed.success) return fail("Enter the payment reference from your payment provider.", 400);
  try {
    const { rows } = await pool.query(
      `UPDATE "Payment" SET "providerReference"=$3,"status"='PENDING'
       WHERE "id"=$1 AND "userId"=$2 AND "status" IN ('PENDING','FAILED')
       RETURNING "id","status"`,
      [parsed.data.id, user.id, parsed.data.providerReference],
    );
    if (!rows[0]) return fail("Pending payment not found.", 404);
    await writeAudit(user.id, "payment.reference_submitted", "Payment", rows[0].id);
    return ok({ payment: rows[0], message: "Reference sent for operations reconciliation." });
  } catch (error) {
    if (isDbCode(error, "23505")) return fail("That provider reference has already been submitted.", 409);
    throw error;
  }
}

async function reconcilePayment(user: SessionUser, input: Record<string, unknown>) {
  if (!hasPermission(user, "FINANCE")) return fail("Finance permission required.", 403);
  const parsed = z.object({
    id: uuid, status: z.enum(["PAID", "FAILED", "REFUNDED"]),
    providerReference: z.string().trim().min(4).max(160),
    verificationNote: z.string().trim().min(5).max(500),
  }).safeParse(input);
  if (!parsed.success) return fail("Provide the provider reference and reconciliation note.", 400);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const payment = await client.query<{
      id: string; userId: string; subscriptionId: string | null; status: string; providerReference: string | null;
    }>(
      `SELECT "id","userId","subscriptionId","status","providerReference"
       FROM "Payment" WHERE "id"=$1 FOR UPDATE`,
      [parsed.data.id],
    );
    const item = payment.rows[0];
    if (!item ||
        (parsed.data.status === "REFUNDED" ? item.status !== "PAID" : item.status !== "PENDING")) {
      await client.query("ROLLBACK");
      return fail("Payment is not in a state that can be reconciled to this result.", 409);
    }
    if (item.providerReference && item.providerReference !== parsed.data.providerReference) {
      await client.query("ROLLBACK");
      return fail("Reference does not match the customer's submitted payment.", 409);
    }
    await client.query(
      `UPDATE "Payment" SET "status"=$2,"providerReference"=$3,
         "paidAt"=CASE WHEN $2='PAID'::"PaymentStatus" THEN CURRENT_TIMESTAMP ELSE "paidAt" END
       WHERE "id"=$1`,
      [item.id, parsed.data.status, parsed.data.providerReference],
    );
    if (parsed.data.status === "PAID" && item.subscriptionId) {
      const activated = await client.query(
        `UPDATE "Subscription" s SET "status"='ACTIVE',"startsAt"=CURRENT_TIMESTAMP,
           "endsAt"=CURRENT_TIMESTAMP + make_interval(days => p."durationDays"),"updatedAt"=CURRENT_TIMESTAMP
         FROM "ServicePlan" p WHERE s."id"=$1 AND s."planId"=p."id" AND s."status"='PENDING'
         RETURNING s."id","userId","endsAt"`,
        [item.subscriptionId],
      );
      if (!activated.rowCount) {
        await client.query("ROLLBACK");
        return fail("Payment is pending for a subscription that is no longer eligible for activation.", 409);
      }
      await client.query(
        `INSERT INTO "Notification" ("userId","title","body")
         VALUES ($1,'Your RIVORA membership is active','Your payment has been reconciled. Your membership is ready.')`,
        [item.userId],
      );
    }
    if (parsed.data.status === "REFUNDED" && item.subscriptionId) {
      await client.query(
        `UPDATE "Subscription" SET "status"='CANCELLED',"updatedAt"=CURRENT_TIMESTAMP
         WHERE "id"=$1 AND "status" IN ('ACTIVE','PAUSED')`,
        [item.subscriptionId],
      );
    }
    await audit(client, user.id, "payment.reconciled", "Payment", item.id,
      { status: parsed.data.status, providerReference: parsed.data.providerReference,
        verificationNote: parsed.data.verificationNote });
    await client.query("COMMIT");
    return ok({ message: `Payment marked ${parsed.data.status.toLowerCase()}.` });
  } catch (error) {
    await client.query("ROLLBACK");
    if (isDbCode(error, "23505")) return fail("That provider reference has already been recorded.", 409);
    throw error;
  } finally {
    client.release();
  }
}

async function saveCommunity(user: SessionUser, input: Record<string, unknown>) {
  if (!hasPermission(user, "COMMUNITIES")) return fail("Community-management permission required.", 403);
  const parsed = z.object({
    id: uuid.optional(), name: z.string().trim().min(2).max(120), city: z.string().trim().min(2).max(80),
    address: z.string().trim().max(300).optional(), capacity: z.coerce.number().int().min(0).max(10000),
    active: z.boolean().default(true),
  }).safeParse(input);
  if (!parsed.success) return fail("Please check the community details.", 400);
  const { rows } = await pool.query(
    parsed.data.id
      ? `UPDATE "Community" SET "name"=$2,"city"=$3,"address"=NULLIF($4,''),"capacity"=$5,"active"=$6
         WHERE "id"=$1 RETURNING "id","name","city","capacity","active"`
      : `INSERT INTO "Community" ("name","city","address","capacity","active")
         VALUES ($1,$2,NULLIF($3,''),$4,$5) RETURNING "id","name","city","capacity","active"`,
    parsed.data.id
      ? [parsed.data.id, parsed.data.name, parsed.data.city, parsed.data.address ?? "", parsed.data.capacity, parsed.data.active]
      : [parsed.data.name, parsed.data.city, parsed.data.address ?? "", parsed.data.capacity, parsed.data.active],
  );
  if (!rows[0]) return fail("Community not found.", 404);
  await writeAudit(user.id, "community.saved", "Community", rows[0].id);
  return ok({ community: rows[0] }, parsed.data.id ? 200 : 201);
}

async function setCustomerCommunity(user: SessionUser, input: Record<string, unknown>) {
  if (!hasPermission(user, "CUSTOMERS")) return fail("Customer-management permission required.", 403);
  const parsed = z.object({ userId: uuid, communityId: uuid.optional().or(z.literal("")) }).safeParse(input);
  if (!parsed.success) return fail("Invalid customer or community.", 400);
  const { rows } = await pool.query(
    `UPDATE "AppUser" u SET "communityId"=NULLIF($2,'')::uuid,"updatedAt"=CURRENT_TIMESTAMP
     WHERE u."id"=$1 AND u."role"='CUSTOMER'
       AND ($2='' OR EXISTS (SELECT 1 FROM "Community" c WHERE c."id"=NULLIF($2,'')::uuid AND c."active"=TRUE))
     RETURNING "id","name","communityId"::text AS "communityId"`,
    [parsed.data.userId, parsed.data.communityId || ""],
  );
  if (!rows[0]) return fail("Customer or active community not found.", 404);
  await writeAudit(user.id, "customer.community_verified", "AppUser", rows[0].id, { communityId: rows[0].communityId });
  if (rows[0].communityId) {
    await pool.query(
      `INSERT INTO "Notification" ("userId","title","body")
       VALUES ($1,'Your community is verified','RIVORA service availability and community features are now linked to your account.')`,
      [rows[0].id],
    );
  }
  return ok({ customer: rows[0] });
}

async function setAccountStatus(user: SessionUser, input: Record<string, unknown>) {
  if (!hasPermission(user, "CUSTOMERS")) return fail("Customer-management permission required.", 403);
  const parsed = z.object({ userId: uuid, status: z.enum(["ACTIVE", "SUSPENDED"]) }).safeParse(input);
  if (!parsed.success) return fail("Invalid account status.", 400);
  const { rows } = await pool.query(
    `UPDATE "AppUser" SET "status"=$2,"updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=$1 AND "role"='CUSTOMER' RETURNING "id","name","status"`,
    [parsed.data.userId, parsed.data.status],
  );
  if (!rows[0]) return fail("Customer not found.", 404);
  await writeAudit(user.id, "customer.status_changed", "AppUser", rows[0].id, { status: rows[0].status });
  return ok({ customer: rows[0] });
}

async function setWorkerStatus(user: SessionUser, input: Record<string, unknown>) {
  if (!hasPermission(user, "TEAM_MANAGEMENT")) return fail("Team-management permission required.", 403);
  const parsed = z.object({ userId: uuid, status: z.enum(["ACTIVE", "SUSPENDED"]) }).safeParse(input);
  if (!parsed.success) return fail("Invalid worker status.", 400);
  const { rows } = await pool.query(
    `UPDATE "AppUser" SET "status"=$2,"updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=$1 AND "role"='WORKER' RETURNING "id","name","status"`,
    [parsed.data.userId, parsed.data.status],
  );
  if (!rows[0]) return fail("Worker not found.", 404);
  await writeAudit(user.id, "worker.status_changed", "AppUser", rows[0].id, { status: rows[0].status });
  return ok({ worker: rows[0] });
}

async function updateJob(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "WORKER", "ADMIN")) return fail("Worker access required.", 403);
  const parsed = z.object({
    id: uuid, status: z.enum(["ARRIVED", "STARTED", "COMPLETED", "ISSUE"]),
    completionNotes: z.string().trim().max(1000).optional(),
    proofUrls: z.array(
      z.union([
        z.url().startsWith("https://"),
        z.string().regex(/^\/api\/portal\/media\/[0-9a-f-]{36}$/i),
      ]),
    ).max(10).default([]),
    issue: z.string().trim().max(1000).optional(),
  }).safeParse(input);
  if (!parsed.success) return fail("Please check the service update.", 400);
  if (parsed.data.status === "COMPLETED" && (!parsed.data.completionNotes?.trim() || parsed.data.proofUrls.length === 0)) {
    return fail("Completion needs service notes and at least one secure image or HTTPS proof link.", 400);
  }
  if (parsed.data.status === "ISSUE" && !parsed.data.issue?.trim()) {
    return fail("Describe the issue for the operations team.", 400);
  }
  if (!(await ownsMemberMedia(user.id, parsed.data.proofUrls, "PRIVATE"))) {
    return fail("Completion images must be uploaded by your account.", 403);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const jobReference = await client.query<{ bookingId: string }>(
      `SELECT "bookingId" FROM "ServiceJob" WHERE "id"=$1`,
      [parsed.data.id],
    );
    if (!jobReference.rows[0]) {
      await client.query("ROLLBACK");
      return fail("Service assignment not found.", 404);
    }
    const booking = await client.query<{ status: string }>(
      `SELECT "status" FROM "Booking" WHERE "id"=$1 FOR UPDATE`,
      [jobReference.rows[0].bookingId],
    );
    if (!booking.rows[0] || !["REQUESTED", "CONFIRMED", "MISSED"].includes(booking.rows[0].status)) {
      await client.query("ROLLBACK");
      return fail("This service has been cancelled or is no longer active.", 409);
    }
    const assignment = await client.query<{ status: string; bookingId: string }>(
      `SELECT "status","bookingId" FROM "ServiceJob"
       WHERE "id"=$1 AND "bookingId"=$2 AND ($3='ADMIN' OR "workerId"=$4) FOR UPDATE`,
      [parsed.data.id, jobReference.rows[0].bookingId, user.role, user.id],
    );
    if (!assignment.rows[0]) {
      await client.query("ROLLBACK");
      return fail("Service assignment not found.", 404);
    }
    const transitions: Record<string, string[]> = {
      ASSIGNED: ["ARRIVED", "ISSUE"], ARRIVED: ["STARTED", "ISSUE"],
      STARTED: ["COMPLETED", "ISSUE"], ISSUE: ["ARRIVED", "STARTED"],
    };
    if (!transitions[assignment.rows[0].status]?.includes(parsed.data.status)) {
      await client.query("ROLLBACK");
      return fail(`A service cannot move from ${assignment.rows[0].status} to ${parsed.data.status}.`, 409);
    }
    const { rows } = await client.query(
      `UPDATE "ServiceJob" SET "status"=$2,
         "arrivalAt"=CASE WHEN $2='ARRIVED'::"JobStatus" THEN CURRENT_TIMESTAMP ELSE "arrivalAt" END,
         "startedAt"=CASE WHEN $2='STARTED'::"JobStatus" THEN CURRENT_TIMESTAMP ELSE "startedAt" END,
         "completedAt"=CASE WHEN $2='COMPLETED'::"JobStatus" THEN CURRENT_TIMESTAMP ELSE "completedAt" END,
         "completionNotes"=COALESCE(NULLIF($3,''),"completionNotes"),
         "proofUrls"=CASE WHEN $2='COMPLETED'::"JobStatus" THEN $4 ELSE "proofUrls" END,
         "issue"=CASE WHEN $2='ISSUE'::"JobStatus" THEN $5 ELSE NULL END,
         "updatedAt"=CURRENT_TIMESTAMP
       WHERE "id"=$1 RETURNING "id","bookingId","status","completedAt","issue"`,
      [parsed.data.id, parsed.data.status, parsed.data.completionNotes ?? "",
        parsed.data.proofUrls, parsed.data.issue ?? null],
    );
    if (parsed.data.status === "COMPLETED") {
      await client.query(
        `UPDATE "Booking" SET "status"='COMPLETED',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
        [rows[0].bookingId],
      );
    }
    if (parsed.data.status === "ISSUE") {
      await client.query(
        `UPDATE "Booking" SET "status"='MISSED',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
        [rows[0].bookingId],
      );
    }
    if (booking.rows[0].status === "MISSED" && ["ARRIVED", "STARTED"].includes(parsed.data.status)) {
      await client.query(
        `UPDATE "Booking" SET "status"='CONFIRMED',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
        [rows[0].bookingId],
      );
    }
    await audit(client, user.id, "job.status_updated", "ServiceJob", rows[0].id, { status: rows[0].status });
    await client.query("COMMIT");
    return ok({ job: rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function clockIn(user: SessionUser) {
  if (!hasRole(user, "WORKER")) return fail("Worker access required.", 403);
  const { rows } = await pool.query(
    `INSERT INTO "WorkerAttendance" ("workerId") VALUES ($1)
     ON CONFLICT ("workerId","workDate") DO UPDATE SET "clockInAt"=EXCLUDED."clockInAt","clockOutAt"=NULL
     WHERE "WorkerAttendance"."clockOutAt" IS NOT NULL
     RETURNING "id","workDate","clockInAt"`,
    [user.id],
  );
  if (!rows[0]) return fail("You are already clocked in for today.", 409);
  return ok({ attendance: rows[0] }, 201);
}

async function clockOut(user: SessionUser) {
  if (!hasRole(user, "WORKER")) return fail("Worker access required.", 403);
  const { rows } = await pool.query(
    `UPDATE "WorkerAttendance" SET "clockOutAt"=CURRENT_TIMESTAMP
     WHERE "workerId"=$1 AND "workDate"=CURRENT_DATE AND "clockOutAt" IS NULL
     RETURNING "id","workDate","clockInAt","clockOutAt"`,
    [user.id],
  );
  if (!rows[0]) return fail("No active attendance entry was found.", 404);
  return ok({ attendance: rows[0] });
}

async function createClubPost(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("RIVORA Club is for customers.", 403);
  const parsed = z.object({
    body: z.string().trim().min(1).max(2000),
    audience: z.enum(["CLUB", "COMMUNITY", "PRIVATE"]),
  }).safeParse(input);
  if (!parsed.success) return fail("Add a post and choose who can see it.", 400);
  if (!(await hasClubAccess(user.id))) return fail("An active Signature or Privilege membership is required.", 403);
  if (parsed.data.audience === "COMMUNITY" && !user.communityId) {
    return fail("Community sharing is available after your community has been verified.", 403);
  }
  const { rows } = await pool.query(
    `INSERT INTO "ClubPost" ("userId","body","audience","communityId")
     VALUES ($1,$2,$3,CASE WHEN $3='COMMUNITY'::"Audience" THEN $4::uuid ELSE NULL END)
     RETURNING "id","body","audience","createdAt"`,
    [user.id, parsed.data.body, parsed.data.audience, user.communityId],
  );
  await writeAudit(user.id, "club.post_created", "ClubPost", rows[0].id);
  return ok({ post: rows[0] }, 201);
}

async function reactToPost(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("RIVORA Club is for customers.", 403);
  const parsed = z.object({ postId: uuid, reaction: z.enum(["LIKE", "LOVE"]).nullable() }).safeParse(input);
  if (!parsed.success) return fail("Choose Like or Love.", 400);
  if (!(await hasClubAccess(user.id))) return fail("An active Club membership is required.", 403);
  const visible = await pool.query(
    `SELECT 1 FROM "ClubPost" p
     WHERE p."id"=$1 AND p."hidden"=FALSE AND (
       p."userId"=$2 OR
       (p."audience"='CLUB' AND EXISTS (
         SELECT 1 FROM "Subscription" s JOIN "ServicePlan" pl ON pl."id"=s."planId"
         WHERE s."userId"=p."userId" AND s."status"='ACTIVE' AND pl."clubAccess"=TRUE))
       OR (p."audience"='COMMUNITY' AND p."communityId"=$3)
     ) AND NOT EXISTS (
       SELECT 1 FROM "ClubBlock" b WHERE (b."blockerId"=$2 AND b."blockedId"=p."userId")
         OR (b."blockerId"=p."userId" AND b."blockedId"=$2))`,
    [parsed.data.postId, user.id, user.communityId],
  );
  if (!visible.rowCount) return fail("Post not found or unavailable.", 404);
  if (parsed.data.reaction === null) {
    await pool.query(`DELETE FROM "ClubReaction" WHERE "postId"=$1 AND "userId"=$2`, [parsed.data.postId, user.id]);
  } else {
    await pool.query(
      `INSERT INTO "ClubReaction" ("postId","userId","reaction") VALUES ($1,$2,$3)
       ON CONFLICT ("postId","userId") DO UPDATE SET "reaction"=EXCLUDED."reaction","createdAt"=CURRENT_TIMESTAMP`,
      [parsed.data.postId, user.id, parsed.data.reaction],
    );
  }
  return ok({ message: "Reaction updated." });
}

async function updateClubPrivacy(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("RIVORA Club is for customers.", 403);
  const parsed = z.object({
    bio: z.string().trim().max(300).optional().or(z.literal("")),
    displayName: z.string().trim().max(60).optional().or(z.literal("")),
    audience: z.enum(["CLUB", "COMMUNITY", "PRIVATE"]),
    acceptRequests: z.enum(["ALL", "COMMUNITY", "NONE"]),
    pauseMessaging: z.boolean(),
  }).safeParse(input);
  if (!parsed.success) return fail("Please check your Club profile settings.", 400);
  if (parsed.data.audience === "COMMUNITY" && !user.communityId) {
    return fail("Community sharing is available after your community has been verified.", 403);
  }
  const { rows } = await pool.query(
    `INSERT INTO "ClubProfile" ("userId","bio","displayName","audience","acceptRequests","pauseMessaging")
     VALUES ($1,NULLIF($2,''),NULLIF($3,''),$4,$5,$6)
     ON CONFLICT ("userId") DO UPDATE SET "bio"=EXCLUDED."bio","displayName"=EXCLUDED."displayName",
       "audience"=EXCLUDED."audience","acceptRequests"=EXCLUDED."acceptRequests",
       "pauseMessaging"=EXCLUDED."pauseMessaging"
     RETURNING "bio","displayName","audience","acceptRequests","pauseMessaging"`,
    [user.id, parsed.data.bio ?? "", parsed.data.displayName ?? "", parsed.data.audience,
      parsed.data.acceptRequests, parsed.data.pauseMessaging],
  );
  await writeAudit(user.id, "club.privacy_updated", "ClubProfile", user.id);
  return ok({ profile: rows[0] });
}

async function requestConversation(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("RIVORA Club is for customers.", 403);
  const parsed = z.object({
    recipientId: uuid,
    body: z.string().trim().min(1).max(2000),
  }).safeParse(input);
  if (!parsed.success || parsed.data.recipientId === user.id) return fail("Choose a member and write a message.", 400);
  if (!(await hasClubAccess(user.id)) || !(await hasClubAccess(parsed.data.recipientId))) {
    return fail("Both members need an active qualifying membership.", 403);
  }
  const target = await pool.query<{
    acceptRequests: string; pauseMessaging: boolean; communityId: string | null;
  }>(
    `SELECT u."communityId"::text AS "communityId",
       COALESCE(p."acceptRequests",'ALL') AS "acceptRequests",
       COALESCE(p."pauseMessaging",FALSE) AS "pauseMessaging"
     FROM "AppUser" u LEFT JOIN "ClubProfile" p ON p."userId"=u."id"
     WHERE u."id"=$1 AND u."status"='ACTIVE'`,
    [parsed.data.recipientId],
  );
  if (!target.rows[0] || target.rows[0].pauseMessaging || target.rows[0].acceptRequests === "NONE" ||
      (target.rows[0].acceptRequests === "COMMUNITY" &&
       (!user.communityId || user.communityId !== target.rows[0].communityId))) {
    return fail("This member is not accepting message requests from your account.", 403);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const blocked = await client.query(
      `SELECT 1 FROM "ClubBlock" WHERE ("blockerId"=$1 AND "blockedId"=$2)
       OR ("blockerId"=$2 AND "blockedId"=$1)`,
      [user.id, parsed.data.recipientId],
    );
    if (blocked.rowCount) {
      await client.query("ROLLBACK");
      return fail("This member cannot receive your request.", 403);
    }
    const existing = await client.query(
      `SELECT 1 FROM "ClubConversation" WHERE ("requesterId"=$1 AND "recipientId"=$2)
       OR ("requesterId"=$2 AND "recipientId"=$1)`,
      [user.id, parsed.data.recipientId],
    );
    if (existing.rowCount) {
      await client.query("ROLLBACK");
      return fail("A message request already exists for these members.", 409);
    }
    const { rows } = await client.query(
      `INSERT INTO "ClubConversation" ("requesterId","recipientId") VALUES ($1,$2) RETURNING "id","status"`,
      [user.id, parsed.data.recipientId],
    );
    await client.query(
      `INSERT INTO "ClubMessage" ("conversationId","senderId","body") VALUES ($1,$2,$3)`,
      [rows[0].id, user.id, parsed.data.body],
    );
    await audit(client, user.id, "club.message_request_created", "ClubConversation", rows[0].id);
    await client.query("COMMIT");
    return ok({ conversation: rows[0] }, 201);
  } catch (error) {
    await client.query("ROLLBACK");
    if (isDbCode(error, "23505")) return fail("A message request already exists for these members.", 409);
    throw error;
  } finally {
    client.release();
  }
}

async function replyToConversation(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("RIVORA Club is for customers.", 403);
  const parsed = z.object({ conversationId: uuid, body: z.string().trim().min(1).max(2000) }).safeParse(input);
  if (!parsed.success) return fail("Write a reply to continue.", 400);
  if (!(await hasClubAccess(user.id))) return fail("An active Club membership is required.", 403);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const conversation = await client.query(
      `SELECT * FROM "ClubConversation" WHERE "id"=$1 AND "recipientId"=$2 AND "status"='PENDING'
       FOR UPDATE`,
      [parsed.data.conversationId, user.id],
    );
    if (!conversation.rows[0]) {
      await client.query("ROLLBACK");
      return fail("Pending message request not found.", 404);
    }
    const block = await client.query(
      `SELECT 1 FROM "ClubBlock" WHERE ("blockerId"=$1 AND "blockedId"=$2)
       OR ("blockerId"=$2 AND "blockedId"=$1)`,
      [user.id, conversation.rows[0].requesterId],
    );
    if (block.rowCount) {
      await client.query("ROLLBACK");
      return fail("This conversation is unavailable.", 403);
    }
    await client.query(
      `UPDATE "ClubConversation" SET "status"='ACCEPTED',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
      [parsed.data.conversationId],
    );
    const { rows } = await client.query(
      `INSERT INTO "ClubMessage" ("conversationId","senderId","body")
       VALUES ($1,$2,$3) RETURNING "id","createdAt"`,
      [parsed.data.conversationId, user.id, parsed.data.body],
    );
    await audit(client, user.id, "club.message_request_accepted", "ClubConversation", parsed.data.conversationId);
    await client.query("COMMIT");
    return ok({ message: rows[0] }, 201);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function sendClubMessage(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("RIVORA Club is for customers.", 403);
  const parsed = z.object({ conversationId: uuid, body: z.string().trim().min(1).max(2000) }).safeParse(input);
  if (!parsed.success) return fail("Write a message to continue.", 400);
  if (!(await hasClubAccess(user.id))) return fail("An active Club membership is required.", 403);
  const { rows } = await pool.query(
    `INSERT INTO "ClubMessage" ("conversationId","senderId","body")
     SELECT c."id",$2,$3 FROM "ClubConversation" c
     WHERE c."id"=$1 AND c."status"='ACCEPTED'
       AND (c."requesterId"=$2 OR c."recipientId"=$2)
       AND CASE WHEN c."requesterId"=$2 THEN c."lockedByRequester"=FALSE
                ELSE c."lockedByRecipient"=FALSE END
       AND NOT EXISTS (SELECT 1 FROM "ClubBlock" b WHERE
         (b."blockerId"=c."requesterId" AND b."blockedId"=c."recipientId") OR
         (b."blockerId"=c."recipientId" AND b."blockedId"=c."requesterId"))
     RETURNING "id","createdAt"`,
    [parsed.data.conversationId, user.id, parsed.data.body],
  );
  if (!rows[0]) return fail("Conversation is not open for messaging.", 403);
  await pool.query(
    `UPDATE "ClubConversation" SET "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
    [parsed.data.conversationId],
  );
  return ok({ message: rows[0] }, 201);
}

async function declineConversation(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("RIVORA Club is for customers.", 403);
  const parsed = z.object({ conversationId: uuid }).safeParse(input);
  if (!parsed.success) return fail("Invalid conversation.", 400);
  const { rows } = await pool.query(
    `UPDATE "ClubConversation" SET "status"='DECLINED',"updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=$1 AND "recipientId"=$2 AND "status"='PENDING' RETURNING "id"`,
    [parsed.data.conversationId, user.id],
  );
  if (!rows[0]) return fail("Pending message request not found.", 404);
  return ok({ message: "Request declined." });
}

async function lockConversation(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("RIVORA Club is for customers.", 403);
  const parsed = z.object({ conversationId: uuid, locked: z.boolean() }).safeParse(input);
  if (!parsed.success) return fail("Invalid conversation update.", 400);
  const { rows } = await pool.query(
    `UPDATE "ClubConversation" SET
       "lockedByRequester"=CASE WHEN "requesterId"=$2 THEN $3 ELSE "lockedByRequester" END,
       "lockedByRecipient"=CASE WHEN "recipientId"=$2 THEN $3 ELSE "lockedByRecipient" END,
       "updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=$1 AND "status" IN ('ACCEPTED','LOCKED') AND
       ("requesterId"=$2 OR "recipientId"=$2) RETURNING "id"`,
    [parsed.data.conversationId, user.id, parsed.data.locked],
  );
  if (!rows[0]) return fail("Conversation not found.", 404);
  return ok({ message: "Your conversation restriction was updated." });
}

async function blockMember(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("RIVORA Club is for customers.", 403);
  const parsed = z.object({ memberId: uuid, blocked: z.boolean().default(true) }).safeParse(input);
  if (!parsed.success || parsed.data.memberId === user.id) return fail("Choose a member to block.", 400);
  if (parsed.data.blocked) {
    await pool.query(
      `INSERT INTO "ClubBlock" ("blockerId","blockedId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [user.id, parsed.data.memberId],
    );
    await writeAudit(user.id, "club.member_blocked", "AppUser", parsed.data.memberId);
  } else {
    await pool.query(
      `DELETE FROM "ClubBlock" WHERE "blockerId"=$1 AND "blockedId"=$2`,
      [user.id, parsed.data.memberId],
    );
  }
  return ok({ message: parsed.data.blocked ? "Member blocked." : "Your block was removed." });
}

async function reportContent(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("Sign in as a customer to report content.", 403);
  const parsed = z.object({
    targetType: z.enum(["PROFILE", "POST", "MESSAGE", "LISTING", "PARKING"]),
    targetId: uuid,
    reason: z.string().trim().min(5).max(1000),
  }).safeParse(input);
  if (!parsed.success) return fail("Choose a reason and provide a little detail.", 400);
  const targetTable = {
    PROFILE: `"AppUser"`,
    POST: `"ClubPost"`,
    MESSAGE: `"ClubMessage"`,
    LISTING: `"CarListing"`,
    PARKING: `"ParkingListing"`,
  }[parsed.data.targetType];
  const target = await pool.query(`SELECT 1 FROM ${targetTable} WHERE "id"=$1`, [parsed.data.targetId]);
  if (!target.rowCount) return fail("Reported content was not found.", 404);
  const { rows } = await pool.query(
    `INSERT INTO "ContentReport" ("reporterId","targetType","targetId","reason")
     VALUES ($1,$2,$3,$4) RETURNING "id","status","createdAt"`,
    [user.id, parsed.data.targetType, parsed.data.targetId, parsed.data.reason],
  );
  await writeAudit(user.id, "content.reported", "ContentReport", rows[0].id, { targetType: parsed.data.targetType });
  return ok({ report: rows[0] }, 201);
}

async function reviewReport(user: SessionUser, input: Record<string, unknown>) {
  if (!hasPermission(user, "MODERATION")) return fail("Moderation permission required.", 403);
  const parsed = z.object({
    id: uuid, status: z.enum(["REVIEWING", "ACTIONED", "DISMISSED"]),
    moderationAction: z.enum(["NONE", "HIDE_CONTENT", "SUSPEND_CUSTOMER"]).default("NONE"),
  }).safeParse(input);
  if (!parsed.success) return fail("Invalid moderation update.", 400);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const report = await client.query(
      `SELECT "targetType","targetId" FROM "ContentReport" WHERE "id"=$1 FOR UPDATE`,
      [parsed.data.id],
    );
    if (!report.rows[0]) {
      await client.query("ROLLBACK");
      return fail("Report not found.", 404);
    }
    if (parsed.data.moderationAction === "HIDE_CONTENT") {
      const hideSql: Record<string, string> = {
        POST: `UPDATE "ClubPost" SET "hidden"=TRUE WHERE "id"=$1`,
        MESSAGE: `UPDATE "ClubMessage" SET "hidden"=TRUE WHERE "id"=$1`,
        LISTING: `UPDATE "CarListing" SET "status"='REJECTED' WHERE "id"=$1`,
        PARKING: `UPDATE "ParkingListing" SET "status"='REJECTED' WHERE "id"=$1`,
      };
      const statement = hideSql[report.rows[0].targetType];
      if (statement) await client.query(statement, [report.rows[0].targetId]);
      else {
        await client.query("ROLLBACK");
        return fail("Profile content requires account suspension, not content removal.", 400);
      }
    }
    if (parsed.data.moderationAction === "SUSPEND_CUSTOMER") {
      if (report.rows[0].targetType !== "PROFILE") {
        await client.query("ROLLBACK");
        return fail("Account suspension applies to profile reports.", 400);
      }
      await client.query(
        `UPDATE "AppUser" SET "status"='SUSPENDED',"updatedAt"=CURRENT_TIMESTAMP
         WHERE "id"=$1 AND "role"='CUSTOMER'`,
        [report.rows[0].targetId],
      );
    }
    const { rows } = await client.query(
      `UPDATE "ContentReport" SET "status"=$2,"reviewedBy"=$3,"reviewedAt"=CURRENT_TIMESTAMP
       WHERE "id"=$1 RETURNING "id","status"`,
      [parsed.data.id, parsed.data.status, user.id],
    );
    await audit(client, user.id, "moderation.report_reviewed", "ContentReport", rows[0].id,
      { status: rows[0].status, action: parsed.data.moderationAction });
    await client.query("COMMIT");
    return ok({ report: rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createParkingListing(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("Member access required.", 403);
  if (!(await hasActiveMembership(user.id))) return fail("An active membership is required.", 403);
  const parsed = z.object({
    communityId: uuid, title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(1000).default(""),
    priceMinor: z.coerce.number().int().min(0).max(100000000),
    availableFrom: z.iso.date(), availableTo: z.iso.date().optional().or(z.literal("")),
    mediaUrls: z.array(z.string().regex(/^\/api\/portal\/media\/[0-9a-f-]{36}$/i)).max(8).default([]),
  }).safeParse(input);
  if (!parsed.success) return fail("Please check the parking listing details and dates.", 400);
  if ((parsed.data.availableTo && parsed.data.availableTo < parsed.data.availableFrom) ||
      parsed.data.availableFrom < new Date().toISOString().slice(0, 10)) {
    return fail("Please check the parking listing details and dates.", 400);
  }
  const verified = user.communityId === parsed.data.communityId;
  if (!verified) return fail("Parking listings are limited to your verified community.", 403);
  if (!(await ownsMemberMedia(user.id, parsed.data.mediaUrls))) {
    return fail("One or more listing images are not available to your account.", 403);
  }
  const { rows } = await pool.query(
    `INSERT INTO "ParkingListing" ("ownerId","communityId","title","description","priceMinor","availableFrom","availableTo","mediaUrls")
     VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,'')::date,$8) RETURNING "id","status","createdAt"`,
    [user.id, parsed.data.communityId, parsed.data.title, parsed.data.description,
      parsed.data.priceMinor, parsed.data.availableFrom, parsed.data.availableTo ?? "", parsed.data.mediaUrls],
  );
  await writeAudit(user.id, "parking.listing_created", "ParkingListing", rows[0].id);
  return ok({ listing: rows[0], message: "Listing submitted for operations review." }, 201);
}

async function placeParkingBid(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("Member access required.", 403);
  if (!(await hasActiveMembership(user.id))) return fail("An active membership is required.", 403);
  const parsed = z.object({ listingId: uuid, amountMinor: z.coerce.number().int().min(1).max(100000000) }).safeParse(input);
  if (!parsed.success) return fail("Enter a valid bid.", 400);
  if (!user.communityId) return fail("A verified community is required to bid.", 403);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const listing = await client.query(
      `SELECT "id" FROM "ParkingListing" WHERE "id"=$1 AND "status"='ACTIVE'
       AND "ownerId"<>$2 AND "communityId"=$3 FOR SHARE`,
      [parsed.data.listingId, user.id, user.communityId],
    );
    if (!listing.rows[0]) {
      await client.query("ROLLBACK");
      return fail("Listing not found in your verified community.", 404);
    }
    const { rows } = await client.query(
      `INSERT INTO "ParkingBid" ("listingId","bidderId","amountMinor")
       VALUES ($1,$2,$3) RETURNING "id","amountMinor","status","createdAt"`,
      [parsed.data.listingId, user.id, parsed.data.amountMinor],
    );
    await client.query("COMMIT");
    return ok({ bid: rows[0] }, 201);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function reviewParkingBid(user: SessionUser, input: Record<string, unknown>) {
  const marketplaceManager = hasPermission(user, "MARKETPLACE");
  if (!marketplaceManager && !hasRole(user, "CUSTOMER")) return fail("Not authorized.", 403);
  const parsed = z.object({
    id: uuid, status: z.enum(["ACCEPTED", "DECLINED"]),
  }).safeParse(input);
  if (!parsed.success) return fail("Invalid parking bid decision.", 400);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const bidRef = await client.query<{ listingId: string }>(
      `SELECT "listingId" FROM "ParkingBid" WHERE "id"=$1`,
      [parsed.data.id],
    );
    if (!bidRef.rows[0]) {
      await client.query("ROLLBACK");
      return fail("Parking bid not found.", 404);
    }
    const listing = await client.query<{ ownerId: string; status: string }>(
      `SELECT "ownerId","status" FROM "ParkingListing" WHERE "id"=$1 FOR UPDATE`,
      [bidRef.rows[0].listingId],
    );
    if (!listing.rows[0] ||
        (!marketplaceManager && listing.rows[0].ownerId !== user.id)) {
      await client.query("ROLLBACK");
      return fail("You cannot review bids for this listing.", 403);
    }
    if (listing.rows[0].status !== "ACTIVE") {
      await client.query("ROLLBACK");
      return fail("This parking listing is no longer accepting bids.", 409);
    }
    const { rows } = await client.query(
      `UPDATE "ParkingBid" SET "status"=$2
       WHERE "id"=$1 AND "status"='PENDING' RETURNING "id","listingId","status"`,
      [parsed.data.id, parsed.data.status],
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return fail("This bid has already been reviewed.", 409);
    }
    if (parsed.data.status === "ACCEPTED") {
      await client.query(
        `UPDATE "ParkingBid" SET "status"='DECLINED'
         WHERE "listingId"=$1 AND "id"<>$2 AND "status"='PENDING'`,
        [rows[0].listingId, rows[0].id],
      );
      await client.query(
        `UPDATE "ParkingListing" SET "status"='SOLD' WHERE "id"=$1`,
        [rows[0].listingId],
      );
    }
    await audit(client, user.id, "parking.bid_reviewed", "ParkingBid", rows[0].id,
      { status: rows[0].status });
    await client.query("COMMIT");
    return ok({ bid: rows[0], message: parsed.data.status === "ACCEPTED"
      ? "Bid accepted and the parking listing awarded."
      : "Bid declined." });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function requestParkingRental(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("Member access required.", 403);
  if (!(await hasActiveMembership(user.id))) return fail("An active membership is required.", 403);
  const parsed = z.object({
    listingId: uuid, startsOn: z.iso.date(), endsOn: z.iso.date(),
  }).safeParse(input);
  if (!parsed.success) return fail("Choose a valid rental period.", 400);
  const today = new Date().toISOString().slice(0, 10);
  if (!user.communityId || parsed.data.startsOn < today ||
      parsed.data.endsOn < parsed.data.startsOn) {
    return fail("Choose future rental dates in your verified community.", 400);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const listing = await client.query(
      `SELECT "id","ownerId","communityId","availableFrom","availableTo"
       FROM "ParkingListing" WHERE "id"=$1 AND "status"='ACTIVE' FOR UPDATE`,
      [parsed.data.listingId],
    );
    const item = listing.rows[0];
    if (!item || item.ownerId === user.id || item.communityId !== user.communityId) {
      await client.query("ROLLBACK");
      return fail("Parking listing not found in your verified community.", 404);
    }
    if (parsed.data.startsOn < dateOnly(item.availableFrom) ||
        (item.availableTo && parsed.data.endsOn > dateOnly(item.availableTo))) {
      await client.query("ROLLBACK");
      return fail("Rental dates must fall within the listing's availability.", 400);
    }
    const conflict = await client.query(
      `SELECT 1 FROM "ParkingRentalRequest"
       WHERE "listingId"=$1 AND "status" IN ('APPROVED','REQUESTED')
         AND daterange("startsOn","endsOn",'[]') && daterange($2::date,$3::date,'[]') LIMIT 1`,
      [item.id, parsed.data.startsOn, parsed.data.endsOn],
    );
    if (conflict.rowCount) {
      await client.query("ROLLBACK");
      return fail("Those dates overlap an existing rental request.", 409);
    }
    const { rows } = await client.query(
      `INSERT INTO "ParkingRentalRequest" ("listingId","renterId","startsOn","endsOn")
       VALUES ($1,$2,$3,$4) RETURNING "id","status","startsOn","endsOn"`,
      [item.id, user.id, parsed.data.startsOn, parsed.data.endsOn],
    );
    await client.query("COMMIT");
    return ok({ request: rows[0] }, 201);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateParkingStatus(user: SessionUser, input: Record<string, unknown>) {
  const marketplaceManager = hasPermission(user, "MARKETPLACE");
  if (!marketplaceManager && !hasRole(user, "CUSTOMER")) return fail("Not authorized.", 403);
  const parsed = z.object({ id: uuid, status: z.enum(["ACTIVE", "WITHDRAWN", "SOLD", "REJECTED"]) }).safeParse(input);
  if (!parsed.success) return fail("Invalid parking listing update.", 400);
  const { rows } = await pool.query(
    `UPDATE "ParkingListing" SET "status"=$2::"ListingStatus"
     WHERE "id"=$1 AND (
       ($3='ADMIN' AND
         (("status"='DRAFT' AND $2 IN ('ACTIVE','REJECTED')) OR
          ("status"='ACTIVE' AND $2 IN ('WITHDRAWN','SOLD')) OR
          ("status" IN ('WITHDRAWN','SOLD','REJECTED') AND $2='ACTIVE'))) OR
       ($3='CUSTOMER' AND "ownerId"=$4 AND "status" IN ('DRAFT','ACTIVE') AND $2='WITHDRAWN')
     ) RETURNING "id","status"`,
    [parsed.data.id, parsed.data.status, marketplaceManager ? "ADMIN" : user.role, user.id],
  );
  if (!rows[0]) return fail("Listing not found or this status change is not allowed.", 404);
  await writeAudit(user.id, "parking.listing_reviewed", "ParkingListing", rows[0].id, { status: rows[0].status });
  return ok({ listing: rows[0] });
}

async function updateRental(user: SessionUser, input: Record<string, unknown>) {
  const marketplaceManager = hasPermission(user, "MARKETPLACE");
  if (!marketplaceManager && !hasRole(user, "CUSTOMER")) return fail("Not authorized.", 403);
  const parsed = z.object({ id: uuid, status: z.enum(["APPROVED", "DECLINED", "CANCELLED", "COMPLETED"]) }).safeParse(input);
  if (!parsed.success) return fail("Invalid rental request update.", 400);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const rental = await client.query(
      `SELECT r."id",r."status",r."renterId",l."ownerId",l."id" AS "listingId",
              r."endsOn"
       FROM "ParkingRentalRequest" r JOIN "ParkingListing" l ON l."id"=r."listingId"
       WHERE r."id"=$1 FOR UPDATE OF r`,
      [parsed.data.id],
    );
    const current = rental.rows[0];
    if (!current) {
      await client.query("ROLLBACK");
      return fail("Rental request not found.", 404);
    }
    if (!marketplaceManager &&
        !(parsed.data.status === "CANCELLED" && current.renterId === user.id) &&
        !(["APPROVED", "DECLINED"].includes(parsed.data.status) && current.ownerId === user.id) &&
        !(parsed.data.status === "COMPLETED" &&
          (current.ownerId === user.id || current.renterId === user.id))) {
      await client.query("ROLLBACK");
      return fail("You do not have permission to change this rental request.", 403);
    }
    if (current.status !== "REQUESTED" &&
        !(parsed.data.status === "CANCELLED" && current.status === "APPROVED") &&
        !(parsed.data.status === "COMPLETED" && current.status === "APPROVED" &&
          dateOnly(current.endsOn) < new Date().toISOString().slice(0, 10))) {
      await client.query("ROLLBACK");
      return fail("This rental request has already been resolved.", 409);
    }
    if (parsed.data.status === "APPROVED") {
      await client.query(
        `SELECT "id" FROM "ParkingListing" WHERE "id"=$1 FOR UPDATE`,
        [current.listingId],
      );
      const overlap = await client.query(
        `SELECT 1 FROM "ParkingRentalRequest" WHERE "listingId"=$1 AND "id"<>$2
         AND "status"='APPROVED'
         AND daterange("startsOn","endsOn",'[]') && daterange(
           (SELECT "startsOn" FROM "ParkingRentalRequest" WHERE "id"=$2),
           (SELECT "endsOn" FROM "ParkingRentalRequest" WHERE "id"=$2),'[]')`,
        [current.listingId, current.id],
      );
      if (overlap.rowCount) {
        await client.query("ROLLBACK");
        return fail("Those dates overlap another approved rental.", 409);
      }
    }
    const { rows } = await client.query(
      `UPDATE "ParkingRentalRequest" SET "status"=$2 WHERE "id"=$1 RETURNING "id","status"`,
      [current.id, parsed.data.status],
    );
    await audit(client, user.id, "parking.rental_updated", "ParkingRentalRequest", rows[0].id,
      { status: rows[0].status });
    await client.query("COMMIT");
    return ok({ request: rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createCarListing(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("Member access required.", 403);
  if (!(await hasActiveMembership(user.id))) return fail("An active membership is required.", 403);
  const parsed = z.object({
    make: z.string().trim().min(1).max(60), model: z.string().trim().min(1).max(80),
    year: z.preprocess(
      (value) => value === "" || value == null ? undefined : value,
      z.coerce.number().int().min(1950).max(2100).optional(),
    ),
    description: z.string().trim().min(10).max(2000),
    priceMinor: z.coerce.number().int().min(0).max(2147483647),
    mediaUrls: z.array(z.string().regex(/^\/api\/portal\/media\/[0-9a-f-]{36}$/i)).max(8).default([]),
  }).safeParse(input);
  if (!parsed.success) return fail("Please check the car listing details.", 400);
  if (!(await ownsMemberMedia(user.id, parsed.data.mediaUrls))) {
    return fail("One or more listing images are not available to your account.", 403);
  }
  const { rows } = await pool.query(
    `INSERT INTO "CarListing" ("sellerId","make","model","year","description","priceMinor","mediaUrls")
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING "id","status","createdAt"`,
    [user.id, parsed.data.make, parsed.data.model, parsed.data.year ?? null,
      parsed.data.description, parsed.data.priceMinor, parsed.data.mediaUrls],
  );
  await writeAudit(user.id, "car.listing_created", "CarListing", rows[0].id);
  return ok({ listing: rows[0], message: "Car listing submitted for operations review." }, 201);
}

async function updateCarStatus(user: SessionUser, input: Record<string, unknown>) {
  const marketplaceManager = hasPermission(user, "MARKETPLACE");
  if (!marketplaceManager && !hasRole(user, "CUSTOMER")) return fail("Not authorized.", 403);
  const parsed = z.object({ id: uuid, status: z.enum(["ACTIVE", "WITHDRAWN", "SOLD", "REJECTED"]) }).safeParse(input);
  if (!parsed.success) return fail("Invalid car listing update.", 400);
  const permittedAdminChanges =
    (parsed.data.status === "ACTIVE" || parsed.data.status === "REJECTED") ?
      "status='DRAFT'" :
      parsed.data.status === "SOLD" ? "status='ACTIVE'" :
        "status IN ('DRAFT','ACTIVE')";
  const { rows } = await pool.query(
    `UPDATE "CarListing" SET "status"=$2::"ListingStatus"
     WHERE "id"=$1 AND (
       ($3='ADMIN' AND ${permittedAdminChanges}) OR
       ($3='CUSTOMER' AND "sellerId"=$4 AND
         (("status"='ACTIVE' AND $2 IN ('WITHDRAWN','SOLD')) OR
          ("status"='DRAFT' AND $2='WITHDRAWN')))
     ) RETURNING "id","status"`,
    [parsed.data.id, parsed.data.status, marketplaceManager ? "ADMIN" : user.role, user.id],
  );
  if (!rows[0]) return fail("Car listing not found or you cannot change its status.", 404);
  await writeAudit(user.id, "car.listing_status_updated", "CarListing", rows[0].id, { status: rows[0].status });
  return ok({ listing: rows[0] });
}

async function enquireCar(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("Member access required.", 403);
  if (!(await hasActiveMembership(user.id))) return fail("An active membership is required.", 403);
  const parsed = z.object({ listingId: uuid, message: z.string().trim().min(5).max(1000) }).safeParse(input);
  if (!parsed.success) return fail("Write a short enquiry.", 400);
  const { rows } = await pool.query(
    `INSERT INTO "CarEnquiry" ("listingId","buyerId","message")
     SELECT "id",$2,$3 FROM "CarListing" WHERE "id"=$1 AND "status"='ACTIVE' AND "sellerId"<>$2
     RETURNING "id","createdAt"`,
    [parsed.data.listingId, user.id, parsed.data.message],
  );
  if (!rows[0]) return fail("Car listing not found.", 404);
  return ok({ enquiry: rows[0] }, 201);
}

async function saveCar(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "CUSTOMER")) return fail("Member access required.", 403);
  if (!(await hasActiveMembership(user.id))) return fail("An active membership is required.", 403);
  const parsed = z.object({ listingId: uuid, saved: z.boolean() }).safeParse(input);
  if (!parsed.success) return fail("Invalid saved car update.", 400);
  if (parsed.data.saved) {
    await pool.query(
      `INSERT INTO "SavedCarListing" ("userId","listingId")
       SELECT $1,"id" FROM "CarListing" WHERE "id"=$2 AND "status"='ACTIVE'
       ON CONFLICT DO NOTHING`,
      [user.id, parsed.data.listingId],
    );
  } else {
    await pool.query(`DELETE FROM "SavedCarListing" WHERE "userId"=$1 AND "listingId"=$2`, [user.id, parsed.data.listingId]);
  }
  return ok({ message: parsed.data.saved ? "Car saved." : "Car removed from saved list." });
}

async function savePlatformSettings(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "ADMIN")) return fail("Administrator access required.", 403);
  const parsed = z.object({
    registrationEnabled: z.boolean(),
    clubEnabled: z.boolean(),
    parkingEnabled: z.boolean(),
    carMarketplaceEnabled: z.boolean(),
    supportEmail: z.union([z.email().max(254), z.literal("")]).default(""),
  }).safeParse(input);
  if (!parsed.success) return fail("Check the platform settings and support email.", 400);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [key, value] of Object.entries(parsed.data)) {
      await client.query(
        `INSERT INTO "PlatformSetting" ("key","value","updatedBy","updatedAt")
         VALUES ($1,$2::jsonb,$3,CURRENT_TIMESTAMP)
         ON CONFLICT ("key") DO UPDATE SET "value"=EXCLUDED."value",
           "updatedBy"=EXCLUDED."updatedBy","updatedAt"=CURRENT_TIMESTAMP`,
        [key, JSON.stringify(value), user.id],
      );
    }
    await audit(client, user.id, "platform.settings_saved", "PlatformSetting", user.id,
      { registrationEnabled: parsed.data.registrationEnabled, clubEnabled: parsed.data.clubEnabled,
        parkingEnabled: parsed.data.parkingEnabled, carMarketplaceEnabled: parsed.data.carMarketplaceEnabled });
    await client.query("COMMIT");
    return ok({ message: "Platform settings saved." });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function setStaffPermission(user: SessionUser, input: Record<string, unknown>) {
  if (!hasRole(user, "ADMIN")) return fail("Administrator access required.", 403);
  const parsed = z.object({
    userId: uuid,
    scope: z.enum([
      "OPERATIONS", "CUSTOMERS", "TEAM_MANAGEMENT", "COMMUNITIES", "SUPPORT",
      "FINANCE", "MARKETPLACE", "MODERATION", "REPORTS", "AUDIT",
    ]),
    granted: z.boolean(),
  }).safeParse(input);
  if (!parsed.success) return fail("Choose a valid staff permission.", 400);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const worker = await client.query(
      `SELECT "id" FROM "AppUser" WHERE "id"=$1 AND "role"='WORKER' FOR UPDATE`,
      [parsed.data.userId],
    );
    if (!worker.rows[0]) {
      await client.query("ROLLBACK");
      return fail("Active field staff account not found.", 404);
    }
    if (parsed.data.granted) {
      await client.query(
        `INSERT INTO "StaffPermission" ("userId","scope","grantedBy")
         VALUES ($1,$2,$3) ON CONFLICT ("userId","scope") DO NOTHING`,
        [parsed.data.userId, parsed.data.scope, user.id],
      );
    } else {
      await client.query(
        `DELETE FROM "StaffPermission" WHERE "userId"=$1 AND "scope"=$2`,
        [parsed.data.userId, parsed.data.scope],
      );
    }
    await audit(client, user.id, "staff.permission_changed", "AppUser", parsed.data.userId,
      { scope: parsed.data.scope, granted: parsed.data.granted });
    await client.query("COMMIT");
    return ok({ message: `Staff ${parsed.data.scope.toLowerCase().replace(/_/g, " ")} permission ${parsed.data.granted ? "granted" : "removed"}.` });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function hasActiveMembership(userId: string) {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM "Subscription" WHERE "userId"=$1 AND "status"='ACTIVE'
     AND ("endsAt" IS NULL OR "endsAt">CURRENT_TIMESTAMP) LIMIT 1`,
    [userId],
  );
  return Boolean(rowCount);
}

async function hasClubAccess(userId: string) {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM "Subscription" s JOIN "ServicePlan" p ON p."id"=s."planId"
     WHERE s."userId"=$1 AND s."status"='ACTIVE' AND p."clubAccess"=TRUE
       AND (s."endsAt" IS NULL OR s."endsAt">CURRENT_TIMESTAMP) LIMIT 1`,
    [userId],
  );
  return Boolean(rowCount);
}

async function writeAudit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await pool.query(
    `INSERT INTO "AuditLog" ("actorId","action","entityType","entityId","metadata")
     VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [actorId, action, entityType, entityId, JSON.stringify(metadata)],
  );
}

async function audit(
  client: import("pg").PoolClient,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await client.query(
    `INSERT INTO "AuditLog" ("actorId","action","entityType","entityId","metadata")
     VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [actorId, action, entityType, entityId, JSON.stringify(metadata)],
  );
}

function isDbCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function dateOnly(value: Date | string): string {
  if (!(value instanceof Date)) return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function ownsMemberMedia(userId: string, urls: string[], visibility = "MEMBERS") {
  const ids = urls
    .filter((url) => url.startsWith("/api/portal/media/"))
    .map((url) => url.slice("/api/portal/media/".length));
  if (ids.length === 0) return true;
  const result = await pool.query(
    `SELECT "id" FROM "MediaAsset" WHERE "id"=ANY($1::uuid[])
       AND "ownerId"=$2 AND "visibility"=$3`,
    [ids, userId, visibility],
  );
  return result.rowCount === ids.length;
}

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function ok(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status });
}
