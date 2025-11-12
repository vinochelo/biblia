import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type AiUsageType = 'tts' | 'dictionary';

const API_USAGE_COUNT_KEY = "api-usage-count";
const API_USAGE_RESET_DATE_KEY = "api-usage-reset-date";

const getAiStorageKeys = (type: AiUsageType) => ({
  countKey: `ai-api-usage-count-${type}`,
  resetDateKey: `ai-api-usage-reset-date-${type}`,
});


const getCurrentMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()}`;
}

export function trackApiCall() {
  if (typeof window !== 'undefined') {
    const currentMonthKey = getCurrentMonthKey();
    const lastResetMonth = localStorage.getItem(API_USAGE_RESET_DATE_KEY);

    let count = 0;
    if (currentMonthKey === lastResetMonth) {
        const storedUsage = localStorage.getItem(API_USAGE_COUNT_KEY);
        count = storedUsage ? parseInt(storedUsage, 10) : 0;
    } else {
        localStorage.setItem(API_USAGE_RESET_DATE_KEY, currentMonthKey);
    }
    
    count++;
    localStorage.setItem(API_USAGE_COUNT_KEY, count.toString());

    // Dispatch a storage event to notify other tabs
    window.dispatchEvent(new StorageEvent('storage', {
      key: API_USAGE_COUNT_KEY,
      newValue: count.toString(),
    }));
  }
}


export function trackAiApiCall(type: AiUsageType) {
  if (typeof window !== 'undefined') {
    const { countKey, resetDateKey } = getAiStorageKeys(type);
    const currentMonthKey = getCurrentMonthKey();
    const lastResetMonth = localStorage.getItem(resetDateKey);

    let count = 0;
    if (currentMonthKey === lastResetMonth) {
        const storedUsage = localStorage.getItem(countKey);
        count = storedUsage ? parseInt(storedUsage, 10) : 0;
    } else {
        localStorage.setItem(resetDateKey, currentMonthKey);
    }
    
    count++;
    localStorage.setItem(countKey, count.toString());

    // Dispatch a storage event to notify other tabs
    window.dispatchEvent(new StorageEvent('storage', {
      key: countKey,
      newValue: count.toString(),
    }));
  }
}
