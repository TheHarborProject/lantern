import { describe, expect, it } from "vitest";
import { generateBoundedCombinations } from "./generate-combinations.js";

describe("generateBoundedCombinations", () => {
  it("generates the full product when it fits under the limit", () => {
    const result = generateBoundedCombinations([[false, true], ["sm", "lg"]], 10);

    expect(result.totalPossible).toBe(4);
    expect(result.truncated).toBe(false);
    expect(result.combinations).toEqual([
      [false, "sm"],
      [false, "lg"],
      [true, "sm"],
      [true, "lg"],
    ]);
  });

  it("returns a single empty combination when there are no dimensions", () => {
    const result = generateBoundedCombinations([], 10);

    expect(result).toEqual({ combinations: [[]], totalPossible: 1, truncated: false });
  });

  it("is deterministic across repeated calls with the same input", () => {
    const valueSets = [
      ["default", "outline", "destructive"],
      ["sm", "md", "lg"],
      [false, true],
    ];

    expect(generateBoundedCombinations(valueSets, 100)).toEqual(generateBoundedCombinations(valueSets, 100));
  });

  it("bounds generation at maxCombinations and reports truncation", () => {
    const result = generateBoundedCombinations([[1, 2, 3], [1, 2, 3], [1, 2, 3]], 5);

    expect(result.totalPossible).toBe(27);
    expect(result.combinations).toHaveLength(5);
    expect(result.truncated).toBe(true);
  });

  it("does not truncate when the product exactly matches the limit", () => {
    const result = generateBoundedCombinations([[false, true], [false, true]], 4);

    expect(result.combinations).toHaveLength(4);
    expect(result.truncated).toBe(false);
  });

  it("produces no combinations when maxCombinations is zero", () => {
    const result = generateBoundedCombinations([[false, true]], 0);

    expect(result.combinations).toEqual([]);
    expect(result.truncated).toBe(true);
  });
});
