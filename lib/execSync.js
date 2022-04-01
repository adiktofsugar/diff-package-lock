const cp = require("child_process");

const KB = 1024;
const MB = 1024 * KB;

module.exports = (cmd, options = {}) => {
  if (!options.maxBuffer) {
    // eslint-disable-next-line no-param-reassign
    options.maxBuffer = 100 * MB;
  }
  try {
    return cp.execSync(cmd, options);
  } catch (e) {
    return new Error(e.stderr);
  }
};
