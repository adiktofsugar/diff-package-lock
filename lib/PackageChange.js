const micromatch = require("micromatch");
const colorize = require("./colorize");

const invoke = (obj, methodName, ...args) => {
  if (obj && obj[methodName]) {
    return obj[methodName](...args);
  }
  return undefined;
};

const ensureDefault = (obj, key, defaultValue) => {
  if (!obj[key]) {
    // eslint-disable-next-line no-param-reassign
    obj[key] = defaultValue;
  }
};

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
      private: {},
    });
  }

  getDependencyChanges() {
    const depsByName = {};
    ["a", "b"].forEach((packageKey) => {
      (invoke(this[packageKey], "getDependencies") || []).forEach((dep) => {
        ensureDefault(depsByName, dep.name, {});
        depsByName[dep.name][packageKey] = dep;
      });
    });
    return Object.entries(depsByName).map(
      ([name, { a, b }]) => new PackageChange(name, a, b, { parent: this })
    );
  }

  checkHasPrintableDependencyChanges() {
    return this.getPrintableDependencyChanges().length > 0;
  }

  getPrintableDependencyChanges() {
    if (this.private.printableDependencyChanges) {
      // save so I can check if there are changes before printing
      return this.private.printableDependencyChanges;
    }
    const checkedChangeIds = [];
    const pendingChanges = this.getDependencyChanges();
    const changes = [];
    while (pendingChanges.length) {
      const pendingChange = pendingChanges.shift();
      if (pendingChange.hasChanges) {
        changes.push(pendingChange);
      } else if (!checkedChangeIds.includes(pendingChange.id)) {
        checkedChangeIds.push(pendingChange.id);
        pendingChanges.push(...pendingChange.getDependencyChanges());
      }
    }
    this.private.printableDependencyChanges = changes;
    return changes;
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
    const hasPrinted = this.printed[this.id];
    let isExcluded = false;
    if (exclude) {
      const excludePatterns = exclude instanceof Array ? exclude : [exclude];
      const excludeMatches = micromatch([this.name], excludePatterns);
      isExcluded = excludeMatches.length > 0;
    }
    const shouldPrintDependencies = !hasPrinted && !isExcluded;

    let char1 = "├";
    let childPrefix = "│ ";
    if (isLast) {
      char1 = "└";
      childPrefix = "  ";
    }
    const [va, vb] = this.versions;
    let changeString;
    let color;
    if (va === vb) {
      changeString = `${this.name}`;
      color = "white";
    } else if (!vb) {
      changeString = `- ${this.name}@${va}`;
      color = "red"; // removed
    } else if (!va) {
      changeString = `+ ${this.name}@${vb}`;
      color = "green"; // added
    } else if (va !== vb) {
      changeString = `${this.name}@${va} -> ${this.name}@${vb}`;
      color = "yellow"; // changed
    }
    if (!shouldPrintDependencies) {
      color = "gray";
    }
    const prefix = `${parentPrefix}${char1}`;
    if (hasPrinted && !showPrinted) {
      return;
    }
    let message = changeString;
    if (hasPrinted) {
      message = `[printed] ${message}`;
    }
    if (isExcluded) {
      message = `[excluded] ${message}`;
    }
    console.log(`${prefix} ${colorize(color, message)}`);
    if (!shouldPrintDependencies) {
      return;
    }
    this.printed[this.id] = true;
    this.printDependencyChanges(
      options,
      `${parentPrefix}${childPrefix}`,
      depth
    );
  }

  printDependencyChanges(options, prefix = "", depth = 0) {
    const { maxDepth } = options;
    if (maxDepth !== undefined && depth > maxDepth) {
      return;
    }
    const depChanges = this.getPrintableDependencyChanges();
    depChanges.forEach((depChange, i) => {
      const isLastChild = i === depChanges.length - 1;
      depChange.print(options, prefix, depth + 1, isLastChild);
    });
  }
}

module.exports = PackageChange;
