export type PackageVersion = {
  name: string;
  version: string;
  description: string;
  main: string;
  dependencies: {
    [name: string]: string;
  };
  scripts: {
    [script: string]: string;
  };
  dist: {
    integrity: string;
    shasum: string;
    tarball: string;
    fileCount: number;
    unpackedSize: number;
  };
};

export type Package = {
  _id: string;
  _rev: string;
  name: string;
  description: string;
  "dist-tags": {
    [tag: string]: string;
  };
  versions: {
    [version: string]: PackageVersion;
  };
  maintainers: {
    name: string;
    email: string;
  }[];
  time: {
    [version: string]: string;
  };
  repository: {
    type: string;
    url: string;
  };
  readme: string;
  readmeFilename: string;
  homepage: string;
  keywords: string[];
  bugs: {
    url: string;
  };
  users: {
    name: string;
    email: string;
  }[];
  license: string;
};
