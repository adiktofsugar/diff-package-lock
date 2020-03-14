const _ = require("lodash");

const MAX_DEPTH = 3;

class PackageChange {
  constructor(name, a, b, options = {}) {
    this.name = name;
    this.a = a;
    this.b = b;
    this.changes = {};
    ["version"].forEach(key => {
      this.changes[key] = [_.get(a, key), _.get(b, key)];
    });
    Object.assign(this, _.pick(options, ["isLast", "parent"]));
    this.changeString = Object.keys(this.changes)
      .map(key => {
        const [va, vb] = this.changes[key];
        if (va === vb) {
          return null;
        }
        const keyPrefix = key === "version" ? "" : `${key}:`;
        return `${keyPrefix}${va}->${vb}`;
      })
      .filter(Boolean)
      .join(",");
  }

  getDependencyChanges() {
    const [depsA, depsB] = ["a", "b"].map(packageKey => {
      const pack = this[packageKey];
      return pack ? pack.getDependencies() : [];
    });
    const depNames = _.union(
      ...[depsA, depsB].map(deps => deps.map(d => d.name))
    );
    return depNames.map((name, i) => {
      const a = depsA.find(p => p.name === name);
      const b = depsB.find(p => p.name === name);
      const isLast = depNames.length === i + 1;
      return new PackageChange(name, a, b, { parent: this, isLast });
    });
  }

  // https://pythonadventures.wordpress.com/2014/03/20/unicode-box-drawing-characters/
  // chars = {
  //     'a': '┌',
  //     'b': '┐',
  //     'c': '┘',
  //     'd': '└',
  //     'e': '─',
  //     'f': '│',
  //     'g': '┴',
  //     'h': '├',
  //     'i': '┬',
  //     'j': '┤',
  //     'k': '╷',
  //     'l': '┼',
  // }
  //
  // ┌ whatever (1->2)
  // ├ something (1->2)
  // │ └ anotherthing (1->2)
  // ├ anotherthing (1->2)
  // │ └/-/-/- anotherthing (1->2)
  // ├ anotherthing (1->2)
  // │ ├ anotherthing (1->2)
  // │ ├ anotherthing (1->2)
  // │ │ ├ anotherthing (1->2)
  // │ │ │ └ anotherthing (1->2)
  // │ │ └ anotherthing (1->2)
  // │ └ anotherthing (1->2)
  // └ last thing (1->2)
  print(parentPrefix = "", depth = 0) {
    if (depth > MAX_DEPTH) {
      return;
    }

    let char1 = "├";
    let childPrefix = "│ ";
    if (this.isLast) {
      char1 = "└";
      childPrefix = "  ";
    }
    let { parent } = this;
    let hiddenParentPrefix = "";
    while (parent && !parent.changeString.length) {
      parent = parent.parent;
      hiddenParentPrefix += "/-";
    }
    const prefix = `${parentPrefix}${char1}${hiddenParentPrefix}`;
    if (this.changeString.length) {
      console.log(`${prefix} <${this.name}> ${this.changeString}`);
    }
    const depChanges = this.getDependencyChanges();
    depChanges.forEach(depChange => {
      depChange.print(`${parentPrefix}${childPrefix}`, depth + 1);
    });
  }
}

module.exports = PackageChange;
