import type { Metadata } from "next";
import "./globals.css";
import { RealtimeProvider } from "../components/RealtimeProvider";

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
      <body>
        <RealtimeProvider enabled={true} fallbackToPolling={true}>
          {children}
        </RealtimeProvider>
      </body>
    </html>
  );
}

