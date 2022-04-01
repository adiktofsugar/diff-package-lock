const mockFs = require("mock-fs");
const walkDir = require("../walkDir");

describe("walkDir", () => {
  afterEach(() => {
    mockFs.restore();
  });
  test("normal", () => {
    mockFs({
      "/root": {
        "file-a": "yeah",
        "file-b": "nope",
      },
    });
    expect(walkDir("/root", () => true)).toEqual([
      "/root/file-a",
      "/root/file-b",
    ]);
  });
});
