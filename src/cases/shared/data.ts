// Runtime data rides in the page as JSON (parts.dataBlock), the playground's pattern, so a case script never fetches.
export const readData = <T>(id = 'case-data'): T | undefined => {
  try {
    const text = document.getElementById(id)?.textContent;
    return text ? (JSON.parse(text) as T) : undefined;
  } catch {
    return undefined;
  }
};
