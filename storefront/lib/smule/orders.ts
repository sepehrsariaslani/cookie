export const ORDER_DRAFTS_STORAGE_KEY = "smule-order-drafts-v1";

export type DraftOrderProductLine = {
  kind: "product";
  productSlug: string;
  title: string;
  serving: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  ingredients: string[];
  allergens: string[];
};

export type DraftOrderCustomLine = {
  kind: "custom";
  title: string;
  doughId: string;
  baseWeight: number;
  finalWeight: number;
  calories: number;
  toppings: string[];
  quantity: number;
  quoteRequired: true;
};

export type DraftOrderLine = DraftOrderProductLine | DraftOrderCustomLine;

export type SmuleOrderDraft = {
  id: string;
  createdAt: string;
  status: "local-draft" | "sent-to-frappe";
  erpRequestName?: string;
  deliveryMethod: "pickup" | "delivery";
  customer: {
    name: string;
    phone: string;
    city: string;
    address: string;
    note: string;
  };
  lines: DraftOrderLine[];
  readySubtotal: number;
  customQuoteRequired: boolean;
  deliveryAndPaymentNeedConfirmation: true;
};

export function readOrderDrafts(): SmuleOrderDraft[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(ORDER_DRAFTS_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((order): order is SmuleOrderDraft =>
      Boolean(order && typeof order === "object" && typeof order.id === "string" && Array.isArray(order.lines)),
    );
  } catch {
    return [];
  }
}

export function clearOrderDrafts() {
  try {
    localStorage.removeItem(ORDER_DRAFTS_STORAGE_KEY);
    return true;
  } catch {
    // The user can still clear site data through the browser if storage is unavailable here.
    return false;
  }
}

export function getWhatsAppHref(order: SmuleOrderDraft) {
  const configured = process.env.NEXT_PUBLIC_SMULE_WHATSAPP?.replace(/\D/g, "");
  if (!configured) return null;
  const phone = configured.startsWith("0") ? `98${configured.slice(1)}` : configured;
  const itemLines = order.lines.map((line) => line.kind === "product"
    ? `• ${line.title} × ${line.quantity} — ${line.lineTotal.toLocaleString("fa-IR")} تومان`
    : `• ${line.title} × ${line.quantity} — وزن نهایی حدود ${line.finalWeight.toLocaleString("fa-IR")} گرم (قیمت نیازمند تأیید)`);
  const message = [
    `سلام اسموله، برای سفارش ${order.id} پیام می‌دهم.` ,
    `نام: ${order.customer.name}`,
    `تلفن: ${order.customer.phone}`,
    `روش دریافت: ${order.deliveryMethod === "pickup" ? "تحویل حضوری" : "ارسال"}`,
    ...(order.deliveryMethod === "delivery" ? [`شهر: ${order.customer.city}`, `نشانی: ${order.customer.address}`] : []),
    ...itemLines,
    order.customer.note ? `توضیحات: ${order.customer.note}` : "",
    "لطفاً هزینهٔ ارسال و روش پرداخت را هماهنگ کنیم.",
  ].filter(Boolean).join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
