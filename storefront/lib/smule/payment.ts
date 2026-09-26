const ZARINPAL_PAYMENT_ORIGINS = new Set([
  "https://payment.zarinpal.com",
  "https://sandbox.zarinpal.com",
]);

export function getSafeZarinpalPaymentUrl(value: string | undefined | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      !ZARINPAL_PAYMENT_ORIGINS.has(url.origin)
      || url.username
      || url.password
      || !/^\/pg\/StartPay\/[A-Za-z0-9_-]{8,64}$/.test(url.pathname)
    ) return null;
    return url;
  } catch {
    return null;
  }
}
