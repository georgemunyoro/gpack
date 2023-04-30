#!/usr/bin/env node

import { Command } from "commander";
import runScript from "./run";
import install from "./install";
import query from "./query";

const program = new Command();

program
  // .version(process.version)
  .description("A CLI tool for managing your nodejs packages");

program
  .command("install [modules...]")
  .action(install)
  .description("Install a nodejs module");

program.command("info <module>").action(query).description("Query a module");

program
  .command("run <command> [args...]")
  .action(runScript)
  .description("Run a package script");

program.parse();
