// Minimal ambient types for the Vite features the website layer uses, instead
// of pulling all of vite/client into the shared program.

declare module "*.css";

interface ImportMeta {
  glob<T = unknown>(pattern: string | readonly string[]): Record<string, () => Promise<T>>;
}
