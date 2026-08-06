import type { Metadata } from "next";
import { Nunito_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const sans = Nunito_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Food Run: Beneath the Current",
  description: "A colorful underwater stealth, gathering, and extraction adventure.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
