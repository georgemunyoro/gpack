import { spawn, spawnSync } from "child_process";
import { readPackageJson } from "../utils/packageJson";
import fs from "fs";
import commandExists from "command-exists";

/**
 * Get a list of all the binaries available to run
 * @returns list of binaries, e.g. ["eslint", "prettier"]
 */
const getAvailableBinaries = () => {
  const nodeModulesBinPath = "./node_modules/.bin";
  const binaries = fs.readdirSync(nodeModulesBinPath);
  return binaries;
};

/**
 * Get the path to a binary
 * @param binaryName name of the binary, e.g. "eslint"
 * @returns path to the binary, e.g. "./node_modules/.bin/eslint"
 */
const getBinaryPath = (binaryName: string) =>
  `./node_modules/.bin/${binaryName}`;

/**
 * Run a script from package.json
 * @param scriptName name of the script to run, e.g. "start". This is the key in the scripts object in package.json
 */
const runScript = async (scriptName: string) => {
  const { scripts } = readPackageJson();
  const script = scripts[scriptName];

  // Check if script exists in package.json
  if (!script) {
    console.error(`Script "${scriptName}" not found in package.json`);
    process.exit(1);
  }

  for (const scriptPart of script.split("&&"))
    if (scriptPart.trim() !== "") await executeScript(scriptPart.trim());
};

const executeScript = async (script: string) => {
  const [command, ...args] = script.split(" ");
  const isSystemCommand = commandExists.sync(command);

  // Check if a binary for the command exists in node_modules/.bin
  const binaries = getAvailableBinaries();
  if (!binaries.includes(command) && !isSystemCommand) {
    console.error(`\nCommand "${command}" not found in node_modules/.bin`);
    console.log(
      "\nPossible reasons for this error:\n" +
        " - You have not installed the package that provides this command\n" +
        " - You have installed the package, but it does not provide this command.\n" +
        " - You used a different package manager to install the package (e.g. npm or yarn)\n" +
        " - gpack is broken and you should open an issue at https://github.com/georgemunyoro/gpack\n"
    );
    process.exit(1);
  }

  console.log(`$ ${script}`);

  const binaryPath = isSystemCommand ? command : getBinaryPath(command);

  // Run the script
  const child = spawnSync(binaryPath, args, { stdio: "inherit" });
};

export default runScript;
