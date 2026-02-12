# @ktuban/safe-json-loader

[![npm version](https://img.shields.io/npm/v/@ktuban/safe-json-loader.svg)](https://www.npmjs.com/package/@ktuban/safe-json-loader)
[![npm downloads](https://img.shields.io/npm/dm/@ktuban/safe-json-loader.svg)](https://www.npmjs.com/package/@ktuban/safe-json-loader)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Support via PayPal](https://img.shields.io/badge/Support-PayPal-blue.svg)](https://paypal.me/KhalilTuban)
[![Ko‑fi](https://img.shields.io/badge/Support-Ko--fi-red.svg)](https://ko-fi.com/ktuban)

Security‑hardened **JSON loader** with prototype‑pollution protection, depth limits, safe parsing, and optional validation layers. Designed for processing untrusted JSON from files, APIs, and user input.

## ✨ Features

- **Prototype Pollution Protection** — Detects and removes `__proto__`, `constructor`, `prototype`
- **Depth Limiting** — Prevent deeply nested JSON attacks (DoS prevention)
- **Safe Parsing** — Configurable error handling and fallback values
- **Type Validation** — Optional schema validation with custom validators
- **Remote Loading** — Safely load JSON from URLs with timeout/size limits
- **File Loading** — Stream-based loading for large JSON files
- **Detailed Diagnostics** — Warning reports for suspicious patterns
- **TypeScript First** — Full type definitions, strict mode
- **Production Ready** — Used in security-critical applications

---

## 📦 Installation

```bash
npm install @ktuban/safe-json-loader
```

**Requires**: Node.js 18+

---

## 🚀 Quick Start

### Basic Parsing

```typescript
import { SafeJsonLoader } from "@ktuban/safe-json-loader";

const loader = new SafeJsonLoader({
  maxDepth: 10,
  detectPollution: true,
});

// Safe parse with automatic protection
const result = loader.parse('{"user": {"name": "John"}}');
console.log(result.data); // { user: { name: "John" } }
```

### Prototype Pollution Detection

```typescript
const malicious = '{"__proto__": {"isAdmin": true}}';

const result = loader.parse(malicious);
console.log(result.warnings); // ["Prototype pollution detected: __proto__"]
console.log(result.isSafe); // false
```

### Depth Protection

```typescript
const loader = new SafeJsonLoader({
  maxDepth: 5, // Limit nesting to 5 levels
});

const deeplyNested = {
  a: { b: { c: { d: { e: { f: "too deep" } } } } },
};

const result = loader.parse(stringify(deeplyNested));
console.log(result.isSafe); // false
console.log(result.warnings); // ["Max depth exceeded at level 6"]
```

---

## 📖 API Reference

### SafeJsonLoader Constructor

```typescript
const loader = new SafeJsonLoader({
  maxDepth: 20,                  // Maximum nesting level
  maxSize: 10 * 1024 * 1024,    // Max size in bytes
  detectPollution: true,         // Detect __proto__, constructor, prototype
  throwOnUnsafe: false,          // Throw error on suspicious patterns
  onWarning: (w) => console.warn(w), // Warning callback
});
```

**Options:**
- `maxDepth` — Maximum JSON nesting depth (default: 20)
- `maxSize` — Maximum JSON size in bytes (default: 10MB)
- `detectPollution` — Enable prototype pollution detection (default: true)
- `throwOnUnsafe` — Throw error instead of returning unsafe flag (default: false)
- `onWarning` — Callback for warnings

### Parse Method

```typescript
const result = loader.parse(jsonString);

// Result object:
{
  data: any,              // Parsed JSON (or undefined if parsing failed)
  success: boolean,       // Whether parsing succeeded
  isSafe: boolean,        // Whether no suspicious patterns detected
  warnings: string[],     // List of warnings
  error?: Error,          // Parse error if applicable
  metadata: {
    depth: number,        // Maximum nesting depth found
    size: number,         // JSON size in bytes
    keys: number,         // Total number of keys
  }
}
```

### File Loading

```typescript
const result = await loader.loadFromFile("/path/to/config.json", {
  encoding: "utf-8",
});

console.log(result.data);    // Parsed JSON
console.log(result.isSafe);  // Safety check
```

### Remote Loading

```typescript
const result = await loader.loadFromUrl(
  "https://api.example.com/config.json",
  {
    timeout: 5000,           // 5 second timeout
    maxSize: 5 * 1024 * 1024, // 5MB limit
  }
);

if (result.isSafe) {
  applyConfig(result.data);
}
```

### Validation

```typescript
const loader = new SafeJsonLoader({
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name"],
  },
});

const result = loader.parse('{"name": "John", "age": 30}');
console.log(result.isSafe); // true if validates
```

---

## 🔍 Detecting Threats

The loader automatically detects:

### Prototype Pollution

```typescript
// Detected and flagged
{
  "__proto__": { "isAdmin": true },
  "constructor": { "prototype": { "isAdmin": true } }
}
```

### Excessive Depth

```typescript
// Flagged if exceeds maxDepth
{
  "a": {
    "b": {
      "c": {
        // ... very deeply nested
      }
    }
  }
}
```

### Large Payloads

```typescript
// Flagged if exceeds maxSize
const largeJson = stringify({
  data: "x".repeat(100 * 1024 * 1024), // 100MB string
});
```

---

## 🎯 Best Practices

1. **Set appropriate depth limits**
   ```typescript
   // For config files
   new SafeJsonLoader({ maxDepth: 10 });
   
   // For flexible data
   new SafeJsonLoader({ maxDepth: 50 });
   ```

2. **Always check `isSafe` for untrusted input**
   ```typescript
   const result = loader.parse(userInput);
   if (!result.isSafe) {
     logger.warn("Unsafe JSON detected", { warnings: result.warnings });
     return null;
   }
   ```

3. **Set size limits for remote loading**
   ```typescript
   await loader.loadFromUrl(url, {
     maxSize: 1 * 1024 * 1024, // 1MB max
   });
   ```

4. **Enable pollution detection for user data**
   ```typescript
   const loader = new SafeJsonLoader({
     detectPollution: true, // Always true for untrusted sources
   });
   ```

5. **Review warnings in production**
   ```typescript
   const result = loader.parse(json);
   if (result.warnings.length > 0) {
     auditLog.warn("Suspicious JSON patterns detected", {
       warnings: result.warnings,
     });
   }
   ```

---

## 🔐 Security Notes

- **Prototype Pollution** is a critical vulnerability — always enable detection for untrusted input
- **Constructor patterns** can be exploited — the loader detects common attack vectors
- **DoS attacks** — Use depth and size limits to prevent parser exhaustion
- **Validation** — Use schema validation for critical data
- **Logging** — Log suspicious patterns for security monitoring

---

## 📊 Performance

For typical JSON files (< 1MB):
- Parse time: < 1ms
- Validation overhead: < 0.5ms
- Pollution detection: < 0.1ms

---

## ☕ Support the Project

If this library helps you secure your JSON handling, consider supporting ongoing development:

- [PayPal.me/khaliltuban](https://paypal.me/KhalilTuban)
- [Ko‑fi.com/ktuban](https://ko-fi.com/ktuban)

---

## 📄 License

MIT © K Tuban

## 🤝 Contributing

Pull requests are welcome. Please include tests and documentation updates.

## 🧭 Roadmap

- [ ] Custom sanitization rules
- [ ] JSON schema validator integration
- [ ] Performance optimizations
- [ ] Additional threat detection patterns
- [ ] WebAssembly parser option
