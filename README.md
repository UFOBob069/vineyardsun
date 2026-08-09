# Vineyard Sun storefront

The Vineyard Sun storefront keeps a local copy of the public product catalog,
product photos, and brand assets. Its shopping bag sends selected variants to
the secure hosted checkout.

## Control which products appear

Open `app/data/merchandising.json` in GitHub and use the pencil button to edit:

- `featuredProductHandle`: the product in the large opening feature.
- `catalogProductHandles`: an exact allowlist. Leave it empty to show all products.
- `hiddenProductHandles`: products to hide even if they are in the allowlist.
- `priorityProductHandles`: products that appear first, in this exact order.

Use the product handle from the product URL. For example, the embroidered pillow
uses `premium-icahn-happiness-is-positive-cashflow-decorative-pillow`.

After committing an edit, ask Codex to publish the Vineyard Sun merchandising
change. The layout does not need to be edited.

## Refresh products and images

Run `npm run snapshot:shopify` to refresh the public catalog snapshot, then run
`npm run build` to validate the storefront.
