import { Storefront } from "./Storefront";
import { getMerchandisingSettings } from "../db/merchandising";
import { getSyncedCatalogProducts } from "../db/synced-products";
import type { Metadata } from "next";

export const metadata: Metadata = { alternates: { canonical: "https://www.vineyardsun.com/" } };

export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ hiddenProductHandles, productImageSettings }, syncedProducts] =
    await Promise.all([
      getMerchandisingSettings(),
      getSyncedCatalogProducts().catch(() => []),
    ]);
  return (
    <Storefront
      initialHiddenHandles={hiddenProductHandles}
      initialProductImageSettings={productImageSettings}
      initialSyncedProducts={syncedProducts}
    />
  );
}
