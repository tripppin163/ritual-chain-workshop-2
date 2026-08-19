import type { Metadata } from "next";
import { Archivo, Archivo_Black, Barlow, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo",
});
const displayAlt = Archivo({ subsets: ["latin"], variable: "--font-archivo-alt" });
const body = Barlow({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-barlow",
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-jb" });

export const metadata: Metadata = {
  title: "Ritual Predict",
  description:
    "A binary prediction market on Ritual Chain that reads its own oracle and settles itself.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${displayAlt.variable} ${body.variable} ${mono.variable} antialiased`}
      >
        <a
          href="#markets"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:bg-elevated focus:px-3 focus:py-2 focus:text-ritual-green"
        >
          Skip to markets
        </a>
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
