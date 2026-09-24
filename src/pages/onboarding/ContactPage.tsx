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
      {/* The regions band in its CONTACT form: its own wording, and each
          tile opens that region's or state's contact section — see the note
          on `variant` in `AcrossIndia`. */}
      <AcrossIndia variant="contact" />

      <FooterSection />
    </div>
  );
}
