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

  if (limit === totalPossible) {
    const exhaustive: (readonly unknown[])[] = [];
    for (let index = 0; index < limit; index += 1) {
      exhaustive.push(decodeCombination(index, valueSets));
    }
    return { combinations: exhaustive, totalPossible, truncated: false };
  }

  return {
    combinations: generateCoverageCombinations(valueSets, limit),
    totalPossible,
    truncated: true,
  };
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

function generateCoverageCombinations(
  valueSets: readonly (readonly unknown[])[],
  limit: number,
): readonly (readonly unknown[])[] {
  if (limit === 0) {
    return [];
  }

  const selected = new Map<string, readonly unknown[]>();
  const add = (combination: readonly unknown[]): void => {
    if (selected.size < limit) {
      selected.set(JSON.stringify(combination), combination);
    }
  };

  const base = valueSets.map((values) => values[0]);
  add(base);

  for (let dimensionIndex = 0; dimensionIndex < valueSets.length && selected.size < limit; dimensionIndex += 1) {
    const values = valueSets[dimensionIndex] ?? [];
    for (let valueIndex = 1; valueIndex < values.length && selected.size < limit; valueIndex += 1) {
      const combination = [...base];
      combination[dimensionIndex] = values[valueIndex];
      add(combination);
    }
  }

  const totalPossible = valueSets.reduce((product, values) => product * values.length, 1);
  for (let index = 1; selected.size < limit && index < totalPossible; index += 1) {
    add(decodeCombination(index, valueSets));
  }

  return [...selected.values()];
}
