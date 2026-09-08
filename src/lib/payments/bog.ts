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

const OAUTH_URL = "https://oauth.bog.ge/auth/realms/bog/protocol/openid-connect/token";
const ORDERS_URL = "https://api.bog.ge/payments/v1/ecommerce/orders";

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
      external_order_id: input.orderNumber,
      purchase_units: {
        currency: "GEL",
        total_amount: Number(input.amount.toFixed(2)),
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
  const pem = process.env.BOG_PUBLIC_KEY;
  if (!pem || !signature) return false;

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
