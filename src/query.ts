import { getPackage } from "./registry";

const query = async (module: string) => {
  const packageInfo = await getPackage(module);
  console.log(packageInfo);
};

export default query;
