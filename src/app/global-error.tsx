"use client";

/**
 * ძირითადი layout-ის შეცდომა — აქ არც ფონტია, არც თარგმანი, არც სტილი გარანტირებული,
 * ამიტომ მარტივი სამენოვანი ტექსტი და ჩაშენებული სტილი.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ka">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0, background: "#fff", color: "#111" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>რაღაც ვერ გამოვიდა · Something went wrong · Что-то пошло не так</h1>
          <p style={{ color: "#666", fontSize: 14 }}>enex.ge</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 8, border: 0, background: "#009cd1", color: "#fff", cursor: "pointer" }}>
            თავიდან · Retry · Повторить
          </button>
        </div>
      </body>
    </html>
  );
}
