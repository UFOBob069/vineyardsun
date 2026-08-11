# Vineyard Sun storefront

The Vineyard Sun storefront keeps a local copy of the public product catalog,
product photos, and brand assets. Its shopping bag creates a server-validated
Stripe Checkout Session. Paid Printful items are then submitted automatically
to the Vineyard Sun Printful store by a verified Stripe webhook.

## Control which products appear

Visit `/admin`, sign in with the password stored in the server-only
`ADMIN_PASSWORD` environment variable, switch products between Visible and
Hidden, and select **Save changes**. Product choices are stored in the site
database and apply to every visitor.

For local development, copy `.env.example` to `.env.local` and replace the
example values. For the hosted site, set the variables in Vercel and redeploy.

The fallback file `app/data/merchandising.json` still controls the featured
product and default catalog order:

- `featuredProductHandle`: the product in the large product feature.
- `priorityProductHandles`: products that appear first, in this exact order.

Use the product handle from the product URL. For example, the embroidered pillow
uses `premium-icahn-happiness-is-positive-cashflow-decorative-pillow`.

## Product catalogs and images

Run `npm run snapshot:shopify` to refresh the public catalog snapshot, then run
`npm run build` to validate the storefront.

Legacy products remain in the local catalog and keep their existing
Shopify-linked Printful variant IDs. New products live only in the Manual/API
store named **David's Store** (`18593823`). In `/admin`, select **Sync David's
Store** after adding or changing a product in Printful. The sync:

- reads only store `18593823` and never writes to any Printful product store;
- imports Printful product names, variants, retail prices, availability, and
  preview images into `printful_synced_products` in Neon;
- adds new products as Hidden so they cannot be purchased before review;
- preserves Vineyard Sun titles, descriptions, categories, custom images,
  visibility, and price overrides on later syncs.

Open an imported product in `/admin` to complete its storefront description,
choose its image and prices, switch it to Visible, and save. A removed Printful
product is deactivated on the next sync instead of being deleted from Neon.

## Stripe checkout and Printful fulfillment

The browser sends only product IDs, variant IDs, and quantities to
`POST /api/checkout`. The server looks up current prices and availability from
the catalog, writes a pending order to Neon, and creates the Stripe Checkout
Session. This prevents a buyer from changing a price in the browser.

Stripe sends paid sessions to `POST /api/stripe/webhook`. The route verifies the
raw request using `STRIPE_WEBHOOK_SECRET`, records the payment, and submits only
the `printful` lines to Printful with `confirm=1`. Legacy products use their existing
Shopify `external_variant_id`; products imported from David's Store use their
native `sync_variant_id`. A mixed cart is split into one idempotent Printful
order per store. Locally stocked lines remain marked for manual shipping.

Required Stripe webhook events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Production checklist:

- Replace the test `STRIPE_SECRET_KEY` with an `sk_live_...` key.
- Create the same webhook endpoint in Stripe live mode and use its live
  `whsec_...` value. Test and live webhook secrets are different.
- Add a valid Printful billing method; automatic confirmation charges the
  Printful account for manufacturing and shipping.
- Set `NEXT_PUBLIC_SITE_URL` to the production storefront origin.
- Set `SHIPPING_RATE_CENTS` to the flat shipping amount charged to the buyer.
- Activate Stripe Tax, finish its default product/tax settings, and then set
  `STRIPE_AUTOMATIC_TAX=true` if automatic sales-tax calculation is desired.

Stripe test sessions are recorded but never sent to the real Printful account
unless `PRINTFUL_ALLOW_TEST_ORDERS=true` is explicitly set.
