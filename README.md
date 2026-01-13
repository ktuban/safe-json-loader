
---

# **safe-json-loader**

A **security‑hardened JSON loader** for Node.js that protects against prototype pollution, excessive depth, oversized payloads, unsafe remote JSON, and directory‑based DoS attacks.  
Supports:

- Local JSON files  
- Local directories of JSON files  
- Remote JSON URLs  
- Remote JSON indexes (`[]` or `{ files: [] }`)  
- Optional second‑stage sanitization  
- Safe serialization via `safe-json-stringify`  

Designed for backend systems, config loaders, schema registries, plugin systems, and any environment where JSON input must be **trusted only after verification**.

---

## **Features**

### 🔐 **Security‑first design**
- Strips `__proto__`, `constructor`, and `prototype`
- Rebuilds objects using `Object.create(null)`
- Enforces maximum JSON depth
- Enforces per‑file and total directory size limits
- Enforces maximum number of files
- Safe remote loading with:
  - Timeout protection  
  - Content‑type validation  
  - URL validation  
  - Concurrency limits  

### 🧹 **Optional second‑stage sanitization**
Enable `sanitizeWithValidator` to run your own `JSONValidator.sanitize()` after loading.

### 🌐 **Local + Remote**
- Load a single JSON file  
- Load all JSON files in a directory  
- Load a remote JSON file  
- Load a remote JSON index  

### 🧱 **Zero prototype inheritance**
All objects are created with `Object.create(null)`.

### 🧪 **TypeScript-first**
- Full type definitions  
- Strongly typed loader output  

---

# **Installation**

```bash
npm install safe-json-loader safe-json-stringify
```

Node.js **18+** required.

---

# **Usage**

## **Basic Example**

```ts
import { loadSafeJsonResources } from "safe-json-loader";

const files = await loadSafeJsonResources("./configs");

for (const file of files) {
  console.log(file.name);
  console.log(file.data);
}
```

---

# **Loading a Single Local File**

```ts
const [file] = await loadSafeJsonResources("./config.json");

console.log(file.data);
```

---

# **Loading a Directory of JSON Files**

```ts
const files = await loadSafeJsonResources("./schemas", {
  maxFiles: 50,
  maxTotalBytes: 5 * 1024 * 1024, // 5 MB
});
```

---

# **Loading Remote JSON**

```ts
const [remote] = await loadSafeJsonResources(
  "https://example.com/config.json"
);

console.log(remote.data);
```

---

# **Loading a Remote JSON Index**

Supports:

```json
["https://example.com/a.json", "https://example.com/b.json"]
```

or:

```json
{ "files": ["https://example.com/a.json", "https://example.com/b.json"] }
```

Usage:

```ts
const files = await loadSafeJsonResources(
  "https://example.com/index.json",
  { maxFiles: 20 }
);
```

---

# **Optional: Run JSONValidator After Loading**

If you want a second‑stage normalization pass:

```ts
const files = await loadSafeJsonResources("./configs", {
  sanitizeWithValidator: true,
});
```

This will:

- Pretty‑print JSON  
- Remove any remaining suspicious keys  
- Generate warnings  
- Normalize formatting  

---

# **Safe Serialization**

Use `safe-json-stringify` to serialize safely:

```ts
import safeStringify from "safe-json-stringify";

const json = safeStringify(file.data);
```

---

# **Options**

```ts
interface SafeJsonLoaderOptions {
  maxFiles?: number;            // default 100
  maxTotalBytes?: number;       // default 10 MB
  maxFileBytes?: number;        // default 2 MB
  httpTimeoutMs?: number;       // default 8000
  maxConcurrency?: number;      // default 5
  looseJsonContentType?: boolean; // default true
  maxJsonDepth?: number;        // default 50
  sanitizeWithValidator?: boolean; // default false
  logger?: JsonLoaderLogger;
  onFileLoaded?: (file) => void;
  onFileSkipped?: (info) => void;
}
```

---

# **Returned Structure**

Each loaded file has the shape:

```ts
interface LoadedJsonFile {
  name: string;       // file name or URL basename
  data: JsonValue;    // sanitized JSON
  __source: string;   // absolute path or URL
}
```

---

# **Security Guarantees**

### ✔ Prototype pollution prevented  
### ✔ No inherited prototypes  
### ✔ Depth-limited  
### ✔ Size-limited  
### ✔ Safe remote fetch  
### ✔ Concurrency-limited  
### ✔ Sanitized before user code touches it  

This loader is designed to be used in **untrusted environments**.

---

# **Error Handling**

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
} catch (err) {
  console.error(err.code, err.message);
}
```

---

# **Example: Combine With Your Domain Validator**

```ts
import { loadSafeJsonResources } from "safe-json-loader";
import { validateDomainJson } from "./domainValidator";

const rawFiles = await loadSafeJsonResources("./schemas");

const validated = rawFiles.map(validateDomainJson);
```

---
