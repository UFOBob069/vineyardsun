export const MAX_CUSTOM_IMAGES_PER_PRODUCT = 12;

export type ProductImageSetting = {
  urls: string[];
  defaultUrl: string | null;
};

export type ProductImageSettings = Record<string, ProductImageSetting>;

export function normalizeRemoteImageUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return null;

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

function normalizeImageSource(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^\/products\/[a-zA-Z0-9._/-]+$/.test(trimmed)) return trimmed;
  return normalizeRemoteImageUrl(trimmed);
}

export function normalizeProductImageSettings(value: unknown): ProductImageSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const normalized: ProductImageSettings = {};
  for (const [handle, rawSetting] of Object.entries(value)) {
    if (!rawSetting || typeof rawSetting !== "object" || Array.isArray(rawSetting)) continue;

    const setting = rawSetting as { urls?: unknown; defaultUrl?: unknown };
    const urls = Array.isArray(setting.urls)
      ? [...new Set(setting.urls.map(normalizeRemoteImageUrl).filter((url): url is string => Boolean(url)))].slice(
          0,
          MAX_CUSTOM_IMAGES_PER_PRODUCT,
        )
      : [];
    const defaultUrl = normalizeImageSource(setting.defaultUrl);

    if (defaultUrl?.startsWith("https://") && !urls.includes(defaultUrl)) {
      urls.unshift(defaultUrl);
      if (urls.length > MAX_CUSTOM_IMAGES_PER_PRODUCT) urls.pop();
    }

    if (urls.length || defaultUrl) normalized[handle] = { urls, defaultUrl };
  }

  return normalized;
}
