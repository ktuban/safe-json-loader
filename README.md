Got it, K — let’s update your **README.md** so it reflects the new helpers (`parseSafeJsonString` and `sanitizeParsedJsonObject`) alongside the loader. This way, developers see clearly how to use the library in **all entry points**: files, URLs, raw strings, and already‑parsed objects (like Express `req.body`).  

Here’s the polished, industry‑grade README update:

---

# **safe-json-loader**

A **security‑hardened JSON loader and sanitizer** for Node.js that protects against prototype pollution, excessive depth, oversized payloads, unsafe remote JSON, and directory‑based DoS attacks.  
Supports:

- Local JSON files  
- Local directories of JSON files  
- Remote JSON URLs  
- Remote JSON indexes (`[]` or `{ files: [] }`)  
- Safe parsing of raw JSON strings  
- Safe sanitization of already‑parsed JSON objects  
- Safe serialization via `safe-json-stringify`  

---

## **Features**

- 🔐 **Security‑first design**  
  - Strips `__proto__`, `constructor`, and `prototype`  
  - Rebuilds objects using `Object.create(null)`  
  - Enforces maximum JSON depth  
  - Enforces per‑file and total directory size limits  
  - Enforces maximum number of files  
  - Safe remote loading with timeout, content‑type validation, and concurrency limits  

- 🧹 **Helpers for all entry points**  
  - `loadSafeJsonResources()` → load from file, directory, or URL  
  - `parseSafeJsonString()` → sanitize raw JSON strings  
  - `sanitizeParsedJsonObject()` → sanitize already‑parsed objects (e.g. Express `req.body`)  

- 🧪 **TypeScript‑first**  
  - Full type definitions  
  - Strongly typed loader output  

---

## **Installation**

```bash
npm install safe-json-loader safe-json-stringify
```

Node.js **18+** required.

---

## **Usage**

### **1. Load from file, directory, or URL**

```ts
import { loadSafeJsonResources } from "safe-json-loader";

const files = await loadSafeJsonResources("./configs");

for (const file of files) {
  console.log(file.name);
  console.log(file.data);
}
```

---

### **2. Parse and sanitize a raw JSON string**

```ts
import { parseSafeJsonString } from "safe-json-loader";

const safeObj = parseSafeJsonString('{"user":{"__proto__":{"polluted":true}}}', {
  maxJsonDepth: 30,
});

console.log(safeObj);
// => { user: {} }   // pollution stripped
```

---

### **3. Sanitize an already‑parsed JSON object (Express example)**

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

---

### **4. Safe serialization**

```ts
import safeStringify from "safe-json-stringify";

const json = safeStringify(file.data);
```

---

## **Options**

```ts
interface SafeJsonLoaderOptions {
  maxFiles?: number;            // default 100
  maxTotalBytes?: number;       // default 10 MB
  maxFileBytes?: number;        // default 2 MB
  httpTimeoutMs?: number;       // default 8000
  maxConcurrency?: number;      // default 5
  looseJsonContentType?: boolean; // default true
  maxJsonDepth?: number;        // default 50
  logger?: JsonLoaderLogger;
  onFileLoaded?: (file) => void;
  onFileSkipped?: (info) => void;
}
```

---

## **Returned Structure**

Each loaded file has the shape:

```ts
interface LoadedJsonFile {
  name: string;       // file name or URL basename
  data: JsonValue;    // sanitized JSON
  __source: string;   // absolute path or URL
}
```

---

## **Security Guarantees**

- ✔ Prototype pollution prevented  
- ✔ No inherited prototypes  
- ✔ Depth‑limited  
- ✔ Size‑limited  
- ✔ Safe remote fetch  
- ✔ Concurrency‑limited  
- ✔ Sanitized before user code touches it  

---

## **Error Handling**

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

## **License**

MIT

---

👉 With this update, your README now documents **all three entry points**: loader, string parser, and object sanitizer.  

always sanitize `req.body` before schema validation, always set `maxJsonDepth` in production) 