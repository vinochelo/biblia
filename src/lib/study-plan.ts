
export type Reading = {
  month: number;
  day: number;
  passages: string[];
};

const januaryPlan: Reading[] = [
    { month: 1, day: 1, passages: ["Mateo 1", "Génesis 1, 2", "Salmos 1"] },
    { month: 1, day: 2, passages: ["Mateo 2", "Génesis 3, 4"] },
    { month: 1, day: 3, passages: ["Mateo 3", "Génesis 5, 6", "Proverbios 1"] },
    { month: 1, day: 4, passages: ["Mateo 4", "Génesis 7, 8"] },
    { month: 1, day: 5, passages: ["Mateo 5", "Génesis 9, 10", "Salmos 2"] },
    { month: 1, day: 6, passages: ["Mateo 6", "Génesis 11", "Proverbios 2"] },
    { month: 1, day: 7, passages: ["Mateo 7", "Job 1, 2", "Salmos 3"] },
    { month: 1, day: 8, passages: ["Mateo 8", "Job 3, 4, 5"] },
    { month: 1, day: 9, passages: ["Mateo 9", "Job 6, 7", "Salmos 4"] },
    { month: 1, day: 10, passages: ["Mateo 10", "Job 8, 9, 10"] },
    { month: 1, day: 11, passages: ["Mateo 11", "Job 11, 12", "Proverbios 3"] },
    { month: 1, day: 12, passages: ["Mateo 12", "Job 13, 14", "Salmos 5"] },
    { month: 1, day: 13, passages: ["Mateo 13", "Job 15, 16, 17"] },
    { month: 1, day: 14, passages: ["Mateo 14", "Job 18, 19", "Salmos 6"] },
    { month: 1, day: 15, passages: ["Mateo 15", "Job 20, 21"] },
    { month: 1, day: 16, passages: ["Mateo 16", "Job 22, 23, 24"] },
    { month: 1, day: 17, passages: ["Mateo 17", "Job 25, 26, 27, 28", "Salmos 7"] },
    { month: 1, day: 18, passages: ["Mateo 18", "Job 29, 30, 31"] },
    { month: 1, day: 19, passages: ["Mateo 19", "Job 32, 33"] },
    { month: 1, day: 20, passages: ["Mateo 20", "Job 34, 35", "Salmos 8"] },
    { month: 1, day: 21, passages: ["Mateo 21", "Job 36, 37", "Salmos 9"] },
    { month: 1, day: 22, passages: ["Mateo 22", "Job 38, 39", "Proverbios 4"] },
    { month: 1, day: 23, passages: ["Mateo 23", "Job 40, 41, 42"] },
    { month: 1, day: 24, passages: ["Mateo 24", "Génesis 12", "Salmos 10"] },
    { month: 1, day: 25, passages: ["Mateo 25", "Génesis 13, 14", "Salmos 11"] },
    { month: 1, day: 26, passages: ["Mateo 26", "Génesis 15, 16"] },
    { month: 1, day: 27, passages: ["Mateo 27", "Génesis 17, 18", "Proverbios 5"] },
    { month: 1, day: 28, passages: ["Mateo 28", "Génesis 19, 20", "Proverbios 6"] },
    { month: 1, day: 29, passages: ["Hechos 1", "Génesis 21, 22"] },
    { month: 1, day: 30, passages: ["Hechos 2", "Génesis 23, 24", "Salmos 12"] },
    { month: 1, day: 31, passages: ["Hechos 3", "Génesis 25, 26", "Salmos 13"] }
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

const marchPlan: Reading[] = [
    { month: 3, day: 1, passages: ["Marcos 4", "Éxodo 29, 30", "Salmos 24"] },
    { month: 3, day: 2, passages: ["Marcos 5", "Éxodo 31, 32"] },
    { month: 3, day: 3, passages: ["Marcos 6", "Éxodo 33, 34", "Proverbios 12"] },
    { month: 3, day: 4, passages: ["Marcos 7", "Éxodo 35, 36"] },
    { month: 3, day: 5, passages: ["Marcos 8", "Éxodo 37, 38", "Salmos 25"] },
    { month: 3, day: 6, passages: ["Marcos 9", "Éxodo 39, 40"] },
    { month: 3, day: 7, passages: ["Marcos 10", "Levítico 1, 2, 3", "Salmos 26"] },
    { month: 3, day: 8, passages: ["Marcos 11", "Levítico 4, 5"] },
    { month: 3, day: 9, passages: ["Marcos 12", "Levítico 6, 7", "Proverbios 13"] },
    { month: 3, day: 10, passages: ["Marcos 13", "Levítico 8, 9"] },
    { month: 3, day: 11, passages: ["Marcos 14", "Levítico 10, 11", "Salmos 27"] },
    { month: 3, day: 12, passages: ["Marcos 15", "Levítico 12, 13"] },
    { month: 3, day: 13, passages: ["Marcos 16", "Levítico 14, 15", "Salmos 28"] },
    { month: 3, day: 14, passages: ["Romanos 1", "Levítico 16, 17", "Proverbios 14"] },
    { month: 3, day: 15, passages: ["Romanos 2", "Levítico 18, 19", "Salmos 29"] },
    { month: 3, day: 16, passages: ["Romanos 3", "Levítico 20, 21"] },
    { month: 3, day: 17, passages: ["Romanos 4", "Levítico 22, 23", "Proverbios 15"] },
    { month: 3, day: 18, passages: ["Romanos 5", "Levítico 24, 25"] },
    { month: 3, day: 19, passages: ["Romanos 6", "Levítico 26, 27", "Salmos 30"] },
    { month: 3, day: 20, passages: ["Romanos 7", "Números 1, 2"] },
    { month: 3, day: 21, passages: ["Romanos 8", "Números 3, 4", "Salmos 31"] },
    { month: 3, day: 22, passages: ["Romanos 9", "Números 5, 6"] },
    { month: 3, day: 23, passages: ["Romanos 10", "Números 7, 8", "Proverbios 16"] },
    { month: 3, day: 24, passages: ["Romanos 11", "Números 9, 10", "Salmos 32"] },
    { month: 3, day: 25, passages: ["Romanos 12", "Números 11, 12", "Salmos 33"] },
    { month: 3, day: 26, passages: ["Romanos 13", "Números 13, 14"] },
    { month: 3, day: 27, passages: ["Romanos 14", "Números 15, 16", "Salmos 34"] },
    { month: 3, day: 28, passages: ["Romanos 15", "Números 17, 18"] },
    { month: 3, day: 29, passages: ["Romanos 16", "Números 19, 20", "Proverbios 17"] },
    { month: 3, day: 30, passages: ["Lucas 1", "Números 21, 22"] },
    { month: 3, day: 31, passages: ["Lucas 2", "Números 23, 24", "Salmos 35"] }
];

export const studyPlan: Reading[] = [
    ...januaryPlan,
    ...februaryPlan,
    ...marchPlan
];
