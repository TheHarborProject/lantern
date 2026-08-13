#!/usr/bin/env node
import { createProgram } from "./cli/program.js";

const program = createProgram();

// Without arguments, `snaprun` now executes the default action (RFC-010):
// capture every run. Help remains available through `--help`/`-h`.
program.parse(process.argv);
