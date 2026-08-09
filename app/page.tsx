import { Storefront } from "./Storefront";
import { getMerchandisingSettings } from "../db/merchandising";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { hiddenProductHandles, productImageSettings } = await getMerchandisingSettings();
  return (
    <Storefront
      initialHiddenHandles={hiddenProductHandles}
      initialProductImageSettings={productImageSettings}
    />
  );
}
