export type FrappeStorefrontCatalog = {
  products: Array<Record<string, unknown>>;
  components: Array<Record<string, unknown>>;
  currency: string | null;
  priceList: string | null;
  ordersEnabled: boolean;
  deliveryEnabled: boolean;
  pickupAddress: string;
  pickupHours: string;
};

export type FrappeOrderResult = {
  name: string;
  status: string;
  readySubtotal: number;
  currency: string | null;
  paymentRequired: false;
  requestedForDate?: string | null;
  requestedForTime?: string | null;
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
