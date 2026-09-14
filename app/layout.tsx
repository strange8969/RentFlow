import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "./pwa-register";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#6558d3" };

export const metadata: Metadata = {
  title: "RentFlow — Rental Ledger",
  description: "Secure rent, electricity, payment and tenancy management for landlords.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "RentFlow", statusBarStyle: "default" },
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
      <body className="antialiased"><PwaRegister />{children}</body>
    </html>
  );
}
