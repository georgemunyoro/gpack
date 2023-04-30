import { DependencyInfo, DependencyNode, DependencyTree } from "./types";

export const flattenDependencies = (tree: DependencyTree): DependencyInfo[] => {
  const result: DependencyInfo[] = [];

  const traverse = (node: DependencyNode): void => {
    if (
      !result.some(
        (dep) => dep.name === node.name && dep.version === node.version
      )
    ) {
      result.push({ name: node.name, version: node.version });

      if (node.dependencies) {
        for (const child of Object.values(node.dependencies)) {
          traverse(child);
        }
      }
    }
  };

  for (const node of Object.values(tree)) {
    traverse(node);
  }

  return result;
};
