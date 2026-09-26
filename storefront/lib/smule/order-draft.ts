import {
  calculateCookieNutrition,
  DOUGHS,
  getToppingName,
  type DoughId,
  type ToppingId,
} from "./cookie-builder";
import type { DraftOrderLine, SmuleOrderDraft } from "./orders";
import { formatPersianNumber, getSmuleProduct, SMULE_PRODUCTS, type SmuleProduct } from "./products";

type DraftCartLine =
  | { kind: "product"; productSlug: string; quantity: number }
  | { kind: "custom"; doughId: DoughId; sizeGrams: number; toppingIds: ToppingId[]; quantity: number };

type DraftCustomer = {
  name: string;
  phone: string;
  city: string;
  address: string;
  note: string;
};

type BuildLocalOrderInput = {
  items: DraftCartLine[];
  customer: DraftCustomer;
  deliveryMethod: "pickup" | "delivery";
  requestedForDate?: string;
  requestedForTime?: string;
  createdAt?: Date;
  id?: string;
  products?: SmuleProduct[];
};

export function isCheckoutAvailable({
	itemCount,
	allItemsPriced,
	ordersEnabled,
}: {
	itemCount: number;
	allItemsPriced: boolean;
	ordersEnabled: boolean;
}) {
	return itemCount > 0 && allItemsPriced && ordersEnabled;
}

function normalizeQuantity(quantity: number) {
  return Number.isFinite(quantity) && quantity >= 1 ? Math.floor(quantity) : null;
}

export function getReadySubtotal(items: DraftCartLine[], products: SmuleProduct[] = SMULE_PRODUCTS) {
  return items.reduce((total, item) => {
    if (item.kind !== "product") return total;
    const product = getSmuleProduct(item.productSlug, products);
    const quantity = normalizeQuantity(item.quantity);
    return product && !product.isSample && quantity ? total + product.price * quantity : total;
  }, 0);
}

export function buildLocalOrderDraft({ items, customer, deliveryMethod, requestedForDate = "", requestedForTime = "", createdAt = new Date(), id, products = SMULE_PRODUCTS }: BuildLocalOrderInput): SmuleOrderDraft | null {
  if (!items.length) return null;

  const lines: DraftOrderLine[] = [];
  for (const item of items) {
    const quantity = normalizeQuantity(item.quantity);
    if (!quantity) return null;

    if (item.kind === "product") {
      const product = getSmuleProduct(item.productSlug, products);
      if (!product || product.isSample) return null;
      lines.push({
        kind: "product",
        productSlug: product.slug,
        title: product.name,
        serving: product.serving,
        quantity,
        unitPrice: product.price,
        lineTotal: product.price * quantity,
        ingredients: product.ingredients,
        allergens: product.allergens,
      });
      continue;
    }

    const dough = DOUGHS.find((option) => option.id === item.doughId) ?? DOUGHS[0];
    const nutrition = calculateCookieNutrition(dough.id, item.toppingIds, item.sizeGrams);
    lines.push({
      kind: "custom",
      title: `${dough.name}، بیس ${formatPersianNumber(nutrition.baseWeight)} گرمی`,
      doughId: dough.id,
      baseWeight: nutrition.baseWeight,
      finalWeight: nutrition.weight,
      calories: nutrition.calories,
      toppings: [...new Set(item.toppingIds)].map(getToppingName),
      quantity,
      quoteRequired: true,
    });
  }

  const createdAtIso = createdAt.toISOString();
  const orderId = id ?? `SM-${createdAtIso.slice(2, 10).replaceAll("-", "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  return {
    id: orderId,
    createdAt: createdAtIso,
    status: "local-draft",
    deliveryMethod,
    requestedForDate: requestedForDate || undefined,
    requestedForTime: requestedForDate ? requestedForTime || undefined : undefined,
    customer: {
      name: customer.name.trim(),
      phone: customer.phone.trim(),
      city: deliveryMethod === "delivery" ? customer.city.trim() : "",
      address: deliveryMethod === "delivery" ? customer.address.trim() : "",
      note: customer.note.trim(),
    },
    lines,
    readySubtotal: lines.reduce((total, line) => line.kind === "product" ? total + line.lineTotal : total, 0),
    customQuoteRequired: lines.some((line) => line.kind === "custom"),
    deliveryAndPaymentNeedConfirmation: true,
  };
}
