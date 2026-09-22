import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { APPEARANCE_COOKIE, parseAppearance } from "@/lib/appearance";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "NLE Reviewer",
    template: "%s | NLE Reviewer",
  },
  description: "A focused quiz and progress tracker for board exam review.",
  icons: { icon: "/favicon.svg" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const appearance = parseAppearance(cookieStore.get(APPEARANCE_COOKIE)?.value);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      data-theme={appearance.theme}
      data-accent={appearance.accentColor}
      data-reduced-motion={appearance.reducedMotion ? "true" : "false"}
      style={{ "--user-font-scale": appearance.fontScale } as CSSProperties}
    >
      <body>{children}</body>
    </html>
  );
}
