#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const util = require("util");

const TEST_ROOT = path.resolve(__dirname, "lib");
const TEST_TIMEOUT_MS = 5000;
const PROJECT_ROOT = path.resolve(__dirname, "..");

let rootSuite = null;
let currentSuite = null;
let allTests = null;

async function main() {
  const files = collectTestFiles(TEST_ROOT);
  if (!files.length) {
    console.log("No tests found.");
    process.exit(0);
  }

  const aggregate = [];
  for (const file of files) {
    resetTestRegistry();
    clearProjectRequireCache();
    require(file);
    await runSuite(rootSuite);
    aggregate.push(...allTests);
  }

  printSummary(aggregate);
  if (aggregate.some((t) => t.status === "failed")) {
    process.exitCode = 1;
  }
  process.exit(process.exitCode || 0);
}

function createSuite(name, parent) {
  return {
    name,
    parent,
    children: [],
    tests: [],
    beforeEach: [],
    afterEach: [],
    beforeAll: [],
    afterAll: [],
    beforeAllRan: false,
    afterAllRan: false,
  };
}

function registerTest(name, fn) {
  const record = {
    name,
    fn,
    suite: currentSuite,
    status: "pending",
    error: null,
    durationMs: 0,
  };
  currentSuite.tests.push(record);
  allTests.push(record);
}

function resetTestRegistry() {
  rootSuite = createSuite("(root)", null);
  currentSuite = rootSuite;
  allTests = [];
  installGlobals();
}

function installGlobals() {
  global.describe = (name, fn) => {
    const parent = currentSuite;
    const suite = createSuite(name, parent);
    parent.children.push(suite);
    currentSuite = suite;
    try {
      fn();
    } finally {
      currentSuite = parent;
    }
  };

  global.test = (name, fn) => registerTest(name, fn);
  global.it = global.test;
  global.beforeEach = (fn) => currentSuite.beforeEach.push(fn);
  global.afterEach = (fn) => currentSuite.afterEach.push(fn);
  global.beforeAll = (fn) => currentSuite.beforeAll.push(fn);
  global.afterAll = (fn) => currentSuite.afterAll.push(fn);
  global.expect = createExpect;
  global.jest = { fn: createMockFn };
}

function collectTestFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".test.js")) {
      files.push(full);
    }
  }
  files.sort();
  return files;
}

function clearProjectRequireCache() {
  for (const cachePath of Object.keys(require.cache)) {
    const normalized = path.resolve(cachePath);
    if (!normalized.startsWith(PROJECT_ROOT)) continue;
    if (normalized === __filename) continue;
    delete require.cache[cachePath];
  }
}

async function runSuite(suite) {
  if (!suite.beforeAllRan) {
    suite.beforeAllRan = true;
    for (const hook of suite.beforeAll) {
      await runMaybeAsync(hook);
    }
  }

  for (const testRecord of suite.tests) {
    await runTest(testRecord);
  }

  for (const child of suite.children) {
    await runSuite(child);
  }

  if (!suite.afterAllRan) {
    suite.afterAllRan = true;
    for (const hook of suite.afterAll) {
      await runMaybeAsync(hook);
    }
  }
}

function getSuiteChain(suite) {
  const chain = [];
  let cursor = suite;
  while (cursor && cursor.parent) {
    chain.unshift(cursor);
    cursor = cursor.parent;
  }
  return chain;
}

async function runTest(testRecord) {
  const startedAt = Date.now();
  const chain = getSuiteChain(testRecord.suite);
  const beforeEachHooks = [];
  const afterEachHooks = [];

  for (const suite of chain) {
    beforeEachHooks.push(...suite.beforeEach);
  }
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    afterEachHooks.push(...chain[i].afterEach);
  }

  try {
    for (const hook of beforeEachHooks) {
      await runMaybeAsync(hook);
    }
    await runMaybeAsync(testRecord.fn);
    testRecord.status = "passed";
    console.log(`PASS ${formatTestName(testRecord)}`);
  } catch (err) {
    testRecord.status = "failed";
    testRecord.error = err;
    process.exitCode = 1;
    console.error(`FAIL ${formatTestName(testRecord)}`);
    console.error(formatError(err));
  } finally {
    for (const hook of afterEachHooks) {
      try {
        await runMaybeAsync(hook);
      } catch (hookErr) {
        testRecord.status = "failed";
        testRecord.error = testRecord.error || hookErr;
        process.exitCode = 1;
        console.error(`FAIL ${formatTestName(testRecord)} (afterEach)`);
        console.error(formatError(hookErr));
      }
    }
    testRecord.durationMs = Date.now() - startedAt;
  }
}

async function runMaybeAsync(fn) {
  if (typeof fn !== "function") return;
  await Promise.race([
    Promise.resolve().then(() => fn()),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Test timed out after ${TEST_TIMEOUT_MS}ms`)), TEST_TIMEOUT_MS);
    }),
  ]);
}

function createExpect(received) {
  return createMatchers(received, false);
}

function createMatchers(received, inverted) {
  const assert = (pass, defaultMessage) => {
    const ok = inverted ? !pass : pass;
    if (!ok) {
      throw new Error(defaultMessage);
    }
  };

  const matchers = {
    get not() {
      return createMatchers(received, !inverted);
    },

    toBe(expected) {
      assert(
        Object.is(received, expected),
        `Expected ${pretty(received)} ${inverted ? "not " : ""}to be ${pretty(expected)}`
      );
    },

    toEqual(expected) {
      assert(
        util.isDeepStrictEqual(received, expected),
        `Expected ${pretty(received)} ${inverted ? "not " : ""}to equal ${pretty(expected)}`
      );
    },

    toStrictEqual(expected) {
      matchers.toEqual(expected);
    },

    toMatch(expected) {
      let pass = false;
      if (expected instanceof RegExp) {
        pass = expected.test(String(received));
      } else if (typeof expected === "string") {
        pass = String(received).includes(expected);
      }
      assert(pass, `Expected ${pretty(received)} ${inverted ? "not " : ""}to match ${pretty(expected)}`);
    },

    toMatchObject(expected) {
      const pass = isMatchObject(received, expected);
      assert(
        pass,
        `Expected ${pretty(received)} ${inverted ? "not " : ""}to match object ${pretty(expected)}`
      );
    },

    toContain(expected) {
      let pass = false;
      if (typeof received === "string") pass = received.includes(expected);
      else if (Array.isArray(received)) pass = received.includes(expected);
      assert(pass, `Expected ${pretty(received)} ${inverted ? "not " : ""}to contain ${pretty(expected)}`);
    },

    toContainEqual(expected) {
      const pass = Array.isArray(received) && received.some((x) => util.isDeepStrictEqual(x, expected));
      assert(
        pass,
        `Expected ${pretty(received)} ${inverted ? "not " : ""}to contain equal ${pretty(expected)}`
      );
    },

    toHaveLength(expected) {
      const length = received == null ? undefined : received.length;
      assert(
        typeof length === "number" && length === expected,
        `Expected ${pretty(received)} ${inverted ? "not " : ""}to have length ${expected}`
      );
    },

    toBeCloseTo(expected, precision = 2) {
      const epsilon = Math.pow(10, -precision) / 2;
      const pass = Math.abs(Number(received) - Number(expected)) < epsilon;
      assert(
        pass,
        `Expected ${pretty(received)} ${inverted ? "not " : ""}to be close to ${pretty(expected)}`
      );
    },

    toBeDefined() {
      assert(received !== undefined, `Expected value ${inverted ? "not " : ""}to be defined`);
    },

    toBeUndefined() {
      assert(received === undefined, `Expected ${pretty(received)} ${inverted ? "not " : ""}to be undefined`);
    },

    toBeNull() {
      assert(received === null, `Expected ${pretty(received)} ${inverted ? "not " : ""}to be null`);
    },

    toBeTruthy() {
      assert(Boolean(received), `Expected ${pretty(received)} ${inverted ? "not " : ""}to be truthy`);
    },

    toBeFalsy() {
      assert(!received, `Expected ${pretty(received)} ${inverted ? "not " : ""}to be falsy`);
    },

    toBeNaN() {
      assert(Number.isNaN(received), `Expected ${pretty(received)} ${inverted ? "not " : ""}to be NaN`);
    },

    toBeGreaterThan(expected) {
      assert(received > expected, `Expected ${pretty(received)} ${inverted ? "not " : ""}to be > ${expected}`);
    },

    toBeGreaterThanOrEqual(expected) {
      assert(
        received >= expected,
        `Expected ${pretty(received)} ${inverted ? "not " : ""}to be >= ${expected}`
      );
    },

    toBeLessThan(expected) {
      assert(received < expected, `Expected ${pretty(received)} ${inverted ? "not " : ""}to be < ${expected}`);
    },

    toBeLessThanOrEqual(expected) {
      assert(
        received <= expected,
        `Expected ${pretty(received)} ${inverted ? "not " : ""}to be <= ${expected}`
      );
    },

    toBeInstanceOf(klass) {
      assert(
        received instanceof klass,
        `Expected ${pretty(received)} ${inverted ? "not " : ""}to be instance of ${klass && klass.name}`
      );
    },

    toHaveProperty(propertyPath, expectedValue) {
      const info = getProperty(received, propertyPath);
      let pass = info.has;
      if (pass && arguments.length >= 2) {
        pass = util.isDeepStrictEqual(info.value, expectedValue);
      }
      assert(
        pass,
        `Expected ${pretty(received)} ${inverted ? "not " : ""}to have property ${pretty(propertyPath)}`
      );
    },

    toHaveBeenCalled() {
      const pass = Boolean(received && received.mock && Array.isArray(received.mock.calls) && received.mock.calls.length > 0);
      assert(pass, `Expected mock ${inverted ? "not " : ""}to have been called`);
    },

    toHaveBeenCalledTimes(expected) {
      const calls = received && received.mock && Array.isArray(received.mock.calls) ? received.mock.calls.length : 0;
      assert(calls === expected, `Expected mock ${inverted ? "not " : ""}to be called ${expected} times, got ${calls}`);
    },

    toThrow(expected) {
      if (typeof received !== "function") {
        throw new Error("toThrow() expects a function");
      }
      let threw = false;
      let err;
      try {
        received();
      } catch (e) {
        threw = true;
        err = e;
      }
      if (!expected) {
        assert(threw, `Expected function ${inverted ? "not " : ""}to throw`);
        return;
      }
      let pass = false;
      if (threw) {
        if (expected instanceof RegExp) pass = expected.test(String(err && err.message));
        else if (typeof expected === "string") pass = String(err && err.message).includes(expected);
        else if (typeof expected === "function") pass = err instanceof expected;
      }
      assert(pass, `Expected thrown error ${inverted ? "not " : ""}to match ${pretty(expected)}`);
    },
  };

  return matchers;
}

function isMatchObject(received, expected) {
  if (expected === null || typeof expected !== "object") {
    return util.isDeepStrictEqual(received, expected);
  }
  if (received === null || typeof received !== "object") {
    return false;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(received) || received.length < expected.length) return false;
    for (let i = 0; i < expected.length; i += 1) {
      if (!isMatchObject(received[i], expected[i])) return false;
    }
    return true;
  }
  for (const [key, value] of Object.entries(expected)) {
    if (!Object.prototype.hasOwnProperty.call(received, key)) return false;
    if (!isMatchObject(received[key], value)) return false;
  }
  return true;
}

function getProperty(obj, propertyPath) {
  const parts = Array.isArray(propertyPath) ? propertyPath : String(propertyPath).split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null || !Object.prototype.hasOwnProperty.call(current, part)) {
      return { has: false, value: undefined };
    }
    current = current[part];
  }
  return { has: true, value: current };
}

function createMockFn(implementation) {
  let impl = typeof implementation === "function" ? implementation : () => undefined;
  const mockFn = function (...args) {
    mockFn.mock.calls.push(args);
    mockFn.mock.instances.push(this);
    try {
      const value = impl.apply(this, args);
      mockFn.mock.results.push({ type: "return", value });
      return value;
    } catch (err) {
      mockFn.mock.results.push({ type: "throw", value: err });
      throw err;
    }
  };

  mockFn.mock = {
    calls: [],
    instances: [],
    results: [],
  };
  mockFn.mockImplementation = (nextImpl) => {
    impl = nextImpl;
    return mockFn;
  };
  mockFn.mockReturnValue = (value) => {
    impl = () => value;
    return mockFn;
  };
  mockFn.mockResolvedValue = (value) => {
    impl = () => Promise.resolve(value);
    return mockFn;
  };
  mockFn.mockRejectedValue = (err) => {
    impl = () => Promise.reject(err);
    return mockFn;
  };
  mockFn.mockClear = () => {
    mockFn.mock.calls = [];
    mockFn.mock.instances = [];
    mockFn.mock.results = [];
    return mockFn;
  };

  return mockFn;
}

function formatTestName(record) {
  const chain = getSuiteChain(record.suite).map((suite) => suite.name);
  return `${chain.join(" > ")} > ${record.name}`;
}

function formatError(err) {
  if (!err) return "Unknown error";
  return err && err.stack ? err.stack : String(err);
}

function pretty(value) {
  return util.inspect(value, { depth: 6, colors: false, breakLength: 120 });
}

function printSummary(results) {
  const total = results.length;
  const passed = results.filter((t) => t.status === "passed").length;
  const failed = results.filter((t) => t.status === "failed").length;
  const durationMs = results.reduce((sum, t) => sum + t.durationMs, 0);

  console.log("");
  console.log(`Tests: ${passed} passed, ${failed} failed, ${total} total`);
  console.log(`Time: ${durationMs}ms`);
}

main().catch((err) => {
  process.exitCode = 1;
  console.error("Fatal test runner error");
  console.error(formatError(err));
});
