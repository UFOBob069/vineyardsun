import {
  DAVIDS_PRINTFUL_STORE_ID,
  upsertSyncedProducts,
  type SyncedProductInput,
} from "../../db/synced-products";

type PrintfulListProduct = {
  id: number;
  external_id?: string | null;
  name: string;
  thumbnail_url?: string | null;
};

type PrintfulFile = {
  preview_url?: string | null;
  thumbnail_url?: string | null;
};

type PrintfulVariant = {
  id: number;
  name: string;
  synced?: boolean;
  is_ignored?: boolean;
  retail_price?: string | number | null;
  sku?: string | null;
  size?: string | null;
  color?: string | null;
  availability_status?: string | null;
  files?: PrintfulFile[];
};

type PrintfulBody = {
  result?: unknown;
  paging?: { total?: number };
  error?: string | { message?: string };
};

function config() {
  const token = process.env.PRINTFUL_TOKEN?.trim();
  const configuredStoreId =
    process.env.PRINTFUL_SYNC_STORE_ID?.trim() || DAVIDS_PRINTFUL_STORE_ID;
  if (!token) throw new Error("PRINTFUL_TOKEN is not configured.");
  if (configuredStoreId !== DAVIDS_PRINTFUL_STORE_ID) {
    throw new Error("Product sync is restricted to David's Store.");
  }
  return { token, storeId: configuredStoreId };
}

async function getPrintful(path: string) {
  const { token, storeId } = config();
  const response = await fetch(`https://api.printful.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-PF-Store-Id": storeId,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await response.json()) as PrintfulBody;
  if (!response.ok) {
    const message =
      typeof body.error === "string"
        ? body.error
        : body.error?.message ?? `Printful returned HTTP ${response.status}.`;
    throw new Error(message);
  }
  return body;
}

function httpsImage(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function variantTitle(variant: PrintfulVariant, productName: string) {
  const parts = [variant.color?.trim(), variant.size?.trim()].filter(Boolean);
  if (parts.length) return parts.join(" / ");
  const prefix = `${productName} / `;
  return variant.name.startsWith(prefix) ? variant.name.slice(prefix.length) : variant.name;
}

async function listProducts() {
  const products: PrintfulListProduct[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const body = await getPrintful(`/store/products?offset=${offset}&limit=${limit}`);
    const page = Array.isArray(body.result)
      ? (body.result as PrintfulListProduct[])
      : [];
    products.push(...page);
    const total = body.paging?.total ?? products.length;
    if (page.length < limit || products.length >= total) break;
    offset += page.length;
  }

  return products;
}

async function getProduct(product: PrintfulListProduct): Promise<SyncedProductInput> {
  const body = await getPrintful(`/store/products/${product.id}`);
  const result = body.result as
    | { sync_product?: PrintfulListProduct; sync_variants?: PrintfulVariant[] }
    | undefined;
  const syncProduct = result?.sync_product ?? product;
  const variants = result?.sync_variants ?? [];
  const images = [
    syncProduct.thumbnail_url,
    ...variants.flatMap((variant) =>
      (variant.files ?? []).flatMap((file) => [file.preview_url, file.thumbnail_url]),
    ),
  ].filter(httpsImage);

  return {
    printfulProductId: String(syncProduct.id),
    externalId: syncProduct.external_id ?? null,
    sourceTitle: syncProduct.name,
    thumbnailUrl: httpsImage(syncProduct.thumbnail_url)
      ? syncProduct.thumbnail_url
      : null,
    sourceImages: [...new Set(images)],
    variants: variants.flatMap((variant) => {
      const price = Number(variant.retail_price);
      const priceCents = Math.round(price * 100);
      if (!Number.isFinite(price) || priceCents < 50) return [];
      const availability = variant.availability_status?.toLowerCase();
      const available =
        variant.synced !== false &&
        !variant.is_ignored &&
        !["discontinued", "out_of_stock", "inactive"].includes(availability ?? "");
      return [
        {
          id: variant.id,
          title: variantTitle(variant, syncProduct.name),
          priceCents,
          available,
          sku: variant.sku ?? null,
        },
      ];
    }),
  };
}

export async function syncDavidsPrintfulStore() {
  const products = await listProducts();
  const details: SyncedProductInput[] = [];
  // Keep requests sequential and gentle on Printful's product endpoints. This
  // store is intentionally small and is synced manually only a few times a year.
  for (const product of products) details.push(await getProduct(product));
  return upsertSyncedProducts(DAVIDS_PRINTFUL_STORE_ID, details);
}
