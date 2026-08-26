import React from 'react';
import { HeaderSection } from '../../components/layout/HeaderSection';
import { FooterSection } from '../../components/layout/FooterSection';
import { ContactFormSection } from './components/ContactFormSection';

export default function ContactPage() {
  return (
    <div className="flex flex-col min-h-screen font-sans bg-gray-50">
      <HeaderSection />
      <ContactFormSection />
      <FooterSection />
    </div>
  );
}
