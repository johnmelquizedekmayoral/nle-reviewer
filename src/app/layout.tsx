import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
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

type Appearance = {
  theme: "light" | "dark" | "system";
  accentColor: string;
  fontScale: number;
  reducedMotion: boolean;
};

async function getAppearance(): Promise<Appearance> {
  const fallback: Appearance = {
    theme: "system",
    accentColor: "green",
    fontScale: 1,
    reducedMotion: false,
  };

  if (!isSupabaseConfigured()) return fallback;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return fallback;

  const { data } = await supabase
    .from("user_preferences")
    .select("theme, accent_color, font_scale, reduced_motion")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return fallback;
  return {
    theme: data.theme as Appearance["theme"],
    accentColor: data.accent_color,
    fontScale: Number(data.font_scale),
    reducedMotion: data.reduced_motion,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const appearance = await getAppearance();

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
