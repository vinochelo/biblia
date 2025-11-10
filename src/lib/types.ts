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
