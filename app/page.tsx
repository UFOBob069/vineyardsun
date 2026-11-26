import { configuredShippingCents } from "./lib/shipping";
import { Storefront } from "./Storefront";
import { getMerchandisingSettings } from "../db/merchandising";
import { getSyncedCatalogProducts } from "../db/synced-products";
import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "Discover Vineyard Sun cork eyewear and bespoke sunglasses for vineyards and wineries. Working with vineyards worldwide since 2016.",
  alternates: { canonical: "https://www.vineyardsun.com/" },
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ hiddenProductHandles, productImageSettings }, syncedProducts] =
    await Promise.all([
      getMerchandisingSettings(),
      getSyncedCatalogProducts().catch(() => []),
    ]);
  return (
    <Storefront
      shippingCents={configuredShippingCents()}
      initialHiddenHandles={hiddenProductHandles}
      initialProductImageSettings={productImageSettings}
      initialSyncedProducts={syncedProducts}
    />
  );
}
