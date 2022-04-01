const LockSpecV1 = require("./LockSpecV1");
const LockSpecV2 = require("./LockSpecV2");

module.exports = (spec) => {
  const { lockfileVersion = 1 } = spec;
  if (lockfileVersion === 1) {
    return new LockSpecV1("root", spec);
  }
  // defaulting to v2 since v3 should be compatible with v2 but not v1
  return new LockSpecV2("root", "", spec);
};
