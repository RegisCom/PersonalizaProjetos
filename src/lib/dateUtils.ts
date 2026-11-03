/**
 * Utility function to format any date representation (YYYY-MM-DD, ISO string, Timestamp)
 * into the standard Brazilian format: dd/mm/yyyy.
 */
export function formatDateBR(dateVal?: string | Date | null): string {
  if (!dateVal) return "";

  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return "";
    const d = String(dateVal.getDate()).padStart(2, "0");
    const m = String(dateVal.getMonth() + 1).padStart(2, "0");
    const y = dateVal.getFullYear();
    return `${d}/${m}/${y}`;
  }

  const str = String(dateVal).trim();
  if (!str || str === "N/I" || str === "-") return "";

  // Check if already in DD/MM/YYYY or DD/MM/YY
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(str)) {
    const [d, m, y] = str.split("/");
    const fullY = y.length === 2 ? `20${y}` : y;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${fullY}`;
  }

  // Check if format is YYYY-MM-DD or starts with YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }

  // Parse using Date
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, "0");
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const y = parsed.getFullYear();
    return `${d}/${m}/${y}`;
  }

  return str;
}

/**
 * Normalizes any date string (YYYY-MM-DD, DD/MM/YYYY, etc.) to a comparable YYYY-MM-DD string.
 * Returns null if invalid or missing.
 */
export function normalizeDateToISO(dateVal?: string | Date | null): string | null {
  if (!dateVal) return null;

  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return null;
    const y = dateVal.getFullYear();
    const m = String(dateVal.getMonth() + 1).padStart(2, "0");
    const d = String(dateVal.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const str = String(dateVal).trim();
  if (!str || str === "N/I" || str === "-") return null;

  // DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const fullY = y.length === 2 ? `20${y}` : y;
    return `${fullY}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return null;
}
