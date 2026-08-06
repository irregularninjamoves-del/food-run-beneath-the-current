import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "food-run-beneath-current.iamgalaxey.chatgpt.site";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const preview = new URL("/og.png", base).toString();
  return {
    metadataBase: base,
    title: "Food Run: Beneath the Current",
    description: "A colorful underwater stealth, gathering, crafting, and extraction adventure.",
    openGraph: {
      title: "Food Run: Beneath the Current",
      description: "A tiny fish. A vast and dangerous current. Gather food, outsmart predators, and make it home.",
      type: "website",
      images: [{ url: preview, width: 1200, height: 630, alt: "Food Run: Beneath the Current" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Food Run: Beneath the Current",
      description: "Survive the current. Feed the reef.",
      images: [preview],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
