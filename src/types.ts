// types.ts

import type { PathLike } from "fs";
import type { URL } from "url";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray;

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface JsonArray extends Array<JsonValue> {}

export interface LoadedJsonFile {
  /** Logical name (basename of path or URL) */
  name: string;
  /** Parsed and security‑sanitized JSON data */
  data: JsonValue;
  /** Original source (absolute path or URL) */
  __source: string;
}

/**
 * High‑level logging categories.
 * Keeps the core loader decoupled from any concrete logging framework.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Abstract logger interface the loader will use.
 * Callers can pass a custom implementation (winston/pino/console/etc.).
 */
export interface JsonLoaderLogger {
  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void;
}

/**
 * Options for safe JSON loading.
 */
export interface SafeJsonLoaderOptions {
  /**
   * Maximum number of JSON files to load per call
   * (applies to local directories and remote indexes).
   * Default: 100
   */
  maxFiles?: number;

  /**
   * Maximum total bytes for all local JSON files combined.
   * Default: 10 MB
   */
  maxTotalBytes?: number;

  /**
   * Maximum bytes per local JSON file.
   * Default: 2 MB
   */
  maxFileBytes?: number;

  /**
   * HTTP timeout per remote request in milliseconds.
   * Default: 8000
   */
  httpTimeoutMs?: number;

  /**
   * Maximum number of concurrent I/O operations (local reads + remote fetches).
   * Default: 5
   */
  maxConcurrency?: number;

  /**
   * If true, accept any content‑type containing "json".
   * If false, require "application/json".
   * Default: true
   */
  looseJsonContentType?: boolean;

  /**
   * Maximum allowed depth of parsed JSON structures.
   * Helps mitigate very deep payloads used for DoS.
   * Default: 50
   */
  maxJsonDepth?: number;


  /**
   * Optional logger implementation.
   * If omitted, a no‑op logger is used.
   */
  logger?: JsonLoaderLogger;

  /**
   * Optional hook invoked after each file is successfully loaded and sanitized.
   */
  onFileLoaded?: (file: LoadedJsonFile) => void;

  /**
   * Optional hook invoked when a file is skipped due to limits.
   */
  onFileSkipped?: (info: { source: string; reason: string }) => void;
}

/**
 * Internal fully‑resolved options shape (after merging defaults).
 */
export interface ResolvedSafeJsonLoaderOptions extends SafeJsonLoaderOptions {
  maxFiles: number;
  maxTotalBytes: number;
  maxFileBytes: number;
  httpTimeoutMs: number;
  maxConcurrency: number;
  looseJsonContentType: boolean;
  maxJsonDepth: number;
  logger: JsonLoaderLogger;
  onFileLoaded: (file: LoadedJsonFile) => void;
  onFileSkipped: (info: { source: string; reason: string }) => void;
}

/**
 * Input accepted by the loader: either a path‑like or a URL string.
 * We keep it simple: callers pass a string; we decide if it’s local or remote.
 */
export type JsonLoadInput = string | PathLike | URL;