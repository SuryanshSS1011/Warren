// No-op stand-in for the `server-only` package under test. In production this import
// throws if a module is bundled for the client; in unit tests we import server modules
// directly in a node context, so it must be inert.
export {};
