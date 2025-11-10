"use server";

import { bibleVersions, mockKeywordResults, mockSearchResults } from '@/lib/data';
import type { SearchResult } from '@/lib/types';

export async function searchVerses(
  query: string,
  versionId: string
): Promise<SearchResult | { error: string }> {
  console.log(`Searching for "${query}" in version ${versionId}`);
  
  const version = bibleVersions.find(v => v.id === versionId);
  if (!version) {
    return { error: 'Versión de la Biblia no válida.' };
  }

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Simulate API response
  if (query.toLowerCase().includes('amor')) {
    return { ...mockKeywordResults, bibleId: versionId };
  }
  
  if (query.toLowerCase().includes('génesis')) {
    return { ...mockSearchResults, bibleId: versionId };
  }

  if (!query) {
    return { verses: [], total: 0, bibleId: versionId };
  }

  return { verses: [], total: 0, bibleId: versionId };
}
