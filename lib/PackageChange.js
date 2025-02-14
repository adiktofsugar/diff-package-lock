const colorize = require("./colorize");

class PackageChange {
  /**
   *
   * @param {import('./PackageDescriptor')} a
   * @param {import('./PackageDescriptor')} b
   */
  constructor(a, b) {
    this.a = a;
    this.b = b;
    this.isAdded = !a && b;
    this.isRemoved = a && !b;
    this.keysAreEqual = a && b && a.key === b.key;
    this.versionsAreEqual = a && b && a.version === b.version;
    this.namesAreEqual = a && b && a.name === b.name;
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
  print({ last, first }) {
    let char = "├";
    if (last) {
      char = "└";
    } else if (first) {
      char = "┌";
    }
    const [va, vb] = this.versions;
    let changeString;
    let color;
    if (va === vb) {
      changeString = `${this.key}`;
      color = "white";
    } else if (!vb) {
      changeString = `- ${this.key}@${va}`;
      color = "red"; // removed
    } else if (!va) {
      changeString = `+ ${this.key}@${vb}`;
      color = "green"; // added
    } else if (va !== vb) {
      changeString = `${this.key}@${va} -> ${this.key}@${vb}`;
      color = "yellow"; // changed
    }
    console.log(`${char} ${colorize(color, changeString)}`);
  }
}

module.exports = PackageChange;
