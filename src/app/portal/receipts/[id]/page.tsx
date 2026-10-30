import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser, hasRole } from "@/lib/auth";
import { pool } from "@/lib/db";
import PrintReceiptButton from "@/components/print-receipt-button";

export const instant = false;

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const result = await pool.query<{
    id: string;
    userId: string;
    customerName: string;
    customerEmail: string;
    planName: string | null;
    amountMinor: number;
    currency: string;
    providerReference: string | null;
    paidAt: Date | null;
  }>(
    `SELECT p."id",p."userId",u."name" AS "customerName",u."email" AS "customerEmail",
       plan."name" AS "planName",p."amountMinor",p."currency",p."providerReference",p."paidAt"
     FROM "Payment" p JOIN "AppUser" u ON u."id"=p."userId"
     LEFT JOIN "Subscription" s ON s."id"=p."subscriptionId"
     LEFT JOIN "ServicePlan" plan ON plan."id"=s."planId"
     WHERE p."id"=$1 AND p."status"='PAID' AND ($2::boolean OR p."userId"=$3)`,
    [id, hasRole(user, "ADMIN"), user.id],
  );
  const receipt = result.rows[0];
  if (!receipt) notFound();

  return <main className="receipt-page">
    <div className="receipt-toolbar">
      <Link href="/portal">← Back to your RIVORA portal</Link>
      <PrintReceiptButton />
    </div>
    <article className="receipt-document">
      <header className="receipt-header">
        <div><span className="receipt-wordmark">RIVORA.</span><p>THOUGHTFUL CARE FOR EVERY DRIVE</p></div>
        <div className="receipt-title"><span>PAYMENT RECEIPT</span><strong>RIV-{receipt.id.slice(0, 8).toUpperCase()}</strong></div>
      </header>
      <div className="receipt-rule" />
      <section className="receipt-summary">
        <div><span>PAID BY</span><strong>{receipt.customerName}</strong><p>{receipt.customerEmail}</p></div>
        <div><span>PAYMENT DATE</span><strong>{receipt.paidAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(new Date(receipt.paidAt)) : "Recorded by RIVORA"}</strong></div>
      </section>
      <table className="receipt-table"><thead><tr><th>Description</th><th>Reference</th><th>Amount</th></tr></thead>
        <tbody><tr><td>{receipt.planName ? `${receipt.planName} membership` : "RIVORA service payment"}</td><td>{receipt.providerReference ?? "—"}</td>
          <td>{new Intl.NumberFormat("en-IN", { style: "currency", currency: receipt.currency.trim() }).format(receipt.amountMinor / 100)}</td></tr></tbody>
      </table>
      <div className="receipt-total"><span>Total received</span><strong>{new Intl.NumberFormat("en-IN", { style: "currency", currency: receipt.currency.trim() }).format(receipt.amountMinor / 100)}</strong></div>
      <footer className="receipt-footnote">
        This is a payment receipt for the amount recorded by RIVORA. It is not a tax invoice. Tax registration and statutory invoice details must be added after they are approved for the operating business.
      </footer>
    </article>
  </main>;
}
