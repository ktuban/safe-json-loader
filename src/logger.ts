// logger.ts
import  stringify from "safe-json-stringify"
import type {
  JsonLoaderLogger,
  LogLevel,
  ResolvedSafeJsonLoaderOptions,
  SafeJsonLoaderOptions,
} from "./types.js";

const NOOP_LOGGER: JsonLoaderLogger = {
  log: () => {
    // no‑op
  },
};

const DEFAULT_OPTIONS: ResolvedSafeJsonLoaderOptions = {
  maxFiles: 100,
  maxTotalBytes: 10 * 1024 * 1024, // 10 MB
  maxFileBytes: 2 * 1024 * 1024,   // 2 MB
  httpTimeoutMs: 8000,
  maxConcurrency: 5,
  looseJsonContentType: true,
  maxJsonDepth: 50,
  logger: NOOP_LOGGER,
  onFileLoaded: () => {},
  onFileSkipped: () => {},
};

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
 * Simple adapter to allow direct use of console as logger, if desired.
 */
export class ConsoleJsonLoaderLogger implements JsonLoaderLogger {
  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const payload = meta ? `${message} | ${stringify(meta)}` : message;
    switch (level) {
      case "debug":
        console.debug(payload);
        break;
      case "info":
        console.info(payload);
        break;
      case "warn":
        console.warn(payload);
        break;
      case "error":
        console.error(payload);
        break;
    }
  }
}

/**
 * Helper to log with a specific log level using resolved options.
 */
export function logWith(
  options: ResolvedSafeJsonLoaderOptions,
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>
): void {
  options.logger.log(level, message, meta);
}