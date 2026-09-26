export type FrappeStorefrontCatalog = {
  products: Array<Record<string, unknown>>;
  components: Array<Record<string, unknown>>;
  currency: string | null;
  priceList: string | null;
  ordersEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFee?: number;
  deliveryFeeCollection?: string;
  pickupAddress: string;
  pickupHours: string;
  paymentsEnabled?: boolean;
  pricingMarkupPercent?: number | null;
  customCookieFixedCost?: number | null;
  priceRoundingIncrement?: number;
  customPricingReady?: boolean;
};

export type FrappeOrderResult = {
  name: string;
  status: string;
  readySubtotal: number;
  currency: string | null;
  paymentRequired: boolean;
  paymentUrl?: string;
  payableTotal?: number;
  trackingToken?: string | null;
  requestedForDate?: string | null;
  requestedForTime?: string | null;
};

export type SupportRequestInput = {
  name: string;
  email: string;
  topic: string;
  message: string;
  website?: string;
};

export type SupportRequestResult = {
  accepted: boolean;
  message: string;
};

export type ZarinpalRetryResult = {
  name: string;
  paymentRequired: boolean;
  paymentUrl: string;
  payableTotal: number;
  currency: string | null;
};

export type GuestOrderStatus = {
  name: string;
  status: string;
  createdAt: string;
  deliveryMethod: string;
  deliveryStatus?: string;
  requestedForDate?: string | null;
  requestedForTime?: string | null;
  readySubtotal: number;
  currency: string | null;
  paymentRequired: boolean;
  paymentStatus?: string;
  paymentAmount?: number;
  items: Array<{ title: string; quantity: number; quoteRequired: boolean }>;
};

type FrappeEnvelope<T> = { message?: T; _server_messages?: string; exception?: string };

function getServerMessage(payload: FrappeEnvelope<unknown>) {
  if (typeof payload.message === "string") return payload.message;
  if (payload._server_messages) {
    try {
      const [message] = JSON.parse(payload._server_messages) as string[];
      if (message) {
        try {
          return (JSON.parse(message) as { message?: string }).message ?? message;
        } catch {
          return message;
        }
      }
    } catch {
      // Use the standard fallback when the server message envelope is malformed.
    }
  }
  return "ارتباط با فروشگاه برقرار نشد؛ چند لحظهٔ دیگر دوباره تلاش کن.";
}

async function readMessage<T>(response: Response): Promise<T> {
  let payload: FrappeEnvelope<T>;
  try {
    payload = await response.json() as FrappeEnvelope<T>;
  } catch {
    throw new Error("پاسخ فروشگاه قابل خواندن نیست.");
  }
  if (!response.ok || payload.message === undefined) throw new Error(getServerMessage(payload));
  return payload.message;
}

export async function fetchStorefrontCatalog(signal?: AbortSignal) {
  const response = await fetch("/api/method/smule_store.api.storefront.get_catalog", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  return readMessage<FrappeStorefrontCatalog>(response);
}

export async function sendOrderRequest(order: Record<string, unknown>, signal?: AbortSignal) {
  const token = document.querySelector<HTMLMetaElement>('meta[name="frappe-csrf-token"]')?.content;
  if (!token) throw new Error("رمز امن ارتباط با فروشگاه پیدا نشد؛ صفحه را تازه‌سازی کن.");

  const response = await fetch("/api/method/smule_store.api.orders.create_order_request", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "X-Frappe-CSRF-Token": token,
    },
    body: new URLSearchParams({ order: JSON.stringify(order) }),
    signal,
  });
  return readMessage<FrappeOrderResult>(response);
}

export async function submitSupportRequest(input: SupportRequestInput, signal?: AbortSignal) {
  const token = document.querySelector<HTMLMetaElement>('meta[name="frappe-csrf-token"]')?.content;
  if (!token) throw new Error("رمز امن ارتباط با فروشگاه پیدا نشد؛ صفحه را تازه‌سازی کن.");

  const response = await fetch("/api/method/smule_store.api.support.submit_support_request", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "X-Frappe-CSRF-Token": token,
    },
    body: new URLSearchParams(input),
    signal,
  });
  return readMessage<SupportRequestResult>(response);
}

export async function fetchGuestOrderStatus(token: string, signal?: AbortSignal) {
  const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="frappe-csrf-token"]')?.content;
  if (!csrfToken) throw new Error("نشست امن پیدا نشد؛ صفحه را تازه‌سازی کن.");

  const response = await fetch("/api/method/smule_store.api.orders.get_guest_order_status", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "X-Frappe-CSRF-Token": csrfToken,
    },
    body: new URLSearchParams({ token }),
    signal,
  });
  return readMessage<GuestOrderStatus>(response);
}

export async function retryZarinpalPayment(
  input: { trackingToken: string } | { orderRequestName: string },
  signal?: AbortSignal,
) {
  const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="frappe-csrf-token"]')?.content;
  if (!csrfToken) throw new Error("نشست امن پیدا نشد؛ صفحه را تازه‌سازی کن.");

  const body = new URLSearchParams();
  if ("trackingToken" in input) body.set("token", input.trackingToken);
  else body.set("order_name", input.orderRequestName);
  const response = await fetch("/api/method/smule_store.api.payments.retry_zarinpal_payment", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "X-Frappe-CSRF-Token": csrfToken,
    },
    body,
    signal,
  });
  return readMessage<ZarinpalRetryResult>(response);
}
