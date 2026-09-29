// Source verifiers can run on the CPU; delivery uses the existing D3D route
// under its exclusive lease. Neither route proves Samsung Internet or Safari.
export const angle = process.env.WORLD_ANGLE ?? "d3d11";
if (!["d3d11", "swiftshader"].includes(angle)) throw new Error(`Unsupported WORLD_ANGLE: ${angle}`);
export const browserOptions = {
  channel: "msedge",
  headless: true,
  args: [
    `--use-angle=${angle}`,
    ...(angle === "swiftshader" ? ["--enable-unsafe-swiftshader", "--disable-gpu-compositing"] : ["--enable-gpu", "--ignore-gpu-blocklist"]),
    "--autoplay-policy=no-user-gesture-required",
  ],
};
