import React from 'react';
import { HeaderSection } from '../../components/layout/HeaderSection';
import { FooterSection } from '../../components/layout/FooterSection';
import { EventsGrid } from '../../components/shared/EventsGrid';

export default function EventsPage() {
  return (
    <div className="flex flex-col min-h-screen font-sans bg-white">
      <HeaderSection />

      <EventsGrid limit={0} />
      <FooterSection />
    </div>
  );
}
