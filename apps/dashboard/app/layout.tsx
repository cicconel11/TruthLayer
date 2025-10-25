import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TruthLayer Metrics Dashboard",
  description: "Visibility bias indices across search and AI engines"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

