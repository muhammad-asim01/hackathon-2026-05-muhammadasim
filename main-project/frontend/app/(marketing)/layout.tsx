import type { Metadata } from "next";
import MarketingNav from "@/components/marketing/MarketingNav";
import FooterPublic from "@/components/marketing/FooterPublic";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MarketingNav />
      <main className="pt-16">{children}</main>
      <FooterPublic />
    </>
  );
}
