import { Storefront } from "./Storefront";
import { getMerchandisingSettings } from "../db/merchandising";
import { getSyncedCatalogProducts } from "../db/synced-products";

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
