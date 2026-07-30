import { readFile } from "node:fs/promises";
import sharp from "sharp";

const [output, ...inputs] = process.argv.slice(2);
if (!output || !inputs.length) {
  throw new Error("Usage: node scripts/render-logo-review.mjs output.png input.svg...");
}

const tileSize = 640;
const tiles = await Promise.all(
  inputs.map(async (input) =>
    sharp(await readFile(input))
      .resize(tileSize, tileSize)
      .png()
      .toBuffer(),
  ),
);

await sharp({
  create: {
    width: tileSize * tiles.length,
    height: tileSize,
    channels: 4,
    background: "#242321",
  },
})
  .composite(
    tiles.map((input, index) => ({
      input,
      left: index * tileSize,
      top: 0,
    })),
  )
  .png()
  .toFile(output);
