import { useEffect } from 'react';
import './landing.css';
import { startLenis, stopLenis } from './lenis.js';
import TopNav from './components/TopNav.jsx';
import Hero from './components/Hero.jsx';
import RecordSection from './components/RecordSection.jsx';
import EdgeTable from './components/EdgeTable.jsx';
import GapRows from './components/GapRows.jsx';
import PipelineTrail from './components/PipelineTrail.jsx';
import DatasetIndex from './components/DatasetIndex.jsx';
import CloseBand from './components/CloseBand.jsx';
import Footer from './components/Footer.jsx';
import ScrollTop from './components/ScrollTop.jsx';

// Marketing landing page, at "/" via the Root route switch.
//
// The order is the instrument, then its readouts: the graph you can
// interrogate, one edge opened to show what it holds, the eight things a
// relationship can assert, the four ways a gap is found, what a run
// costs, and the three graphs that are already built.
export default function LandingPage() {
  // Smooth scroll for this page only. Leaving /app must hand scrolling
  // back to the browser, or the graph workspace inherits the inertia.
  useEffect(() => {
    startLenis();
    return () => stopLenis();
  }, []);

  return (
    <div className="landing">
      <TopNav />
      <main>
        <Hero />
        <RecordSection />
        <EdgeTable />
        <GapRows />
        <PipelineTrail />
        <DatasetIndex />
        <CloseBand />
      </main>
      <Footer />
      <ScrollTop />
    </div>
  );
}
