// logger.ts

import { LoggerContract, StructuredLogger } from "@ktuban/structured-logger";
import type {
  ResolvedSafeJsonLoaderOptions,
  SafeJsonLoaderOptions,
} from "./types.js";

/**
 * Default logger instance.
 *
 * We rely on StructuredLogger's singleton behavior:
 * - If the host app has already called StructuredLogger.getInstance({...}),
 *   this will reuse that configuration.
 * - If not, this will create a default instance with its own defaults.
 */
const structuredLogger = StructuredLogger.getInstance();

/**
 * Default logger adapter that maps the loader's minimal Logger interface
 * to the StructuredLogger API.
 */
const DEFAULT_LOGGER: LoggerContract = {
  debug: (message, meta) => structuredLogger.debug(message, meta as any),
  info: (message, meta) => structuredLogger.info(message, meta as any),
  warn: (message, meta) => structuredLogger.warn(message, meta as any),
  error: (message, meta) => structuredLogger.error(message, meta as any),
};

/**
 * Default options for the safe JSON loader.
 */
const DEFAULT_OPTIONS: ResolvedSafeJsonLoaderOptions = {
  maxFiles: 100,
  maxTotalBytes: 10 * 1024 * 1024, // 10 MB
  maxFileBytes: 2 * 1024 * 1024,   // 2 MB
  httpTimeoutMs: 8000,
  maxConcurrency: 5,
  looseJsonContentType: true,
  maxJsonDepth: 50,
  logger: DEFAULT_LOGGER,
  onFileLoaded: () => {},
  onFileSkipped: () => {},
};

/**
 * Merge user‑provided options with defaults.
 *
 * - Ensures all numeric limits are set.
 * - Ensures logger and hooks are always defined.
 */
export function mergeOptions(
  opts?: SafeJsonLoaderOptions
): ResolvedSafeJsonLoaderOptions {
  const logger = opts?.logger ?? DEFAULT_OPTIONS.logger;

  return {
    ...DEFAULT_OPTIONS,
    ...opts,
    logger,
    onFileLoaded: opts?.onFileLoaded ?? DEFAULT_OPTIONS.onFileLoaded,
    onFileSkipped: opts?.onFileSkipped ?? DEFAULT_OPTIONS.onFileSkipped,
  };
}

/**
 * Helper to log with a specific log level using resolved options.
 *
 * This is intentionally minimal and tolerant:
 * - If a given level is not implemented by the logger, it is silently skipped.
 */
export function log(
  options: ResolvedSafeJsonLoaderOptions,
  level: keyof LoggerContract,
  message: string,
  meta?: unknown
): void {
  const fn = options.logger[level];
  if (fn) fn(message, meta);
}
