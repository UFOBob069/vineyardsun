# Vineyard Sun storefront

## Google discovery and product listings

- `/sitemap.xml` includes the home page and every visible product page.
- `/robots.txt` points crawlers to the sitemap and excludes admin, API and order paths.
- `/google-shopping.xml` is the Merchant Center scheduled-fetch feed (English, USD, United States).
- `/products/{handle}?variant={id}` shows the exact variant price, image and availability, with Product/Offer structured data and direct checkout.

The sitemap and feed read current database visibility and pricing. They exclude hidden
products and fail instead of publishing an empty feed during database outages.
Printful sync preserves color, size and preview images for new products. The existing
catalog's variant previews are snapshotted in `app/data/google-product-details.json`.
New apparel without a matching photo, color and size is held out of the feed until
those details are available. GTINs and manufacturer part numbers are not fabricated.

The Google Search Console DNS verification TXT record must remain in Vercel DNS.
Merchant Center still requires its own account setup, website claim, business details,
shipping/returns settings and Google review; publishing the feed alone does not
activate Shopping listings.

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

## Conversion tools and testing

The shared shopping bag persists across product pages and the homepage. A paid
bag checkout removes only purchased quantities; direct purchases leave the bag
alone. Pending, failed, and canceled payments do not clear it.

Custom winery enquiries are saved in Neon before the visitor sees confirmation.
Visit `/admin/conversions` after signing in to review leads, update their status,
and see retail/wholesale event counts from the last 30 days. **Email notifications
are not configured; check the inbox for new enquiries.** Client events exclude
contact details and URL queries. Purchase events come from verified Stripe
webhooks, are deduplicated, and exclude test payments from the report.

`/shipping-returns` contains the consumer 30-day return guidance and separately
quoted custom-order terms. Shipping prices use `SHIPPING_RATE_CENTS` throughout
the bag, policy, product pages, and Stripe Checkout.

Run `npm test` for the production build and regression tests. To include the
local API/database/Stripe integration test, start the development server with
`CONVERSION_TEST_MODE=true`, then run the tests with
`TEST_BASE_URL=http://localhost:3017`. The integration test requires a Stripe
test key, refuses non-local targets, and cleans up the records it creates. It
does not make a payment or send a fulfillment order. Preview/local analytics
and enquiries are marked as tests and omitted from production reports.

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
