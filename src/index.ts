#!/usr/bin/env node

import { Command } from "commander";
import runScript from "./run";
import install from "./install";
import query from "./query";

const program = new Command();

program
  .version(process.version)
  .description("A CLI tool for managing your nodejs packages");

program
  .command("install [modules...]")
  .option("-g, --global", "Install globally")
  .option("-f, --force", "Force install")
  .option("-s, --save", "Save to package.json")
  .option("-d, --save-dev", "Save to package.json as dev dependency")
  .action(install)
  .description("Install a nodejs module");

program.command("info <module>").action(query).description("Query a module");

program
  .command("run <command> [args...]")
  .action(runScript)
  .description("Run a package script");

program.parse();
