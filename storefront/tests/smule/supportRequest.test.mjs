import test from "node:test";
import assert from "node:assert/strict";
import { submitSupportRequest } from "../../lib/smule/frappe-client.ts";

test("support message is sent to the ERPNext endpoint with the guest CSRF token", async () => {
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.document = {
    querySelector: (selector) => selector === 'meta[name="frappe-csrf-token"]' ? { content: "csrf-test" } : null,
  };
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ message: { accepted: true, message: "پیام ثبت شد." } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const result = await submitSupportRequest({
      name: "کاربر",
      email: "user@example.com",
      topic: "سایر پرسش‌ها",
      message: "این یک پیام آزمایشی برای تست است.",
      website: "",
    });
    assert.equal(result.accepted, true);
    assert.equal(request.url, "/api/method/smule_store.api.support.submit_support_request");
    assert.equal(request.options.method, "POST");
    assert.equal(request.options.credentials, "same-origin");
    assert.equal(request.options.headers["X-Frappe-CSRF-Token"], "csrf-test");
    assert.equal(new URLSearchParams(request.options.body).get("email"), "user@example.com");
  } finally {
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
  }
});

test("support message is not sent without a CSRF token", async () => {
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  globalThis.document = { querySelector: () => null };
  globalThis.fetch = async () => { throw new Error("fetch must not run without CSRF"); };
  try {
    await assert.rejects(
      submitSupportRequest({ name: "کاربر", email: "user@example.com", topic: "سایر پرسش‌ها", message: "یک متن کافی برای این تست" }),
      /رمز امن/,
    );
  } finally {
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
  }
});
