import { DailyReading } from '@/components/home/daily-reading';

export const maxDuration = 60;

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mx-auto max-w-4xl">
        <DailyReading />
      </div>
    </div>
  );
}

