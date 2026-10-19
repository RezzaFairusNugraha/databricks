import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNavToggle } from "@/components/layout/mobile-nav-toggle";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "CSV Tidy - Databricks Studio",
  description: "Pembersihan dan validasi berkas CSV untuk Databricks Unity Catalog",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-[#fafafa] font-sans text-zinc-900 antialiased selection:bg-indigo-100 selection:text-indigo-700">
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <MobileNavToggle />
            <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
              {children}
            </main>
          </div>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
