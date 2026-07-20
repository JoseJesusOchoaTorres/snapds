import { ConfigHierarchy } from '../../src/components/ConfigHierarchy';
import { CtaBand } from '../../src/components/CtaBand';
import { DemoShowcase } from '../../src/components/DemoShowcase';
import { Faq } from '../../src/components/Faq';
import { Features } from '../../src/components/Features';
import { Footer } from '../../src/components/Footer';
import { Hero } from '../../src/components/Hero';
import { HowItWorks } from '../../src/components/HowItWorks';
import { Nav } from '../../src/components/Nav';
import { Skills } from '../../src/components/Skills';

export default function HomePage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <Features />
        <DemoShowcase />
        <HowItWorks />
        <Skills />
        <ConfigHierarchy />
        <Faq />
        <CtaBand />
      </main>
      <Footer />
    </>
  );
}
