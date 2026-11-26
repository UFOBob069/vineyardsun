import type { Metadata } from "next";
import { ConversionAdmin } from "./ConversionAdmin";
export const metadata: Metadata = { title: "Enquiries & conversions | Vineyard Sun", robots: { index: false, follow: false } };
export default function Page() { return <ConversionAdmin />; }
