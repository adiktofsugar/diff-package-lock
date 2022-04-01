/* eslint-disable max-classes-per-file */
jest.mock("child_process", () => {
  const path = jest.requireActual("path");
  const real = jest.requireActual("child_process");
  const { parseArgsStringToArgv } = jest.requireActual("string-argv");
  const cp = { ...real };

  function parseArgv(argv) {
    const args = [];
    let currentArg;
    while (argv.length) {
      if (!currentArg) {
        currentArg = { positional: null, options: {} };
        args.push(currentArg);
      }
      const { options } = currentArg;
      const part = argv.shift();
      let isPositional = false;
      if (part === "--") {
        // eslint-disable-next-line no-continue
        continue;
      }
      if (
        (part.startsWith("--") || part.startsWith("-")) &&
        part.includes("=")
      ) {
        const [name, value] = part.split("=");
        options[name] = value;
      } else if (part.startsWith("--")) {
        options[part] = true;
      } else if (part.startsWith("-")) {
        const nextPart = argv.shift();
        if (nextPart && nextPart.startsWith("-")) {
          options[part] = true;
          argv.unshift(nextPart);
        } else if (nextPart) {
          options[part] = nextPart;
        } else {
          options[part] = true;
        }
      } else {
        isPositional = true;
      }
      if (isPositional) {
        currentArg.positional = part;
        currentArg = null;
      }
    }
    return args;
  }

  function normalizeOptions(givenOptions, actualOptions) {
    const options = {};
    Object.entries(actualOptions).forEach(([name, { type, alias }]) => {
      [name, alias].forEach((key) => {
        ["-", "--"].forEach((prefix) => {
          const fullKey = `${prefix}${key}`;
          if (fullKey in givenOptions) {
            if (name in options && type !== "array") {
              throw new Error(`"${name}" already set`);
            }
            const existing = options[name];
            const given = givenOptions[fullKey];
            // eslint-disable-next-line no-param-reassign
            delete givenOptions[fullKey];
            if (type === "array") {
              options[name] = (existing || []).concat([given]);
            } else if (type === "bool") {
              options[name] = Boolean(given);
            } else if (type === "number") {
              options[name] = parseInt(given, 10);
            } else {
              options[name] = given;
            }
          }
        });
      });
    });
    const remaining = Object.keys(givenOptions);
    if (remaining.length) {
      throw new Error(`Unknown options: ${remaining.join(", ")}`);
    }
    return options;
  }

  class GitCmd {
    constructor({ options, args, gitFs, cwd }) {
      Object.assign(this, {
        cwd,
        options,
        args,
        gitFs,
      });
    }

    // eslint-disable-next-line class-methods-use-this
    execute() {
      throw new Error("must implement execute");
    }
  }

  class GitLsTreeCmd extends GitCmd {
    execute() {
      const { gitFs } = this;
      const [{ positional: treeish }, ...filepathArgs] = this.args;
      const { nameOnly, recursive } = normalizeOptions(this.options, {
        nameOnly: {
          alias: "name-only",
          type: "bool",
        },
        recursive: {
          alias: "r",
          type: "bool",
        },
      });
      const items = [];
      const filepaths = filepathArgs.map(({ positional }) => positional);
      if (!filepaths.length) {
        filepaths.push(".");
      }
      while (filepaths.length) {
        const filepath = filepaths.shift();
        const item = gitFs.read(treeish, filepath);
        if (recursive && item.isTree) {
          const childNames = gitFs.readdir(treeish, filepath);
          items.push(...childNames.map((name) => path.join(filepath, name)));
        } else {
          items.push(item);
        }
      }
      return items
        .map(({ key, isTree }) => {
          if (nameOnly) {
            return key;
          }
          const mode = isTree ? "040000" : "100644";
          const type = isTree ? "tree" : "blob";
          const hash = "0000000000000000000000000000000000000001";
          return `${mode} ${type} ${hash} ${key}`;
        })
        .join("\n");
    }
  }

  class GitShowCmd extends GitCmd {
    execute() {
      const { gitFs } = this;
      const [{ positional: treeishAndFilepath }] = this.args;
      const [treeish, filepath] = treeishAndFilepath.split(":");
      const { content } = gitFs.read(treeish, filepath);
      return content;
    }
  }

  function doGitCmd(cmdString, execOptions, gitFs) {
    const { cwd } = execOptions || {};
    const argv = parseArgsStringToArgv(cmdString);
    const args = parseArgv(argv.slice(1));
    const { positional, options } = args.shift();
    let CmdClass;
    if (positional === "ls-tree") {
      CmdClass = GitLsTreeCmd;
    } else if (positional === "show") {
      CmdClass = GitShowCmd;
    }
    if (!CmdClass) {
      throw new Error(`Unsupported git command - "${positional}"`);
    }
    return new CmdClass({
      options,
      args,
      gitFs,
      cwd,
    }).execute();
  }

  class GitFs {
    constructor(treeishToFiles) {
      Object.assign(this, { treeishToFiles });
    }

    read(treeish, filepath) {
      let content = this.treeishToFiles[treeish];
      const parts = filepath.split("/");
      while (parts[0] === ".") {
        parts.shift();
      }
      if (parts[0] === "..") {
        throw new Error("No support for .. operator");
      }
      const key = parts.join("/");
      while (content && parts.length) {
        const part = parts.shift();
        content = content[part];
      }

      if (!content) {
        throw new Error(`Can not find "${key}" in "${treeish}"`);
      }

      const isBlob = typeof content === "string";
      const isTree = !isBlob;
      return {
        isBlob,
        isTree,
        key,
        content,
      };
    }

    readdir(treeish, dirpath) {
      return Object.keys(this.read(treeish, dirpath));
    }
  }

  cp.activate = (treeishToFiles) => {
    Object.keys(real).forEach((key) => {
      delete cp[key];
    });
    const gitFs = new GitFs(treeishToFiles);
    cp.execSync = (cmd, options) => {
      if (!cmd.startsWith("git")) {
        throw new Error(`Unsupported cmd: "${cmd}"`);
      }
      return doGitCmd(cmd, options, gitFs);
    };
  };
  cp.restore = () => {
    Object.keys(real).forEach((key) => {
      cp[key] = real[key];
    });
  };
  return cp;
});

const cp = require("child_process");

function mockGitRepo(treeishToFiles) {
  cp.activate(treeishToFiles);
}
mockGitRepo.restore = () => {
  cp.restore();
};

module.exports = mockGitRepo;
