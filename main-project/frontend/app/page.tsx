import MarketingNav from "@/components/marketing/MarketingNav";
import Hero from "@/components/marketing/Hero";
import TechStrip from "@/components/marketing/TechStrip";
import HowItWorks from "@/components/marketing/HowItWorks";
import FeaturesBento from "@/components/marketing/FeaturesBento";
import CTABanner from "@/components/marketing/CTABanner";
import FooterPublic from "@/components/marketing/FooterPublic";

export default function LandingPage() {
  return (
    <>
      <MarketingNav />
      <main>
        <Hero />
        <TechStrip />
        <HowItWorks />
        <FeaturesBento />
        <CTABanner />
      </main>
      <FooterPublic />
    </>
  );
}
