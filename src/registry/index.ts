import { Package } from "./types";

export const getPackage = async (name: string): Promise<Package> => {
  // get package from registry

  const res = await fetch("https://registry.npmjs.org/" + name);
  const data = await res.json();
  return data;
};
