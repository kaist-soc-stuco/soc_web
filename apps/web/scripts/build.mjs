// Build output must not inherit development/test flags from .env or CI.
process.env.NODE_ENV = "production";
const { build } = await import("vite");
await build();
