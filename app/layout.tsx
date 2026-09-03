import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RentFlow — Rental Ledger",
  description: "Secure rent, electricity, payment and tenancy management for landlords.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
