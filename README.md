# Vineyard Sun storefront

The Vineyard Sun storefront keeps a local copy of the public product catalog,
product photos, and brand assets. Its shopping bag sends selected variants to
the secure hosted checkout.

## Control which products appear

Visit `/admin`, sign in with the password stored in the server-only
`ADMIN_PASSWORD` environment variable, switch products between Visible and
Hidden, and select **Save changes**. Product choices are stored in the site
database and apply to every visitor.

`ADMIN_PASSWORD` must contain at least 12 characters. For local development,
copy `.env.example` to `.env` and replace the example value. For the hosted
site, set it as a secret environment variable in Sites and redeploy.

The fallback file `app/data/merchandising.json` still controls the featured
product and default catalog order:

- `featuredProductHandle`: the product in the large product feature.
- `priorityProductHandles`: products that appear first, in this exact order.

Use the product handle from the product URL. For example, the embroidered pillow
uses `premium-icahn-happiness-is-positive-cashflow-decorative-pillow`.

## Refresh products and images

Run `npm run snapshot:shopify` to refresh the public catalog snapshot, then run
`npm run build` to validate the storefront.
