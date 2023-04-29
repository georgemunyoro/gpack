import { getPackage } from "../registry";

const install = async (modules?: string[]) => {
  if (!modules) {
    // install all modules in package.json
    return;
  }

  for (const module of modules) {
    // install module
    const packageInfo = await getPackage(module);
    console.log(packageInfo.readme);
  }
};

export default install;
