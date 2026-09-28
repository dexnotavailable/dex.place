// Vite's ?raw imports: data files arrive as text and go through validation.
declare module "*?raw" {
  const text: string;
  export default text;
}
