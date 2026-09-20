/**
 * საქართველოს ბანკის (BOG) ონლაინ ეკვაირინგი — E-Commerce API v1.
 *
 * გასააქტიურებლად:
 *   1. ბანკიდან მიიღე merchant client_id / client_secret
 *   2. ჩაწერე .env-ში BOG_CLIENT_ID / BOG_CLIENT_SECRET
 *   3. წაშალე PAYMENT_MOCK ცვლადი (ან დააყენე 0)
 *
 * სანამ გასაღებები არ არის, მოდული mock რეჟიმში მუშაობს:
 * ქმნის ლოკალურ "გადახდის გვერდს" /payment/mock, რომ checkout-ის მთელი
 * ნაკადი ტესტირებადი იყოს ბანკის გარეშე.
 */

const OAUTH_URL = "https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token";
const ORDERS_URL = "https://api.bog.ge/payments/v1/ecommerce/orders";
const RECEIPT_URL = "https://api.bog.ge/payments/v1/receipt";

/**
 * ბანკის საჯარო გასაღები callback-ის ხელმოწერისთვის — api.bog.ge/docs/payments/standard-process/callback.
 * ერთია ყველა ბიზნესისთვის; BOG_PUBLIC_KEY ცვლადით შეიცვლება, თუ ბანკმა როტაცია გააკეთა.
 */
const BOG_PUBLIC_KEY_DEFAULT = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu4RUyAw3+CdkS3ZNILQh
zHI9Hemo+vKB9U2BSabppkKjzjjkf+0Sm76hSMiu/HFtYhqWOESryoCDJoqffY0Q
1VNt25aTxbj068QNUtnxQ7KQVLA+pG0smf+EBWlS1vBEAFbIas9d8c9b9sSEkTrr
TYQ90WIM8bGB6S/KLVoT1a7SnzabjoLc5Qf/SLDG5fu8dH8zckyeYKdRKSBJKvhx
tcBuHV4f7qsynQT+f2UYbESX/TLHwT5qFWZDHZ0YUOUIvb8n7JujVSGZO9/+ll/g
4ZIWhC1MlJgPObDwRkRd8NFOopgxMcMsDIZIoLbWKhHVq67hdbwpAq9K9WMmEhPn
PwIDAQAB
-----END PUBLIC KEY-----`;

export function isMockMode(): boolean {
  return (
    process.env.PAYMENT_MOCK === "1" ||
    !process.env.BOG_CLIENT_ID ||
    !process.env.BOG_CLIENT_SECRET
  );
}

async function getAccessToken(): Promise<string> {
  const basic = Buffer.from(
    `${process.env.BOG_CLIENT_ID}:${process.env.BOG_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(OAUTH_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`BOG ავტორიზაცია ჩავარდა: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export type PaymentBasketItem = {
  productId: string;
  name: string;
  qty: number;
  price: number;
};

export type CreatePaymentInput = {
  orderId: string; // ჩვენი შიდა შეკვეთის id
  orderNumber: string;
  amount: number; // სრული თანხა ლარებში
  items: PaymentBasketItem[];
  siteUrl: string;
  deliveryFee?: number;
  /** რამდენ წუთში უნდა გადაიხადოს — რეზერვაციის ვადას ემთხვევა */
  ttlMinutes?: number;
  buyer?: { name: string; email: string; phone: string };
};

export type CreatePaymentResult = { paymentId: string; redirectUrl: string };

export async function createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  if (isMockMode()) {
    return {
      paymentId: `mock_${input.orderId}`,
      redirectUrl: `${input.siteUrl}/payment/mock?order=${input.orderId}`,
    };
  }

  const token = await getAccessToken();

  const res = await fetch(ORDERS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept-Language": "ka",
    },
    body: JSON.stringify({
      callback_url: `${input.siteUrl}/api/payments/bog/callback`,
      // პირველი 25 სიმბოლო ამონაწერში ჩანს — შეკვეთის ნომერი ზუსტად ამისთვისაა
      external_order_id: input.orderNumber,
      ttl: Math.min(1440, Math.max(2, input.ttlMinutes ?? 15)),
      ...(input.buyer
        ? { buyer: { full_name: input.buyer.name, masked_email: input.buyer.email, masked_phone: input.buyer.phone } }
        : {}),
      purchase_units: {
        currency: "GEL",
        total_amount: Number(input.amount.toFixed(2)),
        ...(input.deliveryFee ? { delivery: { amount: Number(input.deliveryFee.toFixed(2)) } } : {}),
        basket: input.items.map((i) => ({
          product_id: i.productId,
          description: i.name.slice(0, 100),
          quantity: i.qty,
          unit_price: Number(i.price.toFixed(2)),
        })),
      },
      redirect_urls: {
        success: `${input.siteUrl}/order/${input.orderId}?paid=1`,
        fail: `${input.siteUrl}/order/${input.orderId}?failed=1`,
      },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`BOG შეკვეთის შექმნა ჩავარდა: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    id: string;
    _links: { redirect: { href: string } };
  };

  return { paymentId: data.id, redirectUrl: data._links.redirect.href };
}

export type BogOrderStatus =
  | "created" | "processing" | "completed" | "rejected"
  | "refund_requested" | "refunded" | "refunded_partially"
  | "auth_requested" | "blocked" | "partial_completed";

/**
 * გადახდის დეტალები ბანკიდან — callback რომ არ მოვიდეს (ქსელი, ჩვენი გადატვირთვა),
 * მყიდველის დაბრუნებისას სტატუსს პირდაპირ ვამოწმებთ. დოკუმენტაცია ამას ითხოვს.
 */
export async function fetchPaymentStatus(paymentId: string): Promise<{ key: BogOrderStatus; raw: unknown } | null> {
  if (isMockMode()) return null;
  const token = await getAccessToken();
  const res = await fetch(`${RECEIPT_URL}/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const raw = (await res.json()) as { order_status?: { key?: BogOrderStatus } };
  return raw.order_status?.key ? { key: raw.order_status.key, raw } : null;
}

/**
 * Callback-ის ხელმოწერის შემოწმება.
 *
 * BOG აგზავნის `Callback-Signature` ჰედერს — RSA-SHA256 ხელმოწერას სხეულზე,
 * მისივე საჯარო გასაღებით. საჯარო გასაღები ბანკის დოკუმენტაციიდან ჩასვი
 * BOG_PUBLIC_KEY ცვლადში (PEM ფორმატში).
 *
 * სანამ გასაღები არ არის მითითებული, ვაბრუნებთ false და callback-ს ვაგდებთ —
 * გადახდის სტატუსს ვამოწმებთ მხოლოდ ბანკის მხრიდან დადასტურებით.
 */
export function verifyCallbackSignature(rawBody: string, signature: string | null): boolean {
  const pem = process.env.BOG_PUBLIC_KEY?.trim() || BOG_PUBLIC_KEY_DEFAULT;
  if (!signature) return false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createVerify } = require("crypto") as typeof import("crypto");
    const verifier = createVerify("SHA256");
    verifier.update(rawBody);
    verifier.end();
    return verifier.verify(pem, signature, "base64");
  } catch {
    return false;
  }
}
