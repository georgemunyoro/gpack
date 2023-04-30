import path from "path";
import { Package } from "./types";
import { readFileSync } from "fs";
import { PackageJson } from "../install/types";

export const getPackage = async (
  name: string,
  version?: string
): Promise<Package> => {
  if (name.startsWith("file:")) {
    const packagePath = name.replace("file:", "");
    const packageJsonPath = path.join(packagePath, "package.json");
    const rawPackageJson = readFileSync(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(rawPackageJson) as PackageJson;
    return packageJson as unknown as Package;
  }

  const res = await fetch(
    `https://registry.npmjs.org/${name}/${version ?? "latest"}`
  );
  const data = await res.json();
  return data;
};
