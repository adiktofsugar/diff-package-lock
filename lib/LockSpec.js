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
      throw new Error(`can not find dependency ${name}`);
    }
    return this.parent.get(name);
  }

  getDependencies() {
    const { requires, dependencies } = this;
    return [
      ...Object.keys(requires).map(key => this.get(key)),
      ...Object.keys(dependencies).map(key => this.get(key))
    ];
  }
}

module.exports = LockSpec;
