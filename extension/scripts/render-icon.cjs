// Rasterizes the unified Snapds mark (media/icon.svg) into the 256x256
// Marketplace PNG (media/icon.png). Run with `npm run icon:png` after editing
// the SVG so the two stay in sync.
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const root = path.resolve(__dirname, '..');
const svgPath = path.join(root, 'media', 'icon.svg');
const outPath = path.join(root, 'media', 'icon.png');
const size = 256;

const svg = fs.readFileSync(svgPath);
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: size },
  background: 'rgba(0,0,0,0)',
});
const png = resvg.render().asPng();
fs.writeFileSync(outPath, png);
console.log(`Rendered ${path.relative(root, outPath)} (${size}x${size}, ${png.length} bytes)`);
