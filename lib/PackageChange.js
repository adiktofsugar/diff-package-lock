const micromatch = require("micromatch");
const colorize = require("./colorize");

class PackageChange {
  constructor(name, a, b, options = {}) {
    const { parent } = options;
    const versions = [a && a.version, b && b.version];
    Object.assign(this, {
      name,
      id: `${name}-${versions.join(",")}`,
      a,
      b,
      printed: parent ? parent.printed : {},
      parent,
      versions,
      hasChanges: versions[0] !== versions[1],
    });
  }

  getDependencyChanges() {
    const depsByName = {};
    ["a", "b"].forEach((packageKey) => {
      const pack = this[packageKey];
      if (pack) {
        const deps = pack.getDependencies();
        deps.forEach((dep) => {
          if (!depsByName[dep.name]) {
            depsByName[dep.name] = {};
          }
          depsByName[dep.name][packageKey] = dep;
        });
      }
    });
    return Object.entries(depsByName).map(
      ([name, { a, b }]) => new PackageChange(name, a, b, { parent: this })
    );
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
    return this.getDependencyChanges().filter((depChange) =>
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
    const { showPrinted, exclude } = options;
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
    let excludePatterns = [];
    if (exclude) {
      excludePatterns = exclude instanceof Array ? exclude : [exclude];
    }
    const excludeMatches = micromatch([this.name], excludePatterns);
    const isExcluded = excludeMatches.length > 0;
    if (isExcluded) {
      message = `[excluded] ${message}`;
      color = "gray";
    }
    const prefix = `${parentPrefix}${char1}`;
    console.log(`${prefix} ${colorize(color, message)}`);
    if (hasPrinted || isExcluded) {
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
