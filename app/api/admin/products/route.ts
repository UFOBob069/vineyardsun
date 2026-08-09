import catalogData from "../../../data/catalog.json";
import { requestIsAdmin, requestIsSameOrigin } from "../../../lib/admin-auth";
import {
  normalizeProductImageSettings,
  type ProductImageSettings,
} from "../../../lib/product-image-settings";
import { replaceMerchandisingSettings } from "../../../../db/merchandising";

const validHandles = new Set(catalogData.map((product) => product.handle));
const originalImages = new Map(catalogData.map((product) => [product.handle, product.image]));

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
  };
  if (
    !Array.isArray(payload.hiddenProductHandles) ||
    !payload.productImageSettings ||
    typeof payload.productImageSettings !== "object" ||
    Array.isArray(payload.productImageSettings)
  ) {
    return Response.json({ error: "Invalid product selection." }, { status: 400 });
  }

  const hiddenProductHandles = payload.hiddenProductHandles.filter(
    (handle): handle is string => typeof handle === "string" && validHandles.has(handle),
  );
  const normalizedImages = normalizeProductImageSettings(payload.productImageSettings);
  const productImageSettings: ProductImageSettings = {};

  for (const [handle, setting] of Object.entries(normalizedImages)) {
    if (!validHandles.has(handle)) continue;
    const originalImage = originalImages.get(handle) ?? null;
    const defaultUrl =
      setting.defaultUrl === originalImage || setting.urls.includes(setting.defaultUrl ?? "")
        ? setting.defaultUrl
        : originalImage;

    if (setting.urls.length || (defaultUrl && defaultUrl !== originalImage)) {
      productImageSettings[handle] = { urls: setting.urls, defaultUrl };
    }
  }

  await replaceMerchandisingSettings({ hiddenProductHandles, productImageSettings });

  return Response.json({ saved: true, hiddenProductHandles, productImageSettings });
}
