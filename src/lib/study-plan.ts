
export type Reading = {
  month: number;
  day: number;
  passages: string[];
};

const januaryPlan: Reading[] = [
    { month: 1, day: 1, passages: ["Génesis 1-2", "Salmos 1", "Mateo 1"] },
    { month: 1, day: 2, passages: ["Génesis 3-4", "Mateo 2"] },
    { month: 1, day: 3, passages: ["Génesis 5-6", "Proverbios 1", "Mateo 3"] },
    { month: 1, day: 4, passages: ["Génesis 7-8", "Mateo 4"] },
    { month: 1, day: 5, passages: ["Génesis 9-10", "Salmos 2", "Mateo 5"] },
    { month: 1, day: 6, passages: ["Génesis 11", "Proverbios 2", "Mateo 6"] },
    { month: 1, day: 7, passages: ["Job 1-2", "Salmos 3", "Mateo 7"] },
    { month: 1, day: 8, passages: ["Job 3-5", "Mateo 8"] },
    { month: 1, day: 9, passages: ["Job 6-7", "Salmos 4", "Mateo 9"] },
    { month: 1, day: 10, passages: ["Job 8-10", "Mateo 10"] },
    { month: 1, day: 11, passages: ["Job 11-12", "Proverbios 3", "Mateo 11"] },
    { month: 1, day: 12, passages: ["Job 13-14", "Salmos 5", "Mateo 12"] },
    { month: 1, day: 13, passages: ["Job 15-17", "Mateo 13"] },
    { month: 1, day: 14, passages: ["Job 18-19", "Salmos 6", "Mateo 14"] },
    { month: 1, day: 15, passages: ["Job 20-21", "Mateo 15"] },
    { month: 1, day: 16, passages: ["Job 22-24", "Mateo 16"] },
    { month: 1, day: 17, passages: ["Job 25-28", "Salmos 7", "Mateo 17"] },
    { month: 1, day: 18, passages: ["Job 29-31", "Mateo 18"] },
    { month: 1, day: 19, passages: ["Job 32-33", "Mateo 19"] },
    { month: 1, day: 20, passages: ["Job 34-35", "Salmos 8", "Mateo 20"] },
    { month: 1, day: 21, passages: ["Job 36-37", "Salmos 9", "Mateo 21"] },
    { month: 1, day: 22, passages: ["Job 38-39", "Proverbios 4", "Mateo 22"] },
    { month: 1, day: 23, passages: ["Job 40-42", "Mateo 23"] },
    { month: 1, day: 24, passages: ["Génesis 12-13", "Salmos 10", "Mateo 24"] },
    { month: 1, day: 25, passages: ["Génesis 14", "Mateo 25"] },
    { month: 1, day: 26, passages: ["Génesis 15-16", "Salmos 11", "Mateo 26"] },
    { month: 1, day: 27, passages: ["Génesis 17", "Proverbios 5", "Mateo 27"] },
    { month: 1, day: 28, passages: ["Génesis 18", "Proverbios 6", "Mateo 28"] },
    { month: 1, day: 29, passages: ["Génesis 19-20", "Hechos 1"] },
    { month: 1, day: 30, passages: ["Génesis 21", "Salmos 12", "Hechos 2"] },
    { month: 1, day: 31, passages: ["Génesis 22", "Salmos 13", "Hechos 3"] }
];

export const studyPlan: Reading[] = [
    ...januaryPlan
];
