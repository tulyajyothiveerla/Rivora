import bcrypt from "bcryptjs";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("Set DATABASE_URL before seeding RIVORA demo workflows.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const demoUsers = [
  {
    email: "customer@rivora.local",
    name: "RIVORA Test Customer",
    password: "RvrCustomer!2026Test",
    role: "CUSTOMER",
  },
  {
    email: "buyer@rivora.local",
    name: "RIVORA Marketplace Member",
    password: "RivoraBuyer!2026Test",
    role: "CUSTOMER",
  },
  {
    email: "worker@rivora.local",
    name: "RIVORA Field Professional",
    password: "RivoraWorker!2026Test",
    role: "WORKER",
  },
];

try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const communityResult = await client.query(
      `INSERT INTO "Community" ("name","city","address","capacity","active")
       VALUES ('RIVORA Demo Community','Bengaluru','1 RIVORA Demo Lane',100,TRUE)
       ON CONFLICT ("name","city") DO UPDATE
         SET "address"=EXCLUDED."address","capacity"=EXCLUDED."capacity","active"=TRUE
       RETURNING "id"`,
    );
    const communityId = communityResult.rows[0].id;

    const users = {};
    for (const demoUser of demoUsers) {
      const existing = await client.query(
        `SELECT "id","role" FROM "AppUser" WHERE "email"=$1 FOR UPDATE`,
        [demoUser.email],
      );
      if (existing.rows[0] && existing.rows[0].role !== demoUser.role) {
        throw new Error(`${demoUser.email} is already assigned a different role.`);
      }

      const passwordHash = await bcrypt.hash(demoUser.password, 12);
      const result = existing.rows[0]
        ? await client.query(
          `UPDATE "AppUser" SET "status"='ACTIVE',"emailVerifiedAt"=COALESCE("emailVerifiedAt",CURRENT_TIMESTAMP),
             "updatedAt"=CURRENT_TIMESTAMP,
             "city"=CASE WHEN "role"='CUSTOMER' THEN 'Bengaluru' ELSE "city" END
           WHERE "id"=$1 RETURNING "id","memberId"`,
          [existing.rows[0].id],
        )
        : await client.query(
          `INSERT INTO "AppUser" ("name","email","passwordHash","role","city","emailVerifiedAt")
           VALUES ($1,$2,$3,$4,'Bengaluru',CURRENT_TIMESTAMP) RETURNING "id","memberId"`,
          [demoUser.name, demoUser.email, passwordHash, demoUser.role],
        );
      users[demoUser.email] = result.rows[0];

      if (demoUser.role === "CUSTOMER") {
        await client.query(
          `UPDATE "AppUser" SET "communityId"=$2,"communityRequest"='RIVORA Demo Community',
             "apartment"='Demo Tower' WHERE "id"=$1`,
          [result.rows[0].id, communityId],
        );
        await client.query(
          `INSERT INTO "ClubProfile" ("userId") VALUES ($1) ON CONFLICT ("userId") DO NOTHING`,
          [result.rows[0].id],
        );
      }
    }

    const plans = await client.query(
      `UPDATE "ServicePlan"
       SET "priceMinor"=CASE "name" WHEN 'Discovery' THEN 199900
         WHEN 'Signature' THEN 299900 WHEN 'Privilege' THEN 599900 END,
         "currency"='INR',"durationDays"=30,
         "clubAccess"=("name" IN ('Signature','Privilege')),
         "published"=TRUE,"updatedAt"=CURRENT_TIMESTAMP
       WHERE "name" IN ('Discovery','Signature','Privilege')
       RETURNING "id","name","priceMinor","clubAccess"`,
    );

    const services = await client.query(
      `SELECT "id","name" FROM "ServiceCatalog" WHERE "active"=TRUE ORDER BY "name"`,
    );
    const serviceByName = Object.fromEntries(services.rows.map((service) => [service.name, service.id]));
    const planByName = Object.fromEntries(plans.rows.map((plan) => [plan.name, plan]));
    for (const [planName, serviceNames] of [
      ["Discovery", ["Exterior wash"]],
      ["Signature", ["Exterior wash", "Interior refresh"]],
      ["Privilege", ["Exterior wash", "Interior refresh", "Tyre assistance"]],
    ]) {
      const plan = planByName[planName];
      if (!plan) throw new Error(`Required plan "${planName}" was not found.`);
      for (const serviceName of serviceNames) {
        const serviceId = serviceByName[serviceName];
        if (!serviceId) throw new Error(`Required service "${serviceName}" was not found.`);
        await client.query(
          `INSERT INTO "PlanService" ("planId","serviceId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [plan.id, serviceId],
        );
      }
      await client.query(
        `INSERT INTO "PlanBenefit" ("planId","title","description","visitsPerPeriod")
         VALUES ($1,'Community car care','A RIVORA demo membership benefit.',4)
         ON CONFLICT ("planId","title") DO UPDATE SET "description"=EXCLUDED."description",
           "visitsPerPeriod"=EXCLUDED."visitsPerPeriod"`,
        [plan.id],
      );
    }

    const customerId = users["customer@rivora.local"].id;
    const buyerId = users["buyer@rivora.local"].id;
    const workerId = users["worker@rivora.local"].id;
    const subscriptionIds = {};
    for (const userId of [customerId, buyerId]) {
      const current = await client.query(
        `SELECT "id" FROM "Subscription" WHERE "userId"=$1 AND "planId"=$2
           AND "status" IN ('PENDING','ACTIVE') LIMIT 1`,
        [userId, planByName.Signature.id],
      );
      const subscription = current.rows[0] ?? (await client.query(
        `INSERT INTO "Subscription" ("userId","planId","status","startsAt","endsAt")
         VALUES ($1,$2,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+INTERVAL '30 days')
         RETURNING "id"`,
        [userId, planByName.Signature.id],
      )).rows[0];
      if (current.rows[0]) {
        await client.query(
          `UPDATE "Subscription" SET "status"='ACTIVE',"startsAt"=COALESCE("startsAt",CURRENT_TIMESTAMP),
             "endsAt"=CURRENT_TIMESTAMP+INTERVAL '30 days',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
          [subscription.id],
        );
      }
      subscriptionIds[userId] = subscription.id;
      await client.query(
        `INSERT INTO "Payment" ("userId","subscriptionId","amountMinor","currency","status","providerReference","paidAt")
         VALUES ($1,$2,99900,'INR','PAID',$3,CURRENT_TIMESTAMP)
         ON CONFLICT ("providerReference") DO NOTHING`,
        [userId, subscription.id, `RIVORA-DEMO-${userId}`],
      );
    }

    const vehicle = await client.query(
      `INSERT INTO "Vehicle" ("ownerId","make","model","year","registration","color","parkingLocation")
       VALUES ($1,'Honda','City',2023,$2,'Pearl White','Demo Tower')
       ON CONFLICT ("ownerId","registration") DO UPDATE SET "model"=EXCLUDED."model"
       RETURNING "id"`,
      [customerId, "KA-DEMO-1001"],
    );

    const slotStart = new Date();
    slotStart.setUTCDate(slotStart.getUTCDate() + 2);
    slotStart.setUTCHours(5, 0, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
    const existingSlot = await client.query(
      `SELECT "id" FROM "ServiceSlot" WHERE "communityId"=$1 AND "serviceId"=$2
         AND "startsAt"::date=$3::date AND "capacity"=4 LIMIT 1`,
      [communityId, serviceByName["Exterior wash"], slotStart],
    );
    const slot = existingSlot.rows[0] ?? (await client.query(
      `INSERT INTO "ServiceSlot" ("communityId","serviceId","startsAt","endsAt","capacity")
       VALUES ($1,$2,$3,$4,4) RETURNING "id"`,
      [communityId, serviceByName["Exterior wash"], slotStart, slotEnd],
    )).rows[0];
    const existingBooking = await client.query(
      `SELECT "id" FROM "Booking" WHERE "userId"=$1 AND "slotId"=$2 LIMIT 1`,
      [customerId, slot.id],
    );
    const booking = existingBooking.rows[0] ?? (await client.query(
      `INSERT INTO "Booking" ("userId","vehicleId","slotId","serviceId","subscriptionId","status","notes")
       VALUES ($1,$2,$3,$4,$5,'CONFIRMED','Demo booking: please confirm your arrival with the member.')
       RETURNING "id"`,
      [customerId, vehicle.rows[0].id, slot.id,
        serviceByName["Exterior wash"], subscriptionIds[customerId]],
    )).rows[0];
    await client.query(
      `INSERT INTO "ServiceJob" ("bookingId","workerId","status")
       VALUES ($1,$2,'ASSIGNED') ON CONFLICT ("bookingId") DO UPDATE
         SET "workerId"=EXCLUDED."workerId","status"='ASSIGNED'`,
      [booking.id, workerId],
    );
    const notification = await client.query(
      `SELECT 1 FROM "Notification" WHERE "userId"=$1 AND "title"='Your RIVORA demo service is booked' LIMIT 1`,
      [customerId],
    );
    if (!notification.rowCount) {
      await client.query(
        `INSERT INTO "Notification" ("userId","title","body")
         VALUES ($1,'Your RIVORA demo service is booked','A community car-care visit has been scheduled for your demo vehicle.')`,
        [customerId],
      );
    }

    const existingParking = await client.query(
      `SELECT "id" FROM "ParkingListing" WHERE "ownerId"=$1 AND "title"='Covered parking near the lift' LIMIT 1`,
      [buyerId],
    );
    const parking = existingParking.rows[0] ?? (await client.query(
      `INSERT INTO "ParkingListing" ("ownerId","communityId","title","description","priceMinor","availableFrom","status")
       VALUES ($1,$2,'Covered parking near the lift','Secure covered space in the RIVORA demo community.',650000,CURRENT_DATE+1,'ACTIVE')
       RETURNING "id"`,
      [buyerId, communityId],
    )).rows[0];
    await client.query(
      `INSERT INTO "ParkingBid" ("listingId","bidderId","amountMinor")
       SELECT $1,$2,675000 WHERE NOT EXISTS
         (SELECT 1 FROM "ParkingBid" WHERE "listingId"=$1 AND "bidderId"=$2 AND "status"='PENDING')`,
      [parking.id, customerId],
    );
    await client.query(
      `INSERT INTO "CarListing" ("sellerId","make","model","year","description","priceMinor","status")
       SELECT $1,'Hyundai','Creta',2022,'Demo marketplace vehicle with a complete service history.',125000000,'ACTIVE'
       WHERE NOT EXISTS (SELECT 1 FROM "CarListing" WHERE "sellerId"=$1 AND "make"='Hyundai' AND "model"='Creta')`,
      [buyerId],
    );
    await client.query(
      `INSERT INTO "CarListing" ("sellerId","make","model","year","description","priceMinor","status")
       SELECT $1,'Maruti Suzuki','Baleno',2021,'Demo listing awaiting an operations review.',65000000,'DRAFT'
       WHERE NOT EXISTS (SELECT 1 FROM "CarListing" WHERE "sellerId"=$1 AND "make"='Maruti Suzuki' AND "model"='Baleno')`,
      [customerId],
    );
    await client.query("COMMIT");

    console.log("RIVORA demo data is ready.");
    console.log("Published demo plan prices: Discovery INR 1,999, Signature INR 2,999, Privilege INR 5,999 (not production pricing).");
    console.log(`Demo community: Bengaluru (${communityId})`);
    console.log(`Demo customer: customer@rivora.local (${users["customer@rivora.local"].memberId})`);
    console.log(`Marketplace member: buyer@rivora.local (${users["buyer@rivora.local"].memberId})`);
    console.log(`Worker: worker@rivora.local (${users["worker@rivora.local"].memberId})`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
