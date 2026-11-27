// These are the confirmed retail terms on /shipping-returns. Custom winery
// projects are quoted separately and are not represented by retail Offers.
export const CONSUMER_RETURN_DAYS = 30;
const policyUrl = "https://www.vineyardsun.com/shipping-returns";

export function merchantOfferPolicies(shippingCents: number) {
  return {
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" },
      shippingRate: { "@type": "MonetaryAmount", value: shippingCents / 100, currency: "USD" },
      shippingSettingsLink: policyUrl,
      // The published 4–12 business days is an overall delivery estimate.
      // Do not mislabel it as transit time or invent a handling-time split.
    },
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "US",
      returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
      merchantReturnDays: CONSUMER_RETURN_DAYS,
      returnMethod: "https://schema.org/ReturnByMail",
      merchantReturnLink: policyUrl,
      // Return postage is arranged with the customer, not promised free.
    },
  };
}
