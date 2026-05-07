import type { Metadata, Viewport } from "next";
import { Inter, Montserrat, Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-circularxx",
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-whyte",
  display: "swap",
  weight: ["300", "400", "600", "700"],
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-circularxxmono",
  display: "swap",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "sift.ai — Find Local Leads Before Anyone Else",
    template: "%s | sift.ai",
  },
  description:
    "sift.ai scans Google Maps, scores website quality automatically, and drafts personalized 180-word outreach emails. The AI lead engine built for solo digital agencies and freelancers.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://sift.ai"
  ),
  keywords: [
    "local lead generation",
    "AI outreach",
    "digital agency tools",
    "google maps leads",
    "website audit automation",
    "local business prospecting",
    "cold email ai",
    "freelancer lead gen",
  ],
  openGraph: {
    type: "website",
    siteName: "sift.ai",
    description:
      "sift.ai finds local businesses losing customers to weak websites, scores them automatically, and drafts personalized pitches — ready for your approval.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "sift.ai — AI Lead Engine" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "sift.ai — Find Local Leads Before Anyone Else",
    description:
      "Scan Google Maps. Score websites. Draft 180-word outreach. Ship leads while you sleep.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0a09",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${montserrat.variable} ${spaceMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
