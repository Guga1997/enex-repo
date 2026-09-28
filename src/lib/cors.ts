/**
 * CORS /api/v1/*-ისთვის — middleware-ში ერთ ადგილას.
 *
 * კონფიგურატორის აპლიკაცია ლოკალური ფაილიდან (origin „null“) ან სხვა დომენიდან
 * მიმართავს API-ს, ამიტომ ბრაუზერი ჯერ preflight-ს აგზავნის. წვდომა API
 * გასაღებით კონტროლდება (cookie არ მონაწილეობს), ამიტომ ნებისმიერი origin
 * დასაშვებია, credentials კი — არა.
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,X-API-Key,Content-Type",
  "Access-Control-Max-Age": "86400",
};

export const isApiV1 = (pathname: string) => pathname.startsWith("/api/v1/");
