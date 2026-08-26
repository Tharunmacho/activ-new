import React from 'react';
import { HeaderSection } from '../../components/layout/HeaderSection';
import { FooterSection } from '../../components/layout/FooterSection';
import { GallerySection } from './components/GallerySection';

export default function GalleryPage() {
  return (
    <div className="flex flex-col min-h-screen font-sans bg-white">
      <HeaderSection />
      <GallerySection />
      <FooterSection />
    </div>
  );
}
