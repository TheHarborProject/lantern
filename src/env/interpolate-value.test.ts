import { describe, expect, it } from "vitest";
import { EnvVariableMissingError } from "../errors/env-variable-missing-error.js";
import { interpolateValue } from "./interpolate-value.js";

describe("interpolateValue", () => {
  it("résout une variable depuis processEnv", () => {
    const result = interpolateValue("${API_KEY}", {
      processEnv: { API_KEY: "secret-value" },
      fileEnv: {},
    });

    expect(result).toBe("secret-value");
  });

  it("résout plusieurs interpolations dans une même chaîne", () => {
    const result = interpolateValue("${SCHEME}://${HOST}:${PORT}", {
      processEnv: { SCHEME: "https", HOST: "example.com", PORT: "443" },
      fileEnv: {},
    });

    expect(result).toBe("https://example.com:443");
  });

  it("priorise processEnv sur fileEnv", () => {
    const result = interpolateValue("${FOO}", {
      processEnv: { FOO: "from-process-env" },
      fileEnv: { FOO: "from-file-env" },
    });

    expect(result).toBe("from-process-env");
  });

  it("se rabat sur fileEnv si absent de processEnv", () => {
    const result = interpolateValue("${FOO}", {
      processEnv: {},
      fileEnv: { FOO: "from-file-env" },
    });

    expect(result).toBe("from-file-env");
  });

  it("lève ENV_VARIABLE_MISSING avec uniquement le nom de la variable si introuvable", () => {
    try {
      interpolateValue("${MISSING_SECRET}", { processEnv: {}, fileEnv: {} });
      expect.fail("interpolateValue aurait dû lever une erreur");
    } catch (error) {
      expect(error).toBeInstanceOf(EnvVariableMissingError);
      const missingError = error as EnvVariableMissingError;
      expect(missingError.code).toBe("ENV_VARIABLE_MISSING");
      expect(missingError.variableName).toBe("MISSING_SECRET");
      expect(missingError.message).toBe("Missing environment variable: MISSING_SECRET");
    }
  });

  it("ne fait fuiter aucune valeur résolue dans le message d'erreur d'une autre variable manquante", () => {
    try {
      interpolateValue("${API_KEY}-${MISSING}", {
        processEnv: { API_KEY: "top-secret-value" },
        fileEnv: {},
      });
      expect.fail("interpolateValue aurait dû lever une erreur");
    } catch (error) {
      const missingError = error as EnvVariableMissingError;
      expect(missingError.message).not.toContain("top-secret-value");
      expect(missingError.message).toBe("Missing environment variable: MISSING");
    }
  });
});
