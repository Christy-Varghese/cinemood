/**
 * Genre pulse — which genres are over-represented in what people watch *this week*
 * compared with the catalogue's usual mix. Pure (unit-tested).
 */
export interface PulseInput {
  genreIds: number[];
}
export interface GenrePulse {
  id: number;
  /** Share of this week's trending attention (0–1). */
  share: number;
  /** share ÷ usual share; 1 = normal, 2 = twice as common as usual. */
  lift: number;
}

/** Rank-weighted genre shares: #1 counts more than #60. Multi-genre films split their weight. */
export function genreShares(list: PulseInput[]): Map<number, number> {
  const shares = new Map<number, number>();
  let total = 0;
  list.forEach((m, i) => {
    if (!m.genreIds.length) return;
    const w = 1 / Math.sqrt(i + 1);
    total += w;
    for (const g of m.genreIds) shares.set(g, (shares.get(g) ?? 0) + w / m.genreIds.length);
  });
  if (total > 0) for (const [g, v] of shares) shares.set(g, v / total);
  return shares;
}

export function genrePulse(trending: PulseInput[], baseline: PulseInput[], opts: { minShare?: number; smoothing?: number } = {}): GenrePulse[] {
  const minShare = opts.minShare ?? 0.04;
  const k = opts.smoothing ?? 0.01; // stops tiny genres posting silly multipliers
  const now = genreShares(trending);
  const usual = genreShares(baseline);
  return [...now.entries()]
    .filter(([, share]) => share >= minShare)
    .map(([id, share]) => ({ id, share, lift: (share + k) / ((usual.get(id) ?? 0) + k) }))
    .sort((a, b) => b.lift - a.lift);
}
