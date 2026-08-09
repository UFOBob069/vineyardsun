import { Storefront } from "./Storefront";
import { getHiddenProductHandles } from "../db/merchandising";

export const dynamic = "force-dynamic";

export default async function Home() {
  return <Storefront initialHiddenHandles={await getHiddenProductHandles()} />;
}
