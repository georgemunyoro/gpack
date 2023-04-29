import fs from "fs";

export const readPackageJson = () => {
  const packageJson = fs.readFileSync("./package.json");
  const packageJsonObj = JSON.parse(packageJson.toString());
  return packageJsonObj;
};
