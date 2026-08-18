export interface VoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male';
  country: string;
  icon: string;
  description: string;
}

export const NATURAL_VOICES: VoiceOption[] = [
  {
    id: 'es-MX-DaliaNeural',
    name: 'Dalia',
    gender: 'female',
    country: 'México 🇲🇽',
    icon: '👩',
    description: 'Voz femenina suave y cálida',
  },
  {
    id: 'es-MX-JorgeNeural',
    name: 'Jorge',
    gender: 'male',
    country: 'México 🇲🇽',
    icon: '👨',
    description: 'Voz masculina neutra y clara',
  },
  {
    id: 'es-US-PalomaNeural',
    name: 'Paloma',
    gender: 'female',
    country: 'Latino 🌎',
    icon: '👩',
    description: 'Voz femenina contemporánea',
  },
  {
    id: 'es-ES-ElviraNeural',
    name: 'Elvira',
    gender: 'female',
    country: 'España 🇪🇸',
    icon: '👩',
    description: 'Voz femenina europea clásica',
  },
  {
    id: 'es-ES-AlvaroNeural',
    name: 'Álvaro',
    gender: 'male',
    country: 'España 🇪🇸',
    icon: '👨',
    description: 'Voz masculina europea formal',
  },
  {
    id: 'es-AR-TomasNeural',
    name: 'Tomás',
    gender: 'male',
    country: 'Argentina 🇦🇷',
    icon: '👨',
    description: 'Voz masculina con tono del cono sur',
  },
  {
    id: 'es-CO-GonzaloNeural',
    name: 'Gonzalo',
    gender: 'male',
    country: 'Colombia 🇨🇴',
    icon: '👨',
    description: 'Voz masculina con acento colombiano',
  },
];

export const DEFAULT_AI_VOICE = 'es-MX-DaliaNeural';
