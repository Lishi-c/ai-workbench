const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { Resvg } = require("@resvg/resvg-js");
const pngToIco = require("png-to-ico").default || require("png-to-ico");

(async () => {
  const root = process.cwd();
  const svg = readFileSync(resolve(root, "build/icon.svg"), "utf-8");
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngs = sizes.map((size) => {
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: size } });
    return resvg.render().asPng();
  });
  const ico = await pngToIco(pngs);
  writeFileSync(resolve(root, "build/icon.ico"), ico);
  console.log("icon.ico generated with sizes", sizes.join(", "));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
