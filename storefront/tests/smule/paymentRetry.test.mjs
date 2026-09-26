import test from "node:test";
import assert from "node:assert/strict";
import { getSafeZarinpalPaymentUrl } from "../../lib/smule/payment.ts";

test("payment redirects are restricted to HTTPS ZarinPal StartPay URLs", () => {
  assert.equal(
    getSafeZarinpalPaymentUrl("https://payment.zarinpal.com/pg/StartPay/AAAAAAAA1234")?.origin,
    "https://payment.zarinpal.com",
  );
  assert.equal(
    getSafeZarinpalPaymentUrl("https://sandbox.zarinpal.com/pg/StartPay/authority_1234")?.hostname,
    "sandbox.zarinpal.com",
  );
  for (const url of [
    "http://payment.zarinpal.com/pg/StartPay/AAAAAAAA1234",
    "https://payment.zarinpal.com.evil.test/pg/StartPay/AAAAAAAA1234",
    "https://user@payment.zarinpal.com/pg/StartPay/AAAAAAAA1234",
    "https://payment.zarinpal.com:8443/pg/StartPay/AAAAAAAA1234",
    "https://payment.zarinpal.com/other/AAAAAAAA1234",
    "not a URL",
  ]) {
    assert.equal(getSafeZarinpalPaymentUrl(url), null, url);
  }
});
