import type { Metadata } from "next";
import "./globals.css";
import "./portal.css";

export const metadata: Metadata = {
  title: "RIVORA — A cleaner drive, a calmer every day",
  description:
    "Thoughtful car care, brought to your community. Discover RIVORA memberships and check service availability in your neighbourhood.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
