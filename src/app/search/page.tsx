import { VerseSearch } from '@/components/search/verse-search';

export default function SearchPage() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mx-auto max-w-4xl">
        <VerseSearch />
      </div>
    </div>
  );
}
