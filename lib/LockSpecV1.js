class LockSpecV1 {
  constructor(name, spec, parent = null) {
    const { version, requires = {}, dependencies = {} } = spec;
    Object.assign(this, {
      name,
      version,
      requires,
      dependencies,
      parent,
    });
  }

  get(name) {
    const spec = this.dependencies[name];
    if (spec) {
      return new LockSpecV1(name, spec, this);
    }
    if (!this.parent) {
      // this isn't necessarily an error (though it normally is)
      //  for a lerna repo, the local packages aren't in the package-lock.json
      // const error = new Error(`can not find dependency ${name}`);
      // error.code = "NOT_FOUND";
      // throw error;
      return new LockSpecV1(
        name,
        {
          version: "unknown",
        },
        this
      );
    }
    return this.parent.get(name);
  }

  getDependencies() {
    return [
      ...Object.keys(this.requires).map((key) => this.get(key)),
      ...Object.keys(this.dependencies).map((key) => this.get(key)),
    ];
  }
}

module.exports = LockSpecV1;
