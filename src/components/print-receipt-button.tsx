"use client";

import { Printer } from "lucide-react";

export default function PrintReceiptButton() {
  return <button className="portal-button portal-button-dark receipt-print-button" onClick={() => window.print()}>
    <Printer size={15} /> Print or save as PDF
  </button>;
}
