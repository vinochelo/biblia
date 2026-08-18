import type { BibleVersion } from '@/lib/types';

export const bibleVersions: BibleVersion[] = [
  // Versión oficial por defecto
  { id: '592420522e16049f-01', name: 'Reina Valera 1909', abbreviation: 'RVR09' },

  // Versiones Bible Brain (Faith Comes By Hearing / Bible.is)
  { id: 'bb-rv60', name: 'Reina Valera 1960', abbreviation: 'RVR60' },
  { id: 'bb-nvi', name: 'Nueva Versión Internacional', abbreviation: 'NVI' },
  { id: 'bb-tla', name: 'Traducción en Lenguaje Actual', abbreviation: 'TLA' },
  { id: 'bb-dhh', name: 'Dios Habla Hoy', abbreviation: 'DHH' },
  { id: 'bb-lbla', name: 'La Biblia de las Américas', abbreviation: 'LBLA' },

  // Otras versiones disponibles en api.bible
  { id: 'b32b9d1b64b4ef29-01', name: 'Biblia en Español Sencillo', abbreviation: 'BES' },
  { id: '48acedcf8595c754-01', name: 'Palabra de Dios para Todos', abbreviation: 'PDT' },
  { id: '482ddd53705278cc-02', name: 'Versión Biblia Libre', abbreviation: 'VBL' },
];

