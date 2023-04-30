import {
  existsSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
} from "fs";
import tar from "tar";
import path, { resolve } from "path";
import * as https from "https";
import {
  Dependencies,
  DependencyNode,
  DependencyTree,
  PackageJson,
} from "./types";

const parsePackageVersion = (version?: string): string => {
  if (!version) return "latest";
  if (version.startsWith("^")) return version.slice(1);
  if (version.startsWith("~")) return version.slice(1);
  return version;
};

const buildDependencyTree = async (
  dependencies: Dependencies
): Promise<DependencyTree> => {
  const tree: DependencyTree = {};
  const dependencyPromises = [];

  for (let [name, rawVersion] of Object.entries(dependencies)) {
    const version = parsePackageVersion(rawVersion);

    dependencyPromises.push(
      fetch(`https://registry.npmjs.org/${name}/${version}`)
        .then((res) => res.json())
        .then(async (packageJson) => {
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

  return buildDependencyTree(allDependencies);
};

const downloadAndExtractPackage = async (
  name: string,
  version: string,
  targetDir: string
): Promise<void> => {
  const packageUrl = `https://registry.npmjs.org/${name}/-/${name.replace(
    "@types/",
    ""
  )}-${version}.tgz`;

  if (!existsSync(targetDir))
    mkdirSync(targetDir, {
      recursive: true,
    });

  return new Promise((resolve, reject) => {
    console.log(name, version, packageUrl);
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
  pathToPackage: string
): Promise<void> => {
  if (!node.bin) return;

  for (const binaryName of Object.keys(node.bin)) {
    const symlinksPath = path.join(process.cwd(), "node_modules", ".bin");
    if (!existsSync(symlinksPath)) mkdirSync(symlinksPath, { recursive: true });
    const binaryPath = path.join(pathToPackage, node.bin[binaryName]);
    const symlinkPath = path.join(
      process.cwd(),
      "node_modules",
      ".bin",
      binaryName
    );
    symlinkSync(binaryPath, symlinkPath, "file");
  }
};

const buildNodeModules = async (
  tree: DependencyTree,
  basePath: string = "./node_modules"
): Promise<void> => {
  basePath = path.resolve(process.cwd(), basePath);

  for (const node of Object.values(tree)) {
    if (node === undefined || !node.name) continue;

    console.log(`Installing ${node.name}@${node.version}...`);
    const packagePath = path.join(basePath, node.name);
    const packageVersionPath = path.join(packagePath, "node_modules");
    await downloadAndExtractPackage(node.name, node.version, packagePath);
    await handlePackageBinaries(node, packagePath);

    if (node.dependencies) {
      await buildNodeModules(node.dependencies, packageVersionPath);
    }
  }
};

const install = async (modules?: string[]) => {
  const dependencyTree = await generateDependencyTree();
  buildNodeModules(dependencyTree);
};

export default install;
