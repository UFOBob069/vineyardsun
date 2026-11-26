export function configuredShippingCents() {
  const configured = Number(process.env.SHIPPING_RATE_CENTS || "595");
  if (!Number.isSafeInteger(configured) || configured < 0 || configured > 100_000) throw new Error("SHIPPING_RATE_CENTS is invalid.");
  return configured;
}
export const deliveryEstimate = { minimum: { unit: "business_day" as const, value: 4 }, maximum: { unit: "business_day" as const, value: 12 } };
