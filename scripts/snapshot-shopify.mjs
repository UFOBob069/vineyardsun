import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const catalogDir = path.join(root, "app", "data");
const productImageDir = path.join(root, "public", "products");
const brandImageDir = path.join(root, "public", "brand");

await Promise.all([
  mkdir(catalogDir, { recursive: true }),
  mkdir(productImageDir, { recursive: true }),
  mkdir(brandImageDir, { recursive: true }),
]);

const response = await fetch("https://vineyardsun.com/products.json?limit=250");
if (!response.ok) {
  throw new Error(`Could not fetch catalog: ${response.status}`);
}

const { products } = await response.json();

function extensionFor(url) {
  const pathname = new URL(url).pathname;
  const extension = path.extname(pathname).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].includes(extension)
    ? extension
    : ".jpg";
}

async function download(url, destination, width) {
  const source = new URL(url);
  source.searchParams.set("width", String(width));
  const imageResponse = await fetch(source);
  if (!imageResponse.ok) {
    throw new Error(`Could not fetch ${url}: ${imageResponse.status}`);
  }
  await writeFile(destination, Buffer.from(await imageResponse.arrayBuffer()));
}

const normalized = [];

for (const product of products) {
  const primaryImage = product.images?.[0]?.src ?? null;
  const extension = primaryImage ? extensionFor(primaryImage) : ".jpg";
  const imageName = `${product.handle}${extension}`;

  if (primaryImage) {
    await download(primaryImage, path.join(productImageDir, imageName), 1000);
  }

  const hasPrintfulSku = product.variants.some((variant) =>
    /^\d+_\d+$/.test(variant.sku ?? ""),
  );

  normalized.push({
    id: product.id,
    title: product.title,
    handle: product.handle,
    type: product.product_type || "Goods",
    fulfillment: hasPrintfulSku ? "printful" : "local",
    description: product.body_html
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s*\n\s*/g, "\n")
      .replace(/[ \t]+/g, " ")
      .trim(),
    image: primaryImage ? `/products/${imageName}` : null,
    available: product.variants.some((variant) => variant.available),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      price: Number(variant.price),
      compareAtPrice: variant.compare_at_price
        ? Number(variant.compare_at_price)
        : null,
      available: variant.available,
      sku: variant.sku || null,
    })),
  });
}

await writeFile(
  path.join(catalogDir, "catalog.json"),
  `${JSON.stringify(normalized, null, 2)}\n`,
);

const brandAssets = [
  {
    name: "hero.jpg",
    width: 2000,
    url: "https://vineyardsun.com/cdn/shop/files/HomeImage1_2048x.jpg?v=1613151660",
  },
  {
    name: "partners.png",
    width: 1200,
    url: "https://vineyardsun.com/cdn/shop/files/VineyardSun_Logos_97ab86e9-bce4-4d23-a34e-fc4c29091f85_1090x1090_crop_top@2x.png?v=1613667806",
  },
  {
    name: "syrah.jpg",
    width: 1000,
    url: "https://vineyardsun.com/cdn/shop/files/Cork_Sunglasses-002_600x600.jpg?v=1613662495",
  },
  {
    name: "cabernet.jpg",
    width: 1000,
    url: "https://vineyardsun.com/cdn/shop/files/Cork_Sunglasses-006_600x600.jpg?v=1613662496",
  },
  {
    name: "cash-flow-pillow.jpg",
    width: 1100,
    url: "https://vineyardsun.com/cdn/shop/files/PXL_20240904_204448008_2_530x@2x.jpg?v=1725483227",
  },
  {
    name: "founder.png",
    width: 1200,
    url: "https://cdn.shopify.com/s/files/1/1904/4399/files/Joey.PNG?v=1491871532",
  },
  {
    name: "partner-northstar.png",
    width: 700,
    url: "https://cdn.shopify.com/s/files/1/1904/4399/files/NorthStar.PNG?v=1498744827",
  },
  {
    name: "partner-mercer.jpg",
    width: 700,
    url: "https://cdn.shopify.com/s/files/1/1904/4399/files/Mercer_Winer_compact.JPG?v=1505765919",
  },
  {
    name: "partner-eternal.jpg",
    width: 700,
    url: "https://cdn.shopify.com/s/files/1/1904/4399/files/Eternal_Wines_compact.JPG?v=1505765895",
  },
  {
    name: "partner-bnd.jpg",
    width: 700,
    url: "https://cdn.shopify.com/s/files/1/1904/4399/files/brandnewdaylogo_medium.JPG?v=1519702082",
  },
  {
    name: "partner-winela.png",
    width: 700,
    url: "https://cdn.shopify.com/s/files/1/1904/4399/files/Wine_LA_compact.png?v=1519702309",
  },
  {
    name: "partner-sommeliers.jpg",
    width: 1100,
    url: "https://cdn.shopify.com/s/files/1/1904/4399/files/Oliver_Poussier_medium.JPG?v=1519702474",
  },
  {
    name: "partner-helotes.jpg",
    width: 700,
    url: "https://cdn.shopify.com/s/files/1/1904/4399/files/Helotes_Creek_Winery_medium.jpg?v=1519702556",
  },
];

for (const asset of brandAssets) {
  await download(asset.url, path.join(brandImageDir, asset.name), asset.width);
}

console.log(`Snapshotted ${normalized.length} products and ${brandAssets.length} brand assets.`);
