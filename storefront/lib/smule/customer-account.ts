export type SmuleAccountAddress = {
  name: string;
  address_title: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  is_primary_address: number;
};

export type SmuleAccountOrder = {
  name: string;
  kind: "sales-order" | "order-request";
  status: string;
  date: string;
  deliveryDate?: string;
  requestedForTime?: string | null;
  total: number;
  paid: number;
  currency?: string;
  deliveryStatus?: string;
  requestName?: string | null;
  items: Array<{ title: string; quantity: number; quoteRequired?: boolean }>;
};

export type SmuleAccountPayment = {
  name: string;
  posting_date: string;
  received_amount: number;
  paid_to_account_currency: string;
  mode_of_payment: string;
  status: string;
};

export type SmuleAccountData = {
  authenticated: boolean;
  signupEnabled: boolean;
  signupEmailReady: boolean;
  accountReady?: boolean;
  customerSetupReady?: boolean;
  profile?: { customer: string | null; fullName: string; email: string; phone: string };
  addresses?: SmuleAccountAddress[];
  orders?: SmuleAccountOrder[];
  payments?: SmuleAccountPayment[];
  countries?: string[];
};

type FrappeEnvelope<T> = { message?: T; _server_messages?: string; exception?: string };

function extractError(payload: FrappeEnvelope<unknown>) {
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
      // Fall back to a short Persian message for an unreadable server response.
    }
  }
  return "ارتباط با حساب اسموله برقرار نشد؛ دوباره تلاش کن.";
}

async function readMessage<T>(response: Response): Promise<T> {
  let payload: FrappeEnvelope<T>;
  try {
    payload = await response.json() as FrappeEnvelope<T>;
  } catch {
    throw new Error("پاسخ حساب قابل خواندن نیست.");
  }
  if (!response.ok || payload.message === undefined) throw new Error(extractError(payload));
  return payload.message;
}

function csrfToken() {
  const token = document.querySelector<HTMLMetaElement>('meta[name="frappe-csrf-token"]')?.content;
  if (!token) throw new Error("نشست امن پیدا نشد؛ صفحه را تازه‌سازی کن.");
  return token;
}

async function post(method: string, fields: Record<string, string>, signal?: AbortSignal) {
  const response = await fetch(`/api/method/smule_store.api.customer_portal.${method}`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "X-Frappe-CSRF-Token": csrfToken(),
    },
    body: new URLSearchParams(fields),
    signal,
  });
  return readMessage<SmuleAccountData>(response);
}

export async function fetchCustomerAccount(signal?: AbortSignal) {
  const response = await fetch("/api/method/smule_store.api.customer_portal.get_portal_data", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  return readMessage<SmuleAccountData>(response);
}

export function saveCustomerProfile(profile: { fullName: string; phone: string }, signal?: AbortSignal) {
  return post("update_profile", { profile: JSON.stringify(profile) }, signal);
}

export function saveCustomerAddress(address: {
  name?: string;
  title: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isPrimary: boolean;
}, signal?: AbortSignal) {
  return post("save_address", { address: JSON.stringify(address) }, signal);
}

export function archiveCustomerAddress(name: string, signal?: AbortSignal) {
  return post("archive_address", { name }, signal);
}

export async function logoutCustomer() {
  const response = await fetch("/api/method/logout", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "X-Frappe-CSRF-Token": csrfToken(),
    },
  });
  if (!response.ok) throw new Error("خروج از حساب انجام نشد؛ دوباره تلاش کن.");
  window.location.reload();
}
