// The build's bake (plates/bake-plugin.ts): where the baked world and plate tiles are; nulls on the dev server.
declare module "virtual:tesu-bake" {
  const bake: { index: string | null; world: string | null };
  export default bake;
}
