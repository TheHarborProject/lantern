import { isAbsolute, resolve } from "node:path";
import { Command } from "commander";
import { CONFIG_FILE_NAMES } from "../../config/config-file-names.js";
import { createConfigFile } from "../../config/create-config-file.js";
import { createDefaultConfig } from "../../config/defaults/index.js";
import { SnapRunError } from "../../errors/snaprun-error.js";
import type { GlobalCliOptions } from "../global-cli-options.js";

/** Default file name created by `snaprun init` (RFC-002/RFC-013). */
const DEFAULT_CONFIG_FILE_NAME = CONFIG_FILE_NAMES[0];

/**
 * Register `snaprun init` on the CLI program (RFC-013 §9). It writes an
 * exhaustive starter `snaprun.config.json` in the current working directory
 * and refuses to overwrite an existing configuration file. No interactive
 * questionnaire, no scan, no capture: init stays small and predictable.
 *
 * The global `--config <path>` option, when provided, selects the target
 * path so init stays consistent with the rest of the CLI.
 */
export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create a starter snaprun.config.json exposing every supported option.")
    .action((_options: unknown, command: Command) => {
      const { config, debug } = command.optsWithGlobals<GlobalCliOptions>();
      const cwd = process.cwd();
      const target =
        config === undefined
          ? resolve(cwd, DEFAULT_CONFIG_FILE_NAME)
          : isAbsolute(config)
            ? config
            : resolve(cwd, config);

      try {
        createConfigFile(target, createDefaultConfig());
        console.log(`✔ Created ${DEFAULT_CONFIG_FILE_NAME}`);
      } catch (error) {
        if (error instanceof SnapRunError) {
          console.error(`✖ ${error.message}`);

          if (debug === true) {
            console.error(error.stack);
            if (error.cause !== undefined) {
              console.error("Cause:", error.cause);
            }
          }

          process.exitCode = 1;
          return;
        }

        throw error;
      }
    });
}
