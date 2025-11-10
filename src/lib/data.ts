import type { BibleVersion, SearchResult } from '@/lib/types';

export const bibleVersions: BibleVersion[] = [
  { id: 'de4e12af7f28f599-01', name: 'Reina Valera 1960', abbreviation: 'RVR1960' },
  { id: '06125adad2d5898a-01', name: 'King James Version', abbreviation: 'KJV' },
  { id: 'bba9f40183526463-01', name: 'La Biblia de las Américas', abbreviation: 'LBLA' },
  { id: '592420522e16049f-01', name: 'Nueva Traducción Viviente', abbreviation: 'NTV' },
  { id: '9879dbb6c895849c-01', name: 'Nueva Versión Internacional', abbreviation: 'NVI' },
];

export const mockSearchResults: SearchResult = {
  bibleId: 'de4e12af7f28f599-01',
  total: 2,
  verses: [
    {
      id: 'GEN.1.1',
      reference: 'Génesis 1:1',
      text: 'En el principio creó Dios los cielos y la tierra.',
    },
    {
      id: 'GEN.1.2',
      reference: 'Génesis 1:2',
      text: 'Y la tierra estaba desordenada y vacía, y las tinieblas estaban sobre la faz del abismo, y el Espíritu de Dios se movía sobre la faz de las aguas.',
    },
  ],
};

export const mockKeywordResults: SearchResult = {
  bibleId: 'de4e12af7f28f599-01',
  total: 1,
  verses: [
    {
      id: 'JHN.3.16',
      reference: 'Juan 3:16',
      text: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.',
    }
  ]
};
