export type CartLine = { productId: number; productHandle: string; variantId: number; quantity: number };
export const CART_STORAGE_KEY = "vineyard-sun-cart-v1";
export function sameLine(a: CartLine, b: CartLine) {
  return a.productId === b.productId && a.variantId === b.variantId && (!a.productHandle || !b.productHandle || a.productHandle === b.productHandle);
}
export function parseCart(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  const result: CartLine[] = [];
  for (const line of value.slice(0, 50)) {
    if (!line || !Number.isSafeInteger(line.productId) || line.productId <= 0 || !Number.isSafeInteger(line.variantId) || line.variantId <= 0 || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) continue;
    const clean = { productId: line.productId, variantId: line.variantId, productHandle: typeof line.productHandle === "string" ? line.productHandle.slice(0, 140) : "", quantity: Math.min(10, line.quantity) };
    const existing = result.find(item => sameLine(item, clean));
    if (existing) existing.quantity = Math.min(10, existing.quantity + clean.quantity);
    else result.push(clean);
  }
  return result;
}
export function addCartLine(cart: CartLine[], line: CartLine): CartLine[] { return parseCart([...cart, line]); }
export function removePurchasedLines(cart: CartLine[], purchased: CartLine[]): CartLine[] {
  return cart.map(line => ({ ...line, quantity: line.quantity - purchased.filter(p => sameLine(line, p)).reduce((sum, p) => sum + p.quantity, 0) })).filter(line => line.quantity > 0);
}
