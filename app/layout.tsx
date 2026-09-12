import type { Metadata } from "next";
import "./globals.css";
import AdminShell from "./AdminShell";

export const metadata: Metadata = {
  title: "لوحة تحكم بكاري تيك",
  description: "لوحة تحكم إدارية خاصة بمتجر Bkkari Tech",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-white text-ink antialiased">
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
