export const MAX_CART_LINES = 30;
export const MAX_CART_LINE_QUANTITY = 20;

export type CartAddResult = "added" | "quantity-limit" | "line-limit";

type CartLineLike = {
  configKey: string;
  quantity: number;
};

export function normalizeCartQuantity(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.min(MAX_CART_LINE_QUANTITY, Math.max(1, Math.floor(value)));
}

export function getCartAddResult<T extends CartLineLike>(items: T[], configKey: string): CartAddResult {
  const existing = items.find((item) => item.configKey === configKey);
  if (existing) return existing.quantity >= MAX_CART_LINE_QUANTITY ? "quantity-limit" : "added";
  return items.length >= MAX_CART_LINES ? "line-limit" : "added";
}

export function addCartLine<T extends CartLineLike>(items: T[], line: T): { items: T[]; result: CartAddResult } {
  const result = getCartAddResult(items, line.configKey);
  if (result !== "added") return { items, result };

  const existing = items.find((item) => item.configKey === line.configKey);
  if (!existing) return { items: [...items, line], result };

  return {
    items: items.map((item) => item === existing ? { ...item, quantity: item.quantity + 1 } : item),
    result,
  };
}
