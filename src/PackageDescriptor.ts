export default class PackageDescriptor {
  key: string;
  name: string;
  version: string;

  constructor(key: string, name: string, version: string) {
    this.key = key;
    this.name = name;
    this.version = version;
  }
}
