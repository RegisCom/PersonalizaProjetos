/**
 * Custom Autocomplete Storage with 24-Hour Expiration Persistence
 */

export interface SuggestionItem {
  text: string;
  timestamp: number; // Date.now() in milliseconds
}

const STORAGE_PREFIX = "custom_autocomplete_24h_";
const EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Validates whether a suggestion timestamp is within the 24-hour retention window.
 * @param timestamp - Epoch timestamp in milliseconds
 * @returns true if valid (< 24 hours old), false if expired (>= 24 hours old)
 */
export function isSuggestionValid(timestamp: number): boolean {
  if (!timestamp || typeof timestamp !== "number") return false;
  const age = Date.now() - timestamp;
  return age >= 0 && age < EXPIRATION_MS;
}

/**
 * Retrieves valid (< 24 hours old) suggestion items for a given field key.
 * Automatically cleans up expired items from localStorage.
 */
export function getSuggestions(fieldKey: string): SuggestionItem[] {
  if (!fieldKey) return [];
  try {
    const storageKey = STORAGE_PREFIX + fieldKey;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];

    const items: SuggestionItem[] = JSON.parse(raw);
    if (!Array.isArray(items)) return [];

    // Filter valid items strictly less than 24 hours old
    const validItems = items.filter((item) => isSuggestionValid(item.timestamp));

    // Automatically purge expired items from localStorage
    if (validItems.length !== items.length) {
      if (validItems.length === 0) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(validItems));
      }
    }

    return validItems;
  } catch (err) {
    return [];
  }
}

/**
 * Saves a typed search/form term for a field key with the current timestamp.
 * Maintains up to 15 recent unique entries.
 */
export function saveSuggestion(fieldKey: string, text: string): void {
  const cleanText = text ? text.trim() : "";
  if (!fieldKey || !cleanText || cleanText.length < 2) return;

  try {
    const storageKey = STORAGE_PREFIX + fieldKey;
    const validItems = getSuggestions(fieldKey); // Pre-cleans expired items

    // Filter out existing duplicate (case-insensitive)
    const filtered = validItems.filter(
      (item) => item.text.toLowerCase() !== cleanText.toLowerCase()
    );

    // Add new term at the top with current timestamp
    filtered.unshift({
      text: cleanText,
      timestamp: Date.now(),
    });

    // Limit to max 15 entries
    const limited = filtered.slice(0, 15);
    localStorage.setItem(storageKey, JSON.stringify(limited));
  } catch (err) {
    console.error("Error saving autocomplete suggestion:", err);
  }
}

/**
 * Deletes a single suggestion term from a field's stored suggestions.
 */
export function removeSuggestion(fieldKey: string, textToRemove: string): void {
  if (!fieldKey || !textToRemove) return;
  try {
    const storageKey = STORAGE_PREFIX + fieldKey;
    const validItems = getSuggestions(fieldKey);
    const updated = validItems.filter((item) => item.text !== textToRemove);

    if (updated.length === 0) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    }
  } catch (err) {
    console.error("Error removing autocomplete suggestion:", err);
  }
}

/**
 * Scans all custom autocomplete storage keys and purges expired entries (> 24 hours).
 */
export function purgeAllExpiredSuggestions(): void {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const items: SuggestionItem[] = JSON.parse(raw);
          const valid = items.filter((item) => isSuggestionValid(item.timestamp));
          if (valid.length === 0) {
            localStorage.removeItem(key);
          } else if (valid.length !== items.length) {
            localStorage.setItem(key, JSON.stringify(valid));
          }
        }
      }
    }
  } catch (err) {
    console.error("Error purging all expired suggestions:", err);
  }
}
