export type Reading = {
  month: number;
  day: number;
  passages: string[];
};

const januaryPlan: Reading[] = [
    { month: 1, day: 1, passages: ["Génesis 1, 2", "Salmos 1", "Mateo 1"] },
    { month: 1, day: 2, passages: ["Génesis 3, 4", "Proverbios 1", "Mateo 2"] },
    { month: 1, day: 3, passages: ["Génesis 5, 6", "Mateo 3"] },
    { month: 1, day: 4, passages: ["Génesis 7, 8", "Salmos 2", "Mateo 4"] },
    { month: 1, day: 5, passages: ["Génesis 9, 10", "Mateo 5"] },
    { month: 1, day: 6, passages: ["Génesis 11", "Proverbios 2", "Mateo 6"] },
    { month: 1, day: 7, passages: ["Job 1, 2", "Salmos 3", "Mateo 7"] },
    { month: 1, day: 8, passages: ["Job 3-5", "Mateo 8"] },
    { month: 1, day: 9, passages: ["Job 6, 7", "Salmos 4", "Mateo 9"] },
    { month: 1, day: 10, passages: ["Job 8-10", "Mateo 10"] },
    { month: 1, day: 11, passages: ["Job 11, 12", "Proverbios 3", "Mateo 11"] },
    { month: 1, day: 12, passages: ["Job 13, 14", "Salmos 5", "Mateo 12"] },
    { month: 1, day: 13, passages: ["Job 15-17", "Mateo 13"] },
    { month: 1, day: 14, passages: ["Job 18, 19", "Salmos 6", "Mateo 14"] },
    { month: 1, day: 15, passages: ["Job 20, 21", "Mateo 15"] },
    { month: 1, day: 16, passages: ["Job 22-24", "Mateo 16"] },
    { month: 1, day: 17, passages: ["Job 25, 26", "Salmos 7", "Mateo 17"] },
    { month: 1, day: 18, passages: ["Job 27, 28", "Mateo 18"] },
    { month: 1, day: 19, passages: ["Job 29-31", "Mateo 19"] },
    { month: 1, day: 20, passages: ["Job 32, 33", "Salmos 8", "Mateo 20"] },
    { month: 1, day: 21, passages: ["Job 34, 35", "Salmos 9", "Mateo 21"] },
    { month: 1, day: 22, passages: ["Job 36, 37", "Proverbios 4", "Mateo 22"] },
    { month: 1, day: 23, passages: ["Job 38, 39", "Mateo 23"] },
    { month: 1, day: 24, passages: ["Job 40, 41", "Salmos 10", "Mateo 24"] },
    { month: 1, day: 25, passages: ["Job 42", "Salmos 11", "Mateo 25"] },
    { month: 1, day: 26, passages: ["Génesis 12", "Proverbios 5", "Mateo 26"] },
    { month: 1, day: 27, passages: ["Génesis 13, 14", "Mateo 27"] },
    { month: 1, day: 28, passages: ["Génesis 15, 16", "Proverbios 6", "Mateo 28"] },
    { month: 1, day: 29, passages: ["Génesis 17, 18", "Hechos 1"] },
    { month: 1, day: 30, passages: ["Génesis 19, 20", "Salmos 12", "Hechos 2"] },
    { month: 1, day: 31, passages: ["Génesis 21, 22", "Salmos 13", "Hechos 3"] }
];

const februaryPlan: Reading[] = [
    { month: 2, day: 1, passages: ["Hechos 4", "Génesis 23, 24", "Proverbios 7"] },
    { month: 2, day: 2, passages: ["Hechos 5", "Génesis 25, 26"] },
    { month: 2, day: 3, passages: ["Hechos 6", "Génesis 27, 28", "Salmos 14"] },
    { month: 2, day: 4, passages: ["Hechos 7", "Génesis 29, 30"] },
    { month: 2, day: 5, passages: ["Hechos 8", "Génesis 31, 32", "Salmos 15"] },
    { month: 2, day: 6, passages: ["Hechos 9", "Génesis 33, 34"] },
    { month: 2, day: 7, passages: ["Hechos 10", "Génesis 35, 36", "Salmos 16"] },
    { month: 2, day: 8, passages: ["Hechos 11", "Génesis 37, 38"] },
    { month: 2, day: 9, passages: ["Hechos 12", "Génesis 39, 40", "Salmos 17"] },
    { month: 2, day: 10, passages: ["Hechos 13", "Génesis 41, 42"] },
    { month: 2, day: 11, passages: ["Hechos 14", "Génesis 43, 44", "Proverbios 8"] },
    { month: 2, day: 12, passages: ["Hechos 15", "Génesis 45, 46"] },
    { month: 2, day: 13, passages: ["Hechos 16", "Génesis 47, 48", "Salmos 18"] },
    { month: 2, day: 14, passages: ["Hechos 17", "Génesis 49, 50"] },
    { month: 2, day: 15, passages: ["Hechos 18", "Éxodo 1, 2", "Proverbios 9"] },
    { month: 2, day: 16, passages: ["Hechos 19", "Éxodo 3, 4"] },
    { month: 2, day: 17, passages: ["Hechos 20", "Éxodo 5, 6", "Salmos 19"] },
    { month: 2, day: 18, passages: ["Hechos 21", "Éxodo 7, 8"] },
    { month: 2, day: 19, passages: ["Hechos 22", "Éxodo 9, 10", "Salmos 20"] },
    { month: 2, day: 20, passages: ["Hechos 23", "Éxodo 11, 12"] },
    { month: 2, day: 21, passages: ["Hechos 24", "Éxodo 13, 14", "Salmos 21"] },
    { month: 2, day: 22, passages: ["Hechos 25", "Éxodo 15, 16"] },
    { month: 2, day: 23, passages: ["Hechos 26", "Éxodo 17, 18", "Proverbios 10"] },
    { month: 2, day: 24, passages: ["Hechos 27", "Éxodo 19, 20"] },
    { month: 2, day: 25, passages: ["Hechos 28", "Éxodo 21, 22", "Salmos 22"] },
    { month: 2, day: 26, passages: ["Marcos 1", "Éxodo 23, 24", "Salmos 23"] },
    { month: 2, day: 27, passages: ["Marcos 2", "Éxodo 25, 26"] },
    { month: 2, day: 28, passages: ["Marcos 3", "Éxodo 27, 28", "Proverbios 11"] }
];

export const studyPlan: Reading[] = [
    ...januaryPlan,
    ...februaryPlan
];
