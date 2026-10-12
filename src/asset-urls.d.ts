// Vite asset imports: `?url` gives the built file's URL (stylesheets loaded on demand).
declare module "*?url" {
  const url: string;
  export default url;
}
