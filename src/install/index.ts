import {
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  cpSync,
  chmodSync,
  rmSync,
  writeFileSync,
} from "fs";
import tar from "tar";
import path, { resolve } from "path";
import * as https from "https";
import {
  Dependencies,
  DependencyNode,
  DependencyTree,
  InstallOptions,
  PackageJson,
} from "./types";
import { getPackage } from "../registry";

const parsePackageVersion = (version?: string): string => {
  if (!version) return "latest";
  if (version.startsWith("^")) return version.slice(1);
  if (version.startsWith("~")) return version.slice(1);
  return version;
};

/**
 * Sorts a dependency tree alphabetically, recursively
 * @param tree
 * @returns
 */
const sortTreeDeep = (tree: DependencyTree): DependencyTree => {
  const sortedTree: DependencyTree = {};
  const sortedKeys = Object.keys(tree).sort();

  for (let key of sortedKeys) {
    sortedTree[key] = tree[key];
    const dependencyTree = sortedTree[key].dependencies;
    if (dependencyTree)
      sortedTree[key].dependencies = sortTreeDeep(dependencyTree);
  }

  return sortedTree;
};

const buildDependencyTree = async (
  dependencies: Dependencies
): Promise<DependencyTree> => {
  const tree: DependencyTree = {};
  const dependencyPromises = [];

  for (let [name, rawVersion] of Object.entries(dependencies)) {
    const version = parsePackageVersion(rawVersion);

    dependencyPromises.push(
      getPackage(name, version).then(async (res) => {
        const packageJson = res as unknown as PackageJson;
        tree[name] = {
          dependencies: packageJson.dependencies
            ? await buildDependencyTree(packageJson.dependencies)
            : undefined,
          name: packageJson.name,
          version: packageJson.version,
          bin: packageJson.bin,
        };
      })
    );
  }

  await Promise.all(dependencyPromises);
  return tree;
};

const generateDependencyTree = async (): Promise<DependencyTree> => {
  const hasLockfile = existsSync(resolve(process.cwd(), "gpack-lock.json"));
  if (hasLockfile) {
    const rawLockfile = readFileSync(
      resolve(process.cwd(), "gpack-lock.json"),
      "utf-8"
    );
    const lockfile = JSON.parse(rawLockfile) as DependencyTree;
    return lockfile;
  }

  const packageJsonPath = resolve(process.cwd(), "package.json");
  const rawPackageJson = readFileSync(packageJsonPath, "utf-8");
  const packageJson = JSON.parse(rawPackageJson) as PackageJson;

  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  if (!allDependencies) {
    console.error("No dependencies found in package.json");
    process.exit(1);
  }

  const tree = await buildDependencyTree(allDependencies);

  writeFileSync(
    "gpack-lock.json",
    JSON.stringify(sortTreeDeep(tree), null, 2) + "\n",
    "utf-8"
  );
  return tree;
};

const downloadAndExtractPackage = async (
  name: string,
  version: string,
  targetDir: string,
  filePackage?: string
): Promise<void> => {
  if (filePackage?.startsWith("file:")) {
    cpSync(filePackage.replace("file:", ""), targetDir, {
      recursive: true,
    });
    return;
  }

  const packageUrl = `https://registry.npmjs.org/${name}/-/${name.replace(
    "@types/",
    ""
  )}-${version}.tgz`;

  if (!existsSync(targetDir))
    mkdirSync(targetDir, {
      recursive: true,
    });

  return new Promise((resolve, reject) => {
    https
      .get(packageUrl, (res) => {
        if (res.statusCode === 200) {
          res
            .pipe(tar.extract({ cwd: targetDir, strip: 1 }))
            .on("finish", resolve)
            .on("error", reject);
        } else {
          reject(
            new Error(
              `Failed to download package: ${name}@${version} - HTTP status code: ${res.statusCode}`
            )
          );
        }
      })
      .on("error", reject);
  });
};

const handlePackageBinaries = async (
  node: DependencyNode,
  pathToPackage: string,
  moduleFolder: string = "node_modules"
): Promise<void> => {
  if (!node.bin) return;

  for (const binaryName of Object.keys(node.bin)) {
    const symlinksPath = path.join(moduleFolder, ".bin");
    if (!existsSync(symlinksPath)) mkdirSync(symlinksPath, { recursive: true });
    const binaryPath = path.join(pathToPackage, node.bin[binaryName]);
    const symlinkPath = path.join(moduleFolder, ".bin", binaryName);

    if (!existsSync(symlinkPath)) symlinkSync(binaryPath, symlinkPath, "file");
    // make sure the symlink is executable
    chmodSync(symlinkPath, "755");
  }
};

const buildNodeModules = async (
  tree: DependencyTree,
  basePath: string = "./node_modules",
  force?: boolean
): Promise<void> => {
  basePath = path.resolve(basePath);

  for (const [index, node] of Object.entries(tree)) {
    if (node === undefined || !node.name) continue;
    const packagePath = path.join(basePath, node.name);

    const alreadyInstalled = existsSync(path.join(basePath, node.name));
    if (alreadyInstalled) {
      if (force) {
        console.log(`Reinstalling ${node.name}@${node.version}`);
        rmSync(packagePath, { recursive: true });
        Object.keys(node.bin || {}).forEach((bin) => {
          rmSync(path.join(basePath, ".bin", bin));
        });
      } else {
        console.log(
          `Skipping ${node.name}@${node.version} - already installed`
        );
        continue;
      }
    }

    console.log(`Installing ${node.name}@${node.version}`);
    const packageVersionPath = path.join(packagePath, "node_modules");
    await downloadAndExtractPackage(
      node.name,
      node.version,
      packagePath,
      index
    );

    await handlePackageBinaries(node, packagePath, basePath);

    if (node.dependencies) {
      await buildNodeModules(node.dependencies, packageVersionPath, force);
    }
  }
};

const installPackage = async (name: string, opts: InstallOptions) => {
  const [packageName, packageVersion] = name.split("@");

  let dependencyTree = {};

  const packageJsonPath = resolve(process.cwd(), "package.json");
  const rawPackageJson = readFileSync(packageJsonPath, "utf-8");
  const packageJson = JSON.parse(rawPackageJson) as PackageJson;

  if (opts.global) {
    dependencyTree = await buildDependencyTree({
      [packageName]: packageVersion,
    });
  } else {
    if (opts["save-dev"]) {
      packageJson.devDependencies = {
        ...packageJson.devDependencies,
        [packageName]: packageVersion,
      };
    } else {
      packageJson.dependencies = {
        ...packageJson.dependencies,
        [packageName]: packageVersion,
      };
    }

    dependencyTree = await buildDependencyTree({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    });

    writeFileSync(
      "gpack-lock.json",
      JSON.stringify(dependencyTree, null, 2),
      "utf-8"
    );
  }

  const globalInstallPath = `${process.env.HOME}/.gpack/node_modules`;

  if (opts.global && !existsSync(globalInstallPath)) {
    mkdirSync(globalInstallPath, { recursive: true });
  }

  await buildNodeModules(
    dependencyTree,
    opts.global ? globalInstallPath : "./node_modules",
    opts.force
  );

  // update package.json
  writeFileSync(
    packageJsonPath + "\n",
    JSON.stringify(packageJson, null, 2),
    "utf-8"
  );
};

const install = async (modules?: string[], opts: InstallOptions = {}) => {
  if (modules?.length) {
    for (const module of modules) {
      await installPackage(module, opts);
      console.log("✨ Done!");
    }
    return;
  }

  const dependencyTree = await generateDependencyTree();
  await buildNodeModules(dependencyTree, "./node_modules", opts.force);
  console.log("✨ Done!");
};

export default install;
