export type BibleVersion = {
  id: string;
  name: string;
  abbreviation: string;
};

export type Verse = {
  id: string;
  reference: string;
  text: string;
};

export type SearchResult = {
  verses: Verse[];
  total: number;
  bibleId: string;
};

export type Book = {
  id: string;
  name: string;
  abbreviation: string;
};

export type ChapterSummary = {
  id: string;
  number: string;
  reference: string;
};

export type Chapter = {
  id: string;
  number: string;
  reference: string;
  content: string;
};
