# Safe-json-loader

A security‑hardened JSON loader and sanitizer for Node.js that protects against prototype pollution, excessive depth, oversized payloads, unsafe remote JSON, and directory‑based DoS attacks.

- Local JSON files
- Local directories of JSON files
- Remote JSON URLs
- Remote JSON indexes (`[]` or `{ files: [] }`)
- Safe parsing of raw JSON strings
- Safe sanitization of already‑parsed JSON objects (e.g., Express `req.body`)
- Minimal logger interface with a default adapter to `@ktuban/structured-logger`

---

## Features

- **Security‑first design:**  
  strips `__proto__`, `constructor`, `prototype`; rebuilds objects with `Object.create(null)`; enforces maximum JSON depth; per‑file and total directory size limits; safe remote loading with timeout, content‑type validation, and concurrency limits.

- **Helpers for all entry points:**  
  `loadSafeJsonResources()` for files/directories/URLs;  
  `parseSafeJsonString()` for raw strings;  
  `sanitizeParsedJsonObject()` for already‑parsed objects.

- **Logger integration without duplication:**  
  accepts a minimal `Logger` interface; if none is provided, uses the shared instance from `@ktuban/structured-logger`.

- **TypeScript‑first:**  
  full type definitions and strongly typed outputs.

---

## Installation

```bash
npm install safe-json-loader safe-json-stringify
```

Node.js 18+ required.

---

## Quick start

```ts
import { loadSafeJsonResources } from "safe-json-loader";

const files = await loadSafeJsonResources("./configs");

for (const file of files) {
  console.log(file.name);
  console.log(file.data);
}
```

---

## Recommended logger pattern

Most applications should use one shared logger instance across the entire codebase and let this library reuse it by default.

```ts
// logger.ts
import { StructuredLogger } from "@ktuban/structured-logger";

export const logger = StructuredLogger.getInstance({
  level: process.env["LOG_LEVEL"] as any,
  format: process.env["NODE_ENV"] === "development" ? "text" : "json",
  filePath: process.env["LOG_FILE"],
});
```

You don’t need to pass a logger to `safe-json-loader`—it will automatically adapt the shared instance above. If you want to override it (e.g., in tests), pass a custom minimal logger.

---

## Usage

### Load from file, directory, or URL

```ts
import { loadSafeJsonResources } from "safe-json-loader";

const files = await loadSafeJsonResources("https://example.com/config.json");
// or: await loadSafeJsonResources("./configs");
// or: await loadSafeJsonResources("./configs/app.json")

for (const file of files) {
  // file.name → basename of path or URL
  // file.data → sanitized JSON
  // file.__source → absolute path or URL
}
```

### Parse and sanitize a raw JSON string

```ts
import { parseSafeJsonString } from "safe-json-loader";

const safeObj = parseSafeJsonString('{"user":{"__proto__":{"polluted":true}}}', {
  maxJsonDepth: 30,
});

// => { user: {} }   // pollution stripped
```

### Sanitize an already‑parsed JSON object (Express example)

```ts
import express from "express";
import { sanitizeParsedJsonObject } from "safe-json-loader";

const app = express();
app.use(express.json());

app.post("/api/data", (req, res) => {
  try {
    const safeBody = sanitizeParsedJsonObject(req.body, { maxJsonDepth: 30 });
    res.json({ ok: true, sanitized: safeBody });
  } catch (err: any) {
    res.status(400).json({ error: err.message, code: err.code });
  }
});
```

### Safe serialization

```ts
import safeStringify from "safe-json-stringify";

const json = safeStringify(files[0].data);
```

---

## Options

```ts
interface Logger {
  debug?: (message: string, meta?: unknown) => void;
  info?: (message: string, meta?: unknown) => void;
  warn?: (message: string, meta?: unknown) => void;
  error?: (message: string, meta?: unknown) => void;
}

interface SafeJsonLoaderOptions {
  maxFiles?: number;              // default 100
  maxTotalBytes?: number;         // default 10 * 1024 * 1024 (10 MB)
  maxFileBytes?: number;          // default 2 * 1024 * 1024 (2 MB)
  httpTimeoutMs?: number;         // default 8000
  maxConcurrency?: number;        // default 5
  looseJsonContentType?: boolean; // default true
  maxJsonDepth?: number;          // default 50

  logger?: Logger;                // optional; defaults to @ktuban/structured-logger
  onFileLoaded?: (file: LoadedJsonFile) => void;
  onFileSkipped?: (info: { source: string; reason: string }) => void;
}
```

- **Default logger behavior:**  
  If `logger` is omitted, the library adapts the shared instance from `@ktuban/structured-logger`.  
  If you pass a custom logger, only the methods you implement are used; missing methods are skipped silently.

---

## Returned structure

```ts
interface LoadedJsonFile {
  name: string;     // file name or URL basename
  data: JsonValue;  // sanitized JSON
  __source: string; // absolute path or URL
}
```

---

## Security guarantees

- **Prototype pollution prevented:** strips `__proto__`, `constructor`, `prototype`.
- **No inherited prototypes:** objects rebuilt with `Object.create(null)`.
- **Depth‑limited:** configurable `maxJsonDepth`.
- **Size‑limited:** per‑file and total directory limits.
- **Safe remote fetch:** timeout and content‑type validation.
- **Concurrency‑limited:** avoids I/O storms.
- **Sanitized before user code touches it:** all entry points sanitize.

---

## Error handling

All errors are thrown as:

```ts
class JsonLoaderError extends Error {
  code: string;
}
```

Example:

```ts
try {
  await loadSafeJsonResources("./bad.json");
} catch (err: any) {
  console.error(err.code, err.message);
}
```

---

## Advanced examples

### Custom minimal logger (tests or alternative frameworks)

```ts
import { loadSafeJsonResources } from "safe-json-loader";

const testLogger = {
  info: (msg: string, meta?: unknown) => {
    // capture logs for assertions
  },
  error: (msg: string, meta?: unknown) => {
    // capture errors
  },
};

await loadSafeJsonResources("./configs", { logger: testLogger });
```

### Hooks for progress and limits

```ts
await loadSafeJsonResources("./configs", {
  onFileLoaded: (file) => {
    // e.g., metrics or audit trail
  },
  onFileSkipped: ({ source, reason }) => {
    // e.g., alert on skipped files
  },
});
```

---

## Best practices

- **Always sanitize `req.body`** before schema validation.
- **Set `maxJsonDepth`** in production to a sensible value for your domain.
- **Use one shared logger instance** across your app and libraries.
- **Keep remote indexes small** and enforce `maxFiles` to avoid DoS via large listings.

---

## License

MIT

---