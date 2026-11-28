// These are the confirmed retail terms on /shipping-returns. Custom winery
// projects are quoted separately and are not represented by retail Offers.
export const CONSUMER_RETURN_DAYS = 30;
const policyUrl = "https://www.vineyardsun.com/shipping-returns";

export function retailDeliveryTiming(madeToOrder: boolean) {
  const handling = madeToOrder ? { min: 2, max: 5 } : { min: 1, max: 2 };
  const transit = { min: 3, max: 7 };
  return { handling, transit, total: { min: handling.min + transit.min, max: handling.max + transit.max } };
}

export function merchantOfferPolicies(shippingCents: number, madeToOrder: boolean) {
  const { handling, transit } = retailDeliveryTiming(madeToOrder);
  return {
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" },
      shippingRate: { "@type": "MonetaryAmount", value: shippingCents / 100, currency: "USD" },
      shippingSettingsLink: policyUrl,
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: { "@type": "QuantitativeValue", minValue: handling.min, maxValue: handling.max, unitCode: "DAY" },
        transitTime: { "@type": "QuantitativeValue", minValue: transit.min, maxValue: transit.max, unitCode: "DAY" },
        businessDays: {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(day => `https://schema.org/${day}`),
        },
      },
    },
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "US",
      returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
      merchantReturnDays: CONSUMER_RETURN_DAYS,
      returnMethod: "https://schema.org/ReturnByMail",
      merchantReturnLink: policyUrl,
      returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
    },
  };
}
