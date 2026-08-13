import { SnapRunError } from "./snaprun-error.js";

export class InvalidPathSegmentError extends SnapRunError {
  readonly code = "INVALID_PATH_SEGMENT";

  constructor(segmentName: string, rawValue: string) {
    super(`The configured ${segmentName} contains invalid path characters: ${rawValue}`);
  }
}
