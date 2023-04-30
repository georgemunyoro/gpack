export interface Dependencies {
  [key: string]: string;
}

export interface DependencyNode {
  name: string;
  version: string;
  dependencies?: DependencyTree;
  devDependencies?: DependencyTree;
  bin?: {
    [key: string]: string;
  };
}

export interface DependencyTree {
  [key: string]: DependencyNode;
}

export interface PackageJson {
  name: string;
  version: string;
  dependencies?: Dependencies;
  devDependencies?: Dependencies;
  bin?: {
    [key: string]: string;
  };
}

export interface DependencyInfo {
  name: string;
  version: string;
}
