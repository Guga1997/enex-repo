/**
 * ძებნა რეგისტრის გარეშე.
 *
 * PostgreSQL-ის LIKE რეგისტრს ითვალისწინებს: „bluetti“ ვერ პოულობს „Bluetti“-ს.
 * Prisma-ს `mode: "insensitive"` ამას ხსნის, მაგრამ SQLite-ზე (დეველოპმენტის ბაზა)
 * ასეთი არგუმენტი საერთოდ არ არსებობს — ამიტომ ბაზის მიხედვით ვწყვეტთ.
 * SQLite-ის LIKE ლათინურზე ისედაც რეგისტრს არ არჩევს.
 */
const IS_POSTGRES = (process.env.DATABASE_URL ?? "").startsWith("postgres");

export function ci(value: string) {
  return IS_POSTGRES ? { contains: value, mode: "insensitive" as const } : { contains: value };
}

/** ზუსტი დამთხვევა რეგისტრის გარეშე (კოდი „np65-12/g“ = „NP65-12/G“) */
export function ciEquals(value: string) {
  return IS_POSTGRES ? { equals: value, mode: "insensitive" as const } : { equals: value };
}
