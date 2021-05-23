const fs = require("fs");
const path = require("path");

function walk(directory, match, filepaths = []) {
  const filenames = fs.readdirSync(directory);
  filenames.forEach(filename => {
    const filepath = path.join(directory, filename);
    if (fs.statSync(filepath).isDirectory()) {
      walk(filepath, match, filepaths);
    } else if (match(filepath)) {
      filepaths.push(filepath);
    }
  });
  return filepaths;
}
module.exports = walk;
