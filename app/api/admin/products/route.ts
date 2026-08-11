import catalogData from "../../../data/catalog.json";
import { requestIsAdmin, requestIsSameOrigin } from "../../../lib/admin-auth";
import type { CatalogProduct } from "../../../lib/catalog";
import {
  normalizeProductImageSettings,
  type ProductImageSettings,
} from "../../../lib/product-image-settings";
import {
  getMerchandisingSettings,
  replaceMerchandisingSettings,
} from "../../../../db/merchandising";
import {
  getSyncedCatalogProducts,
  saveSyncedProductEdits,
  type SyncedProductEdit,
} from "../../../../db/synced-products";

async function adminCatalog() {
  const syncedProducts = await getSyncedCatalogProducts({ includeInactive: true });
  const legacyProducts = (catalogData as CatalogProduct[]).map((product) => ({
    ...product,
    source: "legacy" as const,
    images: product.image ? [product.image] : [],
  }));
  return [...legacyProducts, ...syncedProducts];
}

export async function GET(request: Request) {
  if (!(await requestIsAdmin(request))) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }
  const [products, settings] = await Promise.all([
    adminCatalog(),
    getMerchandisingSettings(),
  ]);
  return Response.json({ products, ...settings });
}

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) {
    return Response.json({ error: "Request rejected." }, { status: 403 });
  }
  if (!(await requestIsAdmin(request))) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    hiddenProductHandles?: unknown;
    productImageSettings?: unknown;
    syncedProductEdits?: unknown;
  };
  if (
    !Array.isArray(payload.hiddenProductHandles) ||
    !payload.productImageSettings ||
    typeof payload.productImageSettings !== "object" ||
    Array.isArray(payload.productImageSettings) ||
    !Array.isArray(payload.syncedProductEdits)
  ) {
    return Response.json({ error: "Invalid product selection." }, { status: 400 });
  }

  const products = await adminCatalog();
  const validHandles = new Set(products.map((product) => product.handle));
  const sourceImages = new Map(
    products.map((product) => [
      product.handle,
      [product.image, ...(product.images ?? [])].filter(
        (image, index, values): image is string =>
          Boolean(image) && values.indexOf(image) === index,
      ),
    ]),
  );
  const hiddenProductHandles = payload.hiddenProductHandles.filter(
    (handle): handle is string => typeof handle === "string" && validHandles.has(handle),
  );
  const normalizedImages = normalizeProductImageSettings(payload.productImageSettings);
  const productImageSettings: ProductImageSettings = {};

  for (const [handle, setting] of Object.entries(normalizedImages)) {
    if (!validHandles.has(handle)) continue;
    const originals = sourceImages.get(handle) ?? [];
    const sourceDefault = originals[0] ?? null;
    const defaultUrl =
      originals.includes(setting.defaultUrl ?? "") ||
      setting.urls.includes(setting.defaultUrl ?? "")
        ? setting.defaultUrl
        : sourceDefault;

    if (setting.urls.length || (defaultUrl && defaultUrl !== sourceDefault)) {
      productImageSettings[handle] = { urls: setting.urls, defaultUrl };
    }
  }

  const syncedHandles = new Set(
    products
      .filter((product) => product.source === "printful-api")
      .map((product) => product.handle),
  );
  const syncedProductEdits = payload.syncedProductEdits.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const candidate = value as Partial<SyncedProductEdit>;
    if (
      typeof candidate.handle !== "string" ||
      !syncedHandles.has(candidate.handle) ||
      (candidate.titleOverride !== null &&
        typeof candidate.titleOverride !== "string") ||
      typeof candidate.description !== "string" ||
      typeof candidate.category !== "string" ||
      !candidate.priceOverrides ||
      typeof candidate.priceOverrides !== "object" ||
      Array.isArray(candidate.priceOverrides)
    ) {
      return [];
    }
    return [candidate as SyncedProductEdit];
  });

  await Promise.all([
    replaceMerchandisingSettings({ hiddenProductHandles, productImageSettings }),
    saveSyncedProductEdits(syncedProductEdits),
  ]);

  return Response.json({
    saved: true,
    hiddenProductHandles,
    productImageSettings,
    syncedProductEdits,
  });
}
