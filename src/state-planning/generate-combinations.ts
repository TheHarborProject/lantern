/**
 * Bounded, deterministic Cartesian product generation (RFC-006).
 *
 * Never materializes the full product: the theoretical size is computed
 * separately from generation, so an oversized product costs nothing beyond a
 * multiplication. Combinations are decoded directly from their index in a
 * stable mixed-radix order (the last dimension varies fastest), so the same
 * input always yields the same combinations in the same order — no sampling,
 * no randomness.
 */
export interface BoundedCombinationsResult {
  readonly combinations: readonly (readonly unknown[])[];
  /** The full Cartesian product size, even when generation was bounded below it. */
  readonly totalPossible: number;
  readonly truncated: boolean;
}

export function generateBoundedCombinations(
  valueSets: readonly (readonly unknown[])[],
  maxCombinations: number,
): BoundedCombinationsResult {
  if (valueSets.length === 0) {
    return { combinations: [[]], totalPossible: 1, truncated: false };
  }

  const totalPossible = valueSets.reduce((product, values) => product * values.length, 1);
  const limit = Math.max(0, Math.min(totalPossible, maxCombinations));

  const combinations: (readonly unknown[])[] = [];
  for (let index = 0; index < limit; index += 1) {
    combinations.push(decodeCombination(index, valueSets));
  }

  return { combinations, totalPossible, truncated: combinations.length < totalPossible };
}

/** Decode a linear index into one combination, last dimension fastest. */
function decodeCombination(index: number, valueSets: readonly (readonly unknown[])[]): readonly unknown[] {
  let remainder = index;
  const reversed = [...valueSets].reverse().map((values) => {
    const size = values.length;
    const choice = remainder % size;
    remainder = Math.floor(remainder / size);
    return values[choice];
  });
  return reversed.reverse();
}
