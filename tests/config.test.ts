import assert from "node:assert/strict";
import { test } from "node:test";

import { loadConfig } from "../src/config.ts";

test("トークンなしの既定値はfixtureになる", () => {
  const config = loadConfig({ GITHUB_USERNAME: "renkonmaster" });

  assert.deepEqual(config, {
    dataSource: "fixture",
    username: "renkonmaster",
    token: undefined,
    outputDir: "generated",
  });
});

test("githubモードはトークンなしで失敗する", () => {
  assert.throws(
    () => loadConfig({ DATA_SOURCE: "github", GITHUB_USERNAME: "renkonmaster" }),
    /GITHUB_TOKEN/,
  );
});

test("fixtureモードではトークンを使わない", () => {
  const config = loadConfig({
    DATA_SOURCE: "fixture",
    GITHUB_USERNAME: "renkonmaster",
    GITHUB_TOKEN: "should-not-be-used",
  });

  assert.equal(config.dataSource, "fixture");
  assert.equal(config.token, undefined);
});
