// safeJsonLoader.ts

import fs from "fs/promises";
import path from "path";
import fetch, { Response } from "node-fetch";

import {
  JsonValue,
  LoadedJsonFile,
  ResolvedSafeJsonLoaderOptions,
  SafeJsonLoaderOptions,
  JsonLoadInput,
} from "./types.js";
import { mergeOptions, logWith } from "./logger.js";

/* -------------------------------------------------------------------------- */
/*  ERROR TYPE                                                                */
/* -------------------------------------------------------------------------- */

export class JsonLoaderError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "JsonLoaderError";
    this.code = code;
  }
}

/* -------------------------------------------------------------------------- */
/*  HELPERS                                                                   */
/* -------------------------------------------------------------------------- */

function isHttpUrl(str: string): boolean {
  return /^https?:\/\//i.test(str);
}

function isJsonFile(file: string) {
  return path.extname(file).toLowerCase() === ".json";
}

function ensureStringInput(input: JsonLoadInput): string {
  if (typeof input === "string") return input;
  if ((input as any).href) return String(input);
  return String(input);
}

// Minimal concurrency limiter to avoid external deps.
function createLimiter(maxConcurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    active--;
    if (queue.length > 0) {
      const fn = queue.shift()!;
      fn();
    }
  };

  const run = <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const execute = () => {
        active++;
        task()
          .then((result) => {
            next();
            resolve(result);
          })
          .catch((err) => {
            next();
            reject(err);
          });
      };

      if (active < maxConcurrency) {
        execute();
      } else {
        queue.push(execute);
      }
    });

  return run;
}

/* -------------------------------------------------------------------------- */
/*  SECURITY: PROTOTYPE POLLUTION SANITIZER                                   */
/* -------------------------------------------------------------------------- */

const POLLUTION_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Deeply clones and strips dangerous keys to mitigate prototype pollution.
 * Uses Object.create(null) to avoid inheriting from Object.prototype.
 */
export function sanitizePrototypePollution<T extends JsonValue>(
  input: T,
  options?: { maxDepth?: number }
): T {
  const maxDepth = options?.maxDepth ?? 1_000; // extremely high default, actual limit enforced separately
  return deepSanitize(input, 0, maxDepth) as T;
}

function deepSanitize(value: any, depth: number, maxDepth: number): any {
  if (depth > maxDepth) {
    // Hard stop; caller should usually enforce a much smaller depth via options.maxJsonDepth.
    throw new JsonLoaderError(
      `Maximum JSON depth exceeded during sanitation (depth > ${maxDepth}).`,
      "JSON_DEPTH_SANITATION_LIMIT"
    );
  }

  if (Array.isArray(value)) {
    const out: any[] = new Array(value.length);
    for (let i = 0; i < value.length; i++) {
      out[i] = deepSanitize(value[i], depth + 1, maxDepth);
    }
    return out;
  }

  if (value && typeof value === "object") {
    const out: Record<string, JsonValue> = Object.create(null);
    for (const key of Object.keys(value)) {
      if (POLLUTION_KEYS.has(key)) {
        continue;
      }
      out[key] = deepSanitize((value as any)[key], depth + 1, maxDepth);
    }
    return out;
  }

  return value;
}

/**
 * Computes maximum depth of a JSON value.
 */
function calculateDepth(value: JsonValue, currentDepth = 0): number {
  if (value === null) return currentDepth;

  if (Array.isArray(value)) {
    let max = currentDepth;
    for (const item of value) {
      const depth = calculateDepth(item as JsonValue, currentDepth + 1);
      if (depth > max) max = depth;
    }
    return max;
  }

  if (typeof value === "object") {
    let max = currentDepth;
    for (const key of Object.keys(value as any)) {
      const depth = calculateDepth(
        (value as any)[key] as JsonValue,
        currentDepth + 1
      );
      if (depth > max) max = depth;
    }
    return max;
  }

  return currentDepth;
}

/* -------------------------------------------------------------------------- */
/*  REMOTE JSON LOADING                                                       */
/* -------------------------------------------------------------------------- */

async function fetchWithTimeout(
  url: string,
  opts: ResolvedSafeJsonLoaderOptions
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), opts.httpTimeoutMs);

  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw new JsonLoaderError(
      `Failed to fetch remote JSON at ${url}: ${err?.message ?? String(err)}`,
      "REMOTE_FETCH_ERROR"
    );
  }
}

function assertJsonContentType(
  url: string,
  res: Response,
  opts: ResolvedSafeJsonLoaderOptions
): void {
  const ct = res.headers.get("content-type") ?? "";
  const lc = ct.toLowerCase();

  const isJson = opts.looseJsonContentType
    ? lc.includes("json")
    : lc.startsWith("application/json");

  if (!isJson) {
    throw new JsonLoaderError(
      `Remote URL does not advertise JSON content-type at ${url}: '${ct}'`,
      "REMOTE_CONTENT_TYPE_ERROR"
    );
  }
}

async function loadRemoteJson(
  url: string,
  opts: ResolvedSafeJsonLoaderOptions
): Promise<JsonValue> {
  const res = await fetchWithTimeout(url, opts);

  if (!res.ok) {
    throw new JsonLoaderError(
      `Remote fetch failed at ${url}: ${res.status} ${res.statusText}`,
      "REMOTE_FETCH_STATUS_ERROR"
    );
  }

  assertJsonContentType(url, res, opts);

  const raw = (await res.json()) as JsonValue;
  const sanitized = sanitizePrototypePollution(raw, {
    maxDepth: opts.maxJsonDepth,
  });

  return sanitized;
}

async function loadRemoteIndex(
  indexUrl: string,
  indexJson: JsonValue,
  opts: ResolvedSafeJsonLoaderOptions,
  limitRun: <T>(fn: () => Promise<T>) => Promise<T>
): Promise<LoadedJsonFile[]> {
  let fileList: unknown;

  if (Array.isArray(indexJson)) {
    fileList = indexJson;
  } else if (
    indexJson &&
    typeof indexJson === "object" &&
    Array.isArray((indexJson as any).files)
  ) {
    fileList = (indexJson as any).files;
  }

  if (!Array.isArray(fileList)) {
    throw new JsonLoaderError(
      `Remote directory index ${indexUrl} must return an array or { files: [] }.`,
      "REMOTE_INDEX_FORMAT_ERROR"
    );
  }

  const urls = (fileList as unknown[]).filter(
    (item) => typeof item === "string"
  ) as string[];

  if (urls.length === 0) {
    return [];
  }

  if (urls.length > opts.maxFiles) {
    throw new JsonLoaderError(
      `Remote directory index at ${indexUrl} lists ${urls.length} files, exceeding maxFiles=${opts.maxFiles}.`,
      "REMOTE_INDEX_LIMIT_ERROR"
    );
  }

  logWith(opts, "debug", "Loading remote index", {
    indexUrl,
    fileCount: urls.length,
  });

  const tasks = urls.map((fileUrl) =>
    limitRun(async () => {
      if (!isHttpUrl(fileUrl)) {
        throw new JsonLoaderError(
          `Invalid remote file URL in index at ${indexUrl}: ${fileUrl}`,
          "REMOTE_INDEX_URL_ERROR"
        );
      }

      const data = await loadRemoteJson(fileUrl, opts);
      const file: LoadedJsonFile = Object.freeze({
        name: path.basename(new URL(fileUrl).pathname),
        data,
        __source: fileUrl,
      });

      opts.onFileLoaded(file);
      logWith(opts, "info", "Remote JSON file loaded", {
        url: fileUrl,
      });

      return file;
    })
  );

  return Promise.all(tasks);
}

/* -------------------------------------------------------------------------- */
/*  LOCAL FILE JSON LOADER                                                    */
/* -------------------------------------------------------------------------- */

async function loadLocalJsonFile(
  filePath: string,
  opts: ResolvedSafeJsonLoaderOptions
): Promise<LoadedJsonFile> {
  const stats = await fs.stat(filePath);

  if (stats.size > opts.maxFileBytes) {
    opts.onFileSkipped({
      source: filePath,
      reason: `File exceeds maxFileBytes=${opts.maxFileBytes}`,
    });
    logWith(opts, "warn", "Skipping local file due to size limit", {
      filePath,
      size: stats.size,
      maxFileBytes: opts.maxFileBytes,
    });

    throw new JsonLoaderError(
      `Local file too large: ${filePath} (${stats.size} bytes > ${opts.maxFileBytes}).`,
      "LOCAL_FILE_SIZE_ERROR"
    );
  }

  const content = await fs.readFile(filePath, "utf8");

  let raw: any;
  try {
    raw = JSON.parse(content) as JsonValue;
  } catch (err: any) {
    throw new JsonLoaderError(
      `Invalid JSON in file ${filePath}: ${err?.message ?? String(err)}`,
      "LOCAL_JSON_PARSE_ERROR"
    );
  }

  const sanitized = sanitizePrototypePollution(raw, {
    maxDepth: opts.maxJsonDepth,
  });

  const depth = calculateDepth(sanitized);
  if (depth > opts.maxJsonDepth) {
    throw new JsonLoaderError(
      `Local JSON in ${filePath} exceeds maxJsonDepth=${opts.maxJsonDepth} (depth=${depth}).`,
      "LOCAL_JSON_DEPTH_ERROR"
    );
  }

  const file: LoadedJsonFile = Object.freeze({
    name: path.basename(filePath),
    data: sanitized,
    __source: filePath,
  });

  opts.onFileLoaded(file);
  logWith(opts, "info", "Local JSON file loaded", { filePath });

  return file;
}

async function loadLocalDirectory(
  dirPath: string,
  opts: ResolvedSafeJsonLoaderOptions,
  limitRun: <T>(fn: () => Promise<T>) => Promise<T>
): Promise<LoadedJsonFile[]> {
  const files = await fs.readdir(dirPath);
  const jsonFiles = files.filter(isJsonFile);

  if (jsonFiles.length === 0) {
    logWith(opts, "debug", "No JSON files found in directory", { dirPath });
    return [];
  }

  if (jsonFiles.length > opts.maxFiles) {
    throw new JsonLoaderError(
      `Directory ${dirPath} contains ${jsonFiles.length} JSON files, exceeding maxFiles=${opts.maxFiles}.`,
      "LOCAL_DIR_LIMIT_ERROR"
    );
  }

  // Enforce total size limit
  let totalSize = 0;
  const filePaths: string[] = [];

  for (const file of jsonFiles) {
    const full = path.join(dirPath, file);
    const stats = await fs.stat(full);
    totalSize += stats.size;
    if (totalSize > opts.maxTotalBytes) {
      throw new JsonLoaderError(
        `Total size of JSON files in ${dirPath} exceeds maxTotalBytes=${opts.maxTotalBytes}.`,
        "LOCAL_DIR_TOTAL_SIZE_ERROR"
      );
    }
    filePaths.push(full);
  }

  logWith(opts, "debug", "Loading local directory", {
    dirPath,
    fileCount: filePaths.length,
    totalSize,
  });

  const tasks = filePaths.map((filePath) =>
    limitRun(() => loadLocalJsonFile(filePath, opts))
  );

  return Promise.all(tasks);
}

/* -------------------------------------------------------------------------- */
/*  PUBLIC API: SAFE JSON LOADER                                              */
/* -------------------------------------------------------------------------- */

/**
 * Load one or more JSON resources from:
 *  - Local file (.json)
 *  - Local directory (all .json files)
 *  - Remote URL returning JSON (object/array)
 *  - Remote URL acting as an index of JSON URLs (array or { files: [] })
 *
 * Security features:
 *  - Prototype‑pollution‑safe deep clone (strips __proto__, constructor, prototype)
 *  - Max depth for parsed JSON structures
 *  - Max file size and total directory size
 *  - Concurrency limit for I/O (local and remote)
 *  - HTTP timeout and content‑type checks
 *
 * This function does not enforce any domain/schema validation — callers
 * should layer their own validation on top of the loaded `data`.
 */
export async function loadSafeJsonResources(
  input: JsonLoadInput,
  options?: SafeJsonLoaderOptions
): Promise<LoadedJsonFile[]> {
  const inputStr = ensureStringInput(input);

  if (!inputStr) {
    throw new JsonLoaderError(
      "Input path/URL must be a non-empty string.",
      "INPUT_VALIDATION_ERROR"
    );
  }

  const opts = mergeOptions(options);
  const limitRun = createLimiter(opts.maxConcurrency);

  /* ---------------------------------- REMOTE --------------------------------- */

if (isHttpUrl(inputStr)) {
  const json = await loadRemoteJson(inputStr, opts);

  if (
    Array.isArray(json) ||
    (json &&
      typeof json === "object" &&
      Array.isArray((json as any).files))
  ) {
    return loadRemoteIndex(inputStr, json, opts, limitRun);
  }

  const file: LoadedJsonFile = Object.freeze({
    name: new URL(inputStr).pathname,
    data: json,
    __source: inputStr,
  });

  opts.onFileLoaded(file);
  logWith(opts, "info", "Remote JSON file loaded", { url: inputStr });

  return [file];
  }

  /* ----------------------------------- LOCAL ---------------------------------- */

  const resolved = path.resolve(inputStr);

  let stats;
  try {
    stats = await fs.stat(resolved);
  } catch {
    throw new JsonLoaderError(
      `Local path does not exist: ${resolved}`,
      "LOCAL_PATH_NOT_FOUND"
    );
  }

  if (stats.isFile()) {
    if (!isJsonFile(resolved)) {
      throw new JsonLoaderError(
        `File is not a .json file: ${resolved}`,
        "LOCAL_FILE_EXTENSION_ERROR"
      );
    }
    return [await loadLocalJsonFile(resolved, opts)];
  }

  if (stats.isDirectory()) {
    return loadLocalDirectory(resolved, opts, limitRun);
  }

  throw new JsonLoaderError(
    `Unsupported path type: ${resolved}`,
    "LOCAL_PATH_TYPE_ERROR"
  );
}