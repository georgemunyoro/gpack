import { spawnSync } from "child_process";
import { readPackageJson } from "../utils/packageJson";
import fs from "fs";
import commandExists from "command-exists";
import path from "path";

/**
 * Get a list of all the binaries available to run
 * @returns list of binaries, e.g. ["eslint", "prettier"]
 */
const getAvailableBinaries = () => {
  const globalBinPath = path.resolve(
    process.env.HOME as string,
    ".gpack/node_modules/.bin"
  );
  const nodeModulesBinPath = "./node_modules/.bin";
  const binaries = fs.readdirSync(nodeModulesBinPath);
  if (!fs.existsSync(globalBinPath))
    fs.mkdirSync(globalBinPath, { recursive: true });
  const globalBinaries = fs.readdirSync(globalBinPath);
  return [...binaries, ...globalBinaries];
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
const runScript = async (scriptName: string, args: string[]) => {
  const { scripts } = readPackageJson();
  const script = `${scripts[scriptName] || scriptName} ${args.join(" ")}`;

  // Check if script exists in package.json
  if (!script) {
    // If not, check if it exists in node_modules/.bin
    const binaries = getAvailableBinaries();
    if (!binaries.includes(scriptName)) {
      console.error(`Script "${scriptName}" not found in package.json`);
      process.exit(1);
    }
  }

  for (const scriptPart of script.split("&&"))
    if (scriptPart.trim() !== "") await executeScript(scriptPart.trim());
};

const executeScript = async (script: string) => {
  const [command, ...args] = script.split(" ");
  const isSystemCommand = commandExists.sync(command);

  const binaries = getAvailableBinaries();
  const isPackageBinary = binaries.includes(command);

  // Check if a binary for the command exists in node_modules/.bin
  if (!binaries.includes(command) && !isSystemCommand && !isPackageBinary) {
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

  // replace env variables in args
  const replacedArgs = args.map((arg) => {
    // const envVar = arg.match(/\${(.*)}/);

    // find all env variables in the arg and replace them with their values
    const envVars = arg.match(/\${(.*)}/g);
    if (envVars) {
      for (const envVar of envVars) {
        const envVarName = envVar.replace("${", "").replace("}", "");
        const envVarValue = process.env[envVarName];
        if (!envVarValue) {
          console.error(
            `Environment variable "${envVarName}" not found in .env file`
          );
          process.exit(1);
        }
        arg = arg.replace(envVar, envVarValue);
      }
    }

    return arg;
  });

  // Run the script
  const child = spawnSync(binaryPath, replacedArgs, {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });
};

export const listAllScripts = () => {
  const { scripts } = readPackageJson();
  console.log("Available scripts:");
  for (const scriptName in scripts) {
    console.log(` - \x1b[33m${scriptName} \x1b[0m${scripts[scriptName]}`);
  }
};

export default runScript;
