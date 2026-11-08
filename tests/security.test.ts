/**
 * უსაფრთხოების წესები: გადამისამართება მხოლოდ საიტის შიგნით, ტოკენების გამიჯვნა,
 * უცნობი როლი არაფერს ხსნის.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT, jwtVerify } from "jose";
import { safePath } from "../src/lib/safe-path";
import { ADMIN_AUD, CUSTOMER_AUD, authSecret, isCustomerPayload } from "../src/lib/auth-secret";
import { canOpen } from "../src/lib/workflow";

test("safePath: გარე მისამართი უარყოფილია", () => {
  assert.equal(safePath("/account/orders?x=1"), "/account/orders?x=1");
  assert.equal(safePath("//evil.com", "/account"), "/account");
  assert.equal(safePath("/\\evil.com", "/account"), "/account");
  assert.equal(safePath("https://evil.com", "/account"), "/account");
  assert.equal(safePath("/%2F%2Fevil.com"), "/%2F%2Fevil.com");
  assert.equal(safePath("javascript:alert(1)", "/"), "/");
  assert.equal(safePath("/a\nb", "/"), "/");
  assert.equal(safePath(undefined, "/admin"), "/admin");
});

test("მყიდველის ტოკენი ადმინის aud-ით არ მოწმდება", async () => {
  const customer = await new SignJWT({ id: "u1", email: "a@b.ge", name: "A", priceTier: "RETAIL" })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(CUSTOMER_AUD)
    .setIssuedAt()
    .sign(authSecret());
  await assert.rejects(jwtVerify(customer, authSecret(), { audience: ADMIN_AUD }));

  // ძველი, aud-მდე გაცემული მყიდველის ტოკენიც (role-ის გარეშე) ადმინად არ გაივლის
  const legacy = await new SignJWT({ id: "u1" }).setProtectedHeader({ alg: "HS256" }).sign(authSecret());
  await assert.rejects(jwtVerify(legacy, authSecret(), { audience: ADMIN_AUD }));
});

test("მყიდველის სივრცეში ადმინის ტოკენი არ მიიღება", () => {
  assert.equal(isCustomerPayload({ aud: CUSTOMER_AUD }), true);
  assert.equal(isCustomerPayload({ id: "u1" }), true); // ძველი მყიდველის ტოკენი
  assert.equal(isCustomerPayload({ aud: ADMIN_AUD, role: "ADMIN" }), false);
  assert.equal(isCustomerPayload({ role: "ADMIN" }), false);
});

test("უცნობი როლი ადმინის გვერდებს ვერ ხსნის", () => {
  assert.equal(canOpen("undefined", "/admin/users"), false);
  assert.equal(canOpen("", "/admin/prices"), false);
  assert.equal(canOpen("ADMIN", "/admin/users"), true);
  assert.equal(canOpen("DELIVERY", "/admin/users"), false);
});
