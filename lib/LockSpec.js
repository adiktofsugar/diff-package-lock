class LockSpec {
  constructor(name, spec, parent = null) {
    const { version, requires = {}, dependencies = {} } = spec;
    this.name = name;
    this.version = version;
    this.requires = requires;
    this.dependencies = dependencies;
    this.parent = parent;
  }

  get(name) {
    const spec = this.dependencies[name];
    if (spec) {
      return new LockSpec(name, spec, this);
    }
    if (!this.parent) {
      // this isn't necessarily an error (though it normally is)
      //  for a lerna repo, the local packages aren't in the package-lock.json
      // const error = new Error(`can not find dependency ${name}`);
      // error.code = "NOT_FOUND";
      // throw error;
      return new LockSpec(
        name,
        {
          version: "unknown"
        },
        this
      );
    }
    return this.parent.get(name);
  }

  getDependencies() {
    return [
      ...Object.keys(this.requires).map(key => this.get(key)),
      ...Object.keys(this.dependencies).map(key => this.get(key))
    ];
  }
}

module.exports = LockSpec;
