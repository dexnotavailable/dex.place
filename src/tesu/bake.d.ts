// The build's bake (plates/bake-plugin.ts): where the baked world and plate tiles are; nulls on the dev server.
declare module "virtual:tesu-bake" {
  const bake: { index: string | null; world: string | null };
  export default bake;
}

// (lane C 10-19) The build's content versions of the drawings under public/assets, by folder URL; empty on the dev server.
declare module "virtual:tesu-art" {
  const art: Record<string, string>;
  export default art;
}
