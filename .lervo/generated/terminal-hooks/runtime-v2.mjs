#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { connect, Socket } from "node:net";
import { homedir } from "node:os";
import { relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";

// ADR-0539 and resident-context-socket.md specify this file. Raise the version on any behavior change.
const launcherVersion = 6;
const hash = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const assetNames = [
  "native/cas-io-darwin.node",
  "native/cas-io.json",
  "native/file-sync-darwin.node",
  "native/file-sync.json",
];
const store =
  process.platform === "win32"
    ? resolve(
        process.env.LOCALAPPDATA || resolve(homedir(), "AppData/Local"),
        "Lervo/terminal-hooks",
      )
    : resolve(homedir(), ".lervo/terminal-hooks");

function privateOwner(stat) {
  if (process.platform !== "win32" && (stat.uid !== process.getuid() || stat.mode & 0o022))
    throw new Error("integrity");
}
async function trustedParents() {
  if (process.platform === "win32") return;
  const home = await realpath(homedir());
  const parent = await realpath(resolve(store, ".."));
  const within = relative(home, parent);
  if (within === ".." || within.startsWith(`..${sep}`) || within.startsWith(sep))
    throw new Error("integrity");
}
async function bytes(path, maximum) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maximum) throw new Error("integrity");
  privateOwner(stat);
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before = await file.stat();
    privateOwner(before);
    if (!before.isFile() || before.size > maximum) throw new Error("integrity");
    const buffer = Buffer.alloc(before.size + 1);
    let length = 0;
    while (length < buffer.length) {
      const result = await file.read(buffer, length, buffer.length - length, length);
      if (!result.bytesRead) break;
      length += result.bytesRead;
    }
    const value = buffer.subarray(0, length);
    const after = await file.stat();
    if (
      value.length !== before.size ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs
    )
      throw new Error("integrity");
    return value;
  } finally {
    await file.close();
  }
}
async function directory(path, requirePrivate = true) {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("integrity");
  if (requirePrivate) privateOwner(stat);
}
async function marker(repair = false) {
  const name = repair ? "repair" : "unavailable";
  const temporary = resolve(store, `.${name}-${process.pid}.tmp`);
  try {
    await trustedParents();
    await mkdir(store, { mode: 0o700 });
  } catch (error) {
    if (error.code === "ENOENT") {
      try {
        await mkdir(resolve(store, ".."), { mode: 0o700 });
        await trustedParents();
        await mkdir(store, { mode: 0o700 });
      } catch {}
    }
  }
  try {
    await trustedParents();
    await directory(store, false);
    await writeFile(
      temporary,
      JSON.stringify({
        schemaVersion: 1,
        code: repair ? "hook_runtime_repair" : "hook_runtime_unavailable",
      }) + "\n",
      { mode: 0o600, flag: "wx" },
    );
    await rename(temporary, resolve(store, `${name}.json`));
  } catch {
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}
async function locate() {
  try {
    await trustedParents();
    await directory(store);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  let pointer;
  try {
    pointer = JSON.parse(await bytes(resolve(store, "current.json"), 4096));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  if (
    pointer.schemaVersion !== 1 ||
    !/^sha256:[a-f0-9]{64}$/u.test(pointer.contentHash) ||
    !new RegExp(`^${pointer.contentHash.slice(7, 23)}(?:-repair-[a-f0-9]{16})?$`, "u").test(
      pointer.directory,
    )
  )
    throw new Error("integrity");
  const root = resolve(store, pointer.directory);
  await directory(root);
  const manifest = JSON.parse(await bytes(resolve(root, "runtime-v2.json"), 16384));
  if (
    Object.keys(manifest).sort().join(",") !==
      "assets,byteCount,contentHash,contractId,kind,runtimePath,schemaVersion" ||
    manifest.schemaVersion !== 3 ||
    manifest.kind !== "lervo_terminal_hook_runtime" ||
    manifest.contractId !== "lervo_terminal_hooks_v2" ||
    manifest.runtimePath !== ".lervo/generated/terminal-hooks/runtime-v2.mjs" ||
    manifest.contentHash !== pointer.contentHash ||
    !Array.isArray(manifest.assets) ||
    (manifest.assets.length !== 0 && manifest.assets.length !== 4)
  )
    throw new Error("integrity");
  const entry = resolve(root, "runtime-v2.mjs");
  const runtime = await bytes(entry, 64 * 1024 * 1024);
  if (
    runtime.length !== manifest.byteCount ||
    hash(runtime) !== manifest.contentHash ||
    !runtime.toString("utf8").startsWith("#!/usr/bin/env node\n")
  )
    throw new Error("integrity");
  if (manifest.assets.length) {
    await directory(resolve(root, "native"));
    if (
      (await readdir(resolve(root, "native"))).some(
        (name) => !assetNames.includes(`native/${name}`),
      )
    )
      throw new Error("integrity");
  } else {
    try {
      await lstat(resolve(root, "native"));
      throw new Error("integrity");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  for (const [index, asset] of manifest.assets.entries()) {
    if (
      Object.keys(asset).sort().join(",") !== "byteCount,contentHash,path" ||
      asset.path !== assetNames[index]
    )
      throw new Error("integrity");
    const value = await bytes(
      resolve(root, asset.path),
      asset.path.endsWith(".node") ? 1048576 : 4096,
    );
    if (value.length !== asset.byteCount || hash(value) !== asset.contentHash)
      throw new Error("integrity");
  }
  return entry;
}
function missing(error, entry) {
  return (
    error.code === "ENOENT" ||
    (entry &&
      error.code === "ERR_MODULE_NOT_FOUND" &&
      typeof error.url === "string" &&
      error.url.endsWith("/runtime-v2.mjs"))
  );
}
async function integrityFailure() {
  await marker(true);
  process.stderr.write("Lervo terminal hook runtime integrity verification failed.\n");
  process.exitCode = 2;
}
const environmentNames = [
  "CLAUDE_CONFIG_DIR",
  "CODEX_HOME",
  "HOME",
  "LERVO_USER_CAPABILITY_ROOT",
  "LERVO_USER_STATE_DIRECTORY",
  "LERVO_WORKSPACES_HOME",
  "XDG_CONFIG_HOME",
  "XDG_STATE_HOME",
];
const sessionNames = ["PATH", "XDG_RUNTIME_DIR", "DBUS_SESSION_BUS_ADDRESS"];
const servedEvents = { UserPromptSubmit: "prompt", Stop: "stop" };
function sessionEnvironment() {
  const values = Object.fromEntries(sessionNames.map((name) => [name, process.env[name] ?? null]));
  for (const [name, value] of Object.entries(process.env))
    if (/^GIT_[A-Z0-9_]{1,60}$/u.test(name) && value !== undefined) values[name] = value;
  return values;
}
async function startLaunches(launches) {
  if (!Array.isArray(launches)) return;
  await Promise.all(
    launches.slice(0, 8).map(
      (launch) =>
        new Promise((done) => {
          try {
            const child = spawn(process.execPath, [launch.entry, ...launch.args], {
              cwd: launch.cwd,
              detached: true,
              stdio: "ignore",
              env: { ...process.env, ...launch.env },
            });
            child.once("error", done);
            child.once("spawn", () => {
              child.unref();
              done();
            });
          } catch {
            done();
          }
        }),
    ),
  );
}
const relayFlag = "--lervo-launch-relay";
const relayed = (text) => {
  try {
    return JSON.parse(text.split("\n")[0]).launches ?? [];
  } catch {
    return [];
  }
};
if (process.argv[2] === relayFlag) {
  const socket = new Socket({ fd: 3 });
  let text = process.argv[3] ?? "";
  socket.on("data", (chunk) => (text += chunk));
  await new Promise((done) => {
    socket.on("close", done).on("error", done);
    setTimeout(done, 30000).unref();
  });
  await startLaunches(relayed(text));
  process.exit(0);
}
const delegatedKey = Symbol.for("lervo.terminalHook.delegated");
async function thisLauncher() {
  const self = await realpath(fileURLToPath(import.meta.url)).catch(() => null);
  const host = await realpath(resolve(store, "launcher.mjs")).catch(() => null);
  return self !== null && self === host ? "host" : "committed";
}
async function delegated() {
  if (globalThis[delegatedKey] || (await thisLauncher()) === "host") return false;
  await trustedParents();
  await directory(store);
  const host = resolve(store, "launcher.mjs");
  if ((await lstat(store)).mode & 0o077 || (await lstat(host)).mode & 0o077) return false;
  const version = /\nconst launcherVersion = (\d+);\n/u.exec(
    (await bytes(host, 64 * 1024)).toString(),
  );
  if (version === null || Number(version[1]) < launcherVersion) return false;
  globalThis[delegatedKey] = true;
  await import(pathToFileURL(await realpath(host)).href);
  return true;
}
// Why a hook was not served, for the runtime's schema-13 `delivery`.
const offer = Symbol.for("lervo.terminalHook.offer");
let input, hookInput;
async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  input = Buffer.concat(chunks);
  Object.defineProperty(process, "stdin", {
    value: Readable.from([input]),
    configurable: true,
    writable: true,
  });
  try {
    hookInput = JSON.parse(input.toString("utf8"));
  } catch {}
}
async function served() {
  globalThis[offer] = "none";
  try {
    if (!(await lstat(resolve(store, "context.s"))).isSocket()) return false;
  } catch {
    return false;
  }
  globalThis[offer] = "";
  await readInput();
  const event = hookInput?.hook_event_name;
  if (input.length > 200 * 1024 || !Object.hasOwn(servedEvents, event)) return false;
  await trustedParents();
  await directory(store);
  // Prompt text goes only to a store no one else can enter.
  if ((await lstat(store)).mode & 0o077) return false;
  const pointer = JSON.parse(await bytes(resolve(store, "current.json"), 4096));
  if (!/^sha256:[a-f0-9]{64}$/u.test(pointer.contentHash)) return false;
  const request = JSON.stringify({
    version: 1,
    kind: servedEvents[event],
    runtime: pointer.contentHash,
    cwd: await realpath(process.cwd()),
    args: process.argv.slice(2),
    environment: Object.fromEntries(
      environmentNames.map((name) => [name, process.env[name] ?? null]),
    ),
    elapsed: performance.now(),
    input: input.toString("utf8"),
    launcher: await thisLauncher(),
    session: sessionEnvironment(),
    umask: process.umask(),
    relay: true,
  });
  return new Promise((done) => {
    const socket = connect(resolve(store, "context.s"));
    let state = "connecting";
    let received = Buffer.alloc(0);
    const finish = (value, why = state) => {
      clearTimeout(timer);
      if (value === false) {
        socket.destroy();
        globalThis[offer] ||= `${why}`;
      }
      done(value);
    };
    let timer = setTimeout(() => finish(false), 150);
    const lost = () =>
      state === "answered" ? undefined : finish(state === "committed" ? {} : false);
    socket.on("error", lost);
    socket.on("connect", () => {
      state = "sent";
      clearTimeout(timer);
      timer = setTimeout(() => finish(false), 500);
      socket.write(`${request}\n`);
    });
    socket.on("data", (chunk) => {
      if (state === "sent") {
        if (chunk[0] !== 0x41 /* A */) return finish(false, chunk);
        state = "committed";
        clearTimeout(timer);
        timer = setTimeout(() => finish({}), 25000);
        socket.write("G");
        chunk = chunk.subarray(1);
      }
      if (state !== "committed") return;
      received = Buffer.concat([received, chunk]);
      const end = received.indexOf(0x0a);
      if (end === -1) return;
      let answer;
      try {
        answer = JSON.parse(received.subarray(0, end).toString("utf8"));
      } catch {
        return finish({});
      }
      if (answer.ok !== true) return finish({});
      state = "answered";
      clearTimeout(timer);
      const later = received.subarray(end + 1).toString();
      if (answer.pending === true && !later.includes("\n")) {
        // A detached relay keeps the connection and starts the records' launches.
        try {
          spawn(process.execPath, [fileURLToPath(import.meta.url), relayFlag, later], {
            detached: true,
            stdio: ["ignore", "ignore", "ignore", socket],
          })
            .on("error", () => undefined)
            .unref();
        } catch {}
        socket.destroy();
      } else if (answer.pending === true) answer.launches.push(...relayed(later));
      void startLaunches(answer.launches).finally(() => finish(answer));
    });
    socket.on("close", lost);
  });
}
// ADR-0645: a prompt the server could not take gets the server's cached base.
async function cached() {
  const why = `${globalThis[offer]}`;
  const reason =
    why === "none"
      ? "no_server"
      : why === "connecting" || why === "sent"
        ? "unreachable"
        : why.startsWith('{"declined":"busy"}')
          ? "declined_busy"
          : null;
  if (reason === null) return null;
  const base = resolve(store, "base");
  await trustedParents();
  await directory(base);
  const at = (name) => resolve(base, hash(name).slice(7, 23));
  const named = JSON.stringify(environmentNames.map((name) => process.env[name] ?? null));
  const file = at([await realpath(process.cwd()), ...process.argv.slice(2), named].join("\0"));
  const found = await lstat(`${file}.json`);
  const age = Math.round(Date.now() - found.mtimeMs);
  if (found.mode & 0o077 || !(age > -1e3 && age < 18e5)) return null;
  if (input === undefined) await readInput();
  if (hookInput?.hook_event_name !== "UserPromptSubmit") return null;
  const answer = await bytes(`${file}.json`, 65536);
  // The marker the server records; the session's tells its Stop this turn prepared nothing.
  const leave = (path, text) => writeFile(path, text, { mode: 0o600 }).catch(() => undefined);
  await leave(
    `${file}.${Date.now()}.${process.pid}.unserved`,
    JSON.stringify({ reason, age: Math.max(age, 0) }),
  );
  const session = hookInput.session_id;
  if (typeof session === "string") await leave(`${at(session)}.turn`, "");
  return answer;
}
if (
  process.env.LERVO_TERMINAL_HOOK_DELEGATION === "0" ||
  process.platform === "win32" ||
  !(await delegated().catch(() => false))
) {
  if (process.platform !== "win32" && process.env.LERVO_TERMINAL_CONTEXT_SOCKET !== "0") {
    const answer = await served().catch(() => false);
    const base = answer === false && (await cached().catch(() => null));
    if (answer !== false || base) {
      process.stderr.write(answer.stderr ?? "");
      process.stdout.write(base || (answer.stdout ?? "{}\n"), () =>
        process.exit(answer.exitCode ?? 0),
      );
      await new Promise(() => undefined);
    }
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    let entry;
    try {
      entry = await locate();
    } catch (error) {
      if (missing(error)) {
        if (attempt === 0) continue;
        await marker();
      } else {
        await integrityFailure();
      }
      break;
    }
    if (entry === null) {
      await marker();
      break;
    }
    try {
      // Same process and argv; Node resolves symlinks for `import.meta.url`, so name the real path.
      const real = await realpath(entry);
      process.env.LERVO_TERMINAL_HOOK_RUNTIME = real;
      globalThis[Symbol.for("lervo.terminalHook.verifiedEntry")] = real;
      await import(pathToFileURL(real).href);
      break;
    } catch (error) {
      delete globalThis[Symbol.for("lervo.terminalHook.verifiedEntry")];
      if (!missing(error, entry)) throw error;
      if (attempt === 0) continue;
      await marker();
    }
  }
}
