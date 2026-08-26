import { HeaderSection } from '../../components/layout/HeaderSection';
import { CarouselSection } from './components/CarouselSection';
import { AboutSection } from './components/AboutSection';
import { EventsGrid } from '../../components/shared/EventsGrid';
import { FooterSection } from '../../components/layout/FooterSection';

export default function Hero() {
  return (
    <div className="flex flex-col min-h-screen font-sans bg-white">
      {/* 0. Header Navigation */}
      <HeaderSection />

      {/* 1. Landing Area (Carousel) */}
      <CarouselSection />

      {/* 2. About Card Section */}
      <AboutSection />

      {/* 3. Upcoming Events Section */}
      <EventsGrid showViewAll />

      {/* 4. Footer */}
      <FooterSection />
    </div>
  );
}
