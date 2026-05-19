import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { WorkspaceProvider } from "@/components/WorkspaceProvider";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Compilations Studio",
  description: "Build YouTube compilations from @Arab's catalog",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <WorkspaceProvider>
          <header
            className="border-b sticky top-0 z-30 backdrop-blur-md"
            style={{ borderColor: "var(--border)", background: "rgba(11,11,12,0.78)" }}
          >
            <div className="max-w-[1400px] mx-auto px-5 h-[52px] flex items-center justify-between gap-6">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-white text-[13px] tracking-tighter shadow-sm"
                  style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-deep))" }}
                >
                  A
                </div>
                <span className="font-semibold text-[14px] tracking-tight">
                  Compilations Studio
                </span>
              </Link>
              <NavBar />
            </div>
          </header>
          <main className="max-w-[1400px] mx-auto px-5 py-6">{children}</main>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
