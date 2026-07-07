// Sørensen–Dice bigram similarity — cheap, dependency-free, and works well
// on short Cyrillic/Latin strings without needing a tokenizer.
function bigrams(value: string): Map<string, number> {
  const s = value.toLowerCase().replace(/\s+/g, " ").trim();
  const counts = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const gram = s.slice(i, i + 2);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

export function diceSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ga = bigrams(a);
  const gb = bigrams(b);
  if (ga.size === 0 || gb.size === 0) return 0;

  let intersection = 0;
  for (const [gram, countA] of ga) {
    const countB = gb.get(gram);
    if (countB) intersection += Math.min(countA, countB);
  }
  const total = [...ga.values()].reduce((s, v) => s + v, 0) + [...gb.values()].reduce((s, v) => s + v, 0);
  return (2 * intersection) / total;
}
