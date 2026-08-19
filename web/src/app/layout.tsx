import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SiteNav } from "@/components/SiteNav";
import { SiteBackground } from "@/components/SiteBackground";
import { WalletProvider } from "@/lib/wallet";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Ritual Predict",
  description:
    "A binary prediction market on Ritual Chain that reads its own oracle and settles itself.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <a
          href="#markets"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-elevated focus:px-3 focus:py-2 focus:text-accent"
        >
          Skip to markets
        </a>
        <SiteBackground />
        <WalletProvider>
          <SiteNav />
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
