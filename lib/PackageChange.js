const chalk = require("chalk");
const _ = require("lodash");

class PackageChange {
  constructor(name, a, b, options = {}) {
    const { parent } = options;
    this.name = name;
    this.versions = [_.get(a, "version"), _.get(b, "version")];
    this.id = `${name}-${this.versions.join(",")}`;
    this.a = a;
    this.b = b;
    this.printed = parent ? parent.printed : {};
    Object.assign(this, { parent });
    this.hasChanges = false;
    if (this.versions[0] !== this.versions[1]) {
      this.hasChanges = true;
    }
  }

  getDependencyChanges() {
    const [depsA, depsB] = ["a", "b"].map(packageKey => {
      const pack = this[packageKey];
      return pack ? pack.getDependencies() : [];
    });
    const depNames = _.union(
      ...[depsA, depsB].map(deps => deps.map(d => d.name))
    );
    return depNames.map(name => {
      const a = depsA.find(p => p.name === name);
      const b = depsB.find(p => p.name === name);
      return new PackageChange(name, a, b, { parent: this });
    });
  }

  printableChangesExist(checked = {}) {
    if (checked[this.id]) {
      return false;
    }
    if (this.hasChanges) {
      return true;
    }
    // eslint-disable-next-line no-param-reassign
    checked[this.id] = true;
    if (this.getPrintableDependencyChanges(checked).length) {
      return true;
    }
    return false;
  }

  getPrintableDependencyChanges(checked = {}) {
    return this.getDependencyChanges().filter(depChange =>
      depChange.printableChangesExist(checked)
    );
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
  print(options = {}, parentPrefix = "", depth = 0, isLast = true) {
    const { showPrinted } = options;
    let char1 = "├";
    let childPrefix = "│ ";
    if (isLast) {
      char1 = "└";
      childPrefix = "  ";
    }
    const [va, vb] = this.versions;
    let message = `${this.name}`;
    let color = "white"; // this is only printed if there are dependencies
    if (!vb) {
      message = `- ${this.name}@${va}`;
      color = "red"; // removed
    } else if (!va) {
      message = `+ ${this.name}@${vb}`;
      color = "green"; // added
    } else if (va !== vb) {
      message = `${this.name}@${va} -> ${this.name}@${vb}`;
      color = "yellow"; // changed
    }
    const hasPrinted = this.printed[this.id];
    if (hasPrinted) {
      message = `${this.name} [printed]`;
      color = "gray";
      if (!showPrinted) {
        return;
      }
    }
    const prefix = `${parentPrefix}${char1}`;
    console.log(`${prefix} ${chalk[color](`${message}`)}`);
    if (hasPrinted) {
      return;
    }
    this.printed[this.id] = true;
    const depChanges = this.getPrintableDependencyChanges();
    depChanges.forEach((depChange, i) => {
      const isLastChild = i === depChanges.length - 1;
      depChange.print(
        options,
        `${parentPrefix}${childPrefix}`,
        depth + 1,
        isLastChild
      );
    });
  }
}

module.exports = PackageChange;
