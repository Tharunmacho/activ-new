import React from 'react';
import { HeaderSection } from '../../components/layout/HeaderSection';
import { FooterSection } from '../../components/layout/FooterSection';
import { ContactFormSection } from './components/ContactFormSection';
import { AcrossIndia } from '@/components/shared/AcrossIndia';

export default function ContactPage() {
  return (
    <div className="flex flex-col min-h-screen font-sans bg-gray-50">
      <HeaderSection />
      <ContactFormSection />
      {/* Above the footer, on every content page — see `AcrossIndia`. */}
      <AcrossIndia />

      <FooterSection />
    </div>
  );
}
