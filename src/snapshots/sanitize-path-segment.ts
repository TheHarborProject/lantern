import { InvalidPathSegmentError } from "../errors/invalid-path-segment-error.js";

export function sanitizePathSegment(segmentName: string, rawValue: string): string {
  if (rawValue.includes("/") || rawValue.includes("\\")) {
    throw new InvalidPathSegmentError(segmentName, rawValue);
  }

  const trimmedValue = rawValue.trim();

  if (trimmedValue === "" || trimmedValue === "." || trimmedValue === "..") {
    throw new InvalidPathSegmentError(segmentName, rawValue);
  }

  const normalizedValue = trimmedValue
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");

  if (normalizedValue === "" || normalizedValue === "." || normalizedValue === "..") {
    throw new InvalidPathSegmentError(segmentName, rawValue);
  }

  return normalizedValue;
}
