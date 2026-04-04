import { Navbar } from "./Navbar";
import { HeroSection } from "./HeroSection";
import { FeatureCards } from "./FeatureCards";
import { TechStackSection } from "./TechStackSection";
import { CTASection } from "./CTASection";
import { Footer } from "./Footer";

export function LandingPage() {
  return (
    <div className="min-h-screen scroll-smooth">
      <Navbar />
      <HeroSection />
      <FeatureCards />
      <TechStackSection />
      <CTASection />
      <Footer />
    </div>
  );
}
