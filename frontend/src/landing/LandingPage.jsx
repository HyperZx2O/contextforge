import './landing.css';
import TopNav from './components/TopNav.jsx';
import Hero from './components/Hero.jsx';
import TrustStrip from './components/TrustStrip.jsx';
import FeatureGrid from './components/FeatureGrid.jsx';
import HowItWorks from './components/HowItWorks.jsx';
import RelationshipLegend from './components/RelationshipLegend.jsx';
import DemoSection from './components/DemoSection.jsx';
import CtaBanner from './components/CtaBanner.jsx';
import Footer from './components/Footer.jsx';

// Marketing landing page: Linear-style dark canvas composed of the product
// sections. Lives at "/" via the Root route switch.
export default function LandingPage() {
  return (
    <div className="landing">
      <TopNav />
      <main>
        <Hero />
        <TrustStrip />
        <FeatureGrid />
        <HowItWorks />
        <RelationshipLegend />
        <DemoSection />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  );
}
