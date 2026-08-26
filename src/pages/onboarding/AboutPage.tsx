import React from 'react';
import { HeaderSection } from '../../components/layout/HeaderSection';
import { FooterSection } from '../../components/layout/FooterSection';
import { AboutDetailsSection } from './components/AboutDetailsSection';

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen font-sans bg-white">
      <HeaderSection />
      <AboutDetailsSection />
      <FooterSection />
    </div>
  );
}
