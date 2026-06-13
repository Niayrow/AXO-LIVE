import { useMemo } from "react";

// Calculates the basic editing distance between two strings
export const getLevenshteinDistance = (a: string, b: string): number => {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

// Computes a fuzzy matching strength (0-100) between the stop name and query string
export const getFuzzyMatchScore = (stopName: string, query: string): number => {
  // Convert to lowercase and diacritics removal
  const cleanStop = stopName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleanQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Perfect substring match (highest priority score)
  if (cleanStop.includes(cleanQuery)) {
    return 100 - (cleanStop.indexOf(cleanQuery) * 2) - (cleanStop.length - cleanQuery.length);
  }

  // 2. Word-by-word comparison for spelling mistake tolerance
  const stopWords = cleanStop.split(/[\s-]+/);
  const queryWords = cleanQuery.split(/[\s-]+/);

  let totalScore = 0;

  for (const qWord of queryWords) {
    if (!qWord) continue;
    let bestWordScore = 0;

    for (const sWord of stopWords) {
      if (!sWord) continue;

      // Prefix match (e.g. "berth" matches "berthe")
      if (sWord.startsWith(qWord)) {
        bestWordScore = Math.max(bestWordScore, 85 - (sWord.length - qWord.length));
        continue;
      }

      // Inter-word substring
      if (sWord.includes(qWord)) {
        bestWordScore = Math.max(bestWordScore, 70 - (sWord.length - qWord.length));
        continue;
      }

      // Levenshtein typo distance tolerance
      const dist = getLevenshteinDistance(sWord, qWord);
      const maxLength = Math.max(sWord.length, qWord.length);

      // Max allowed errors: 2 for long words (>4), 1 for medium (>2), 0 for short
      const maxAllowedDist = qWord.length > 4 ? 2 : qWord.length > 2 ? 1 : 0;

      if (dist <= maxAllowedDist) {
        const similarity = 1 - dist / maxLength;
        bestWordScore = Math.max(bestWordScore, Math.round(similarity * 60));
      }
    }
    totalScore += bestWordScore;
  }

  return totalScore / queryWords.length;
};

export function useFuzzySearch(allStops: any[] | undefined, searchQuery: string) {
  const filteredStops = useMemo(() => {
    if (!searchQuery.trim() || !allStops) return [];

    return allStops
      .map((stop: any) => {
        const score = getFuzzyMatchScore(stop.stop_name || "", searchQuery);
        return { stop, score };
      })
      .filter((item: any) => item.score > 25)
      .sort((a: any, b: any) => b.score - a.score)
      .map((item: any) => item.stop)
      .slice(0, 8); // Premium compact view limit
  }, [searchQuery, allStops]);

  return filteredStops;
}
