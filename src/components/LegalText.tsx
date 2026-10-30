import type { ReactNode } from "react";

/**
 * იურიდიული ტექსტის მარტივი მარკაპი — ბლოკები ცარიელი სტრიქონით გამოიყოფა:
 *   ## სათაური · - სია · + დანომრილი სია · | უჯრა | უჯრა | (პირველი სტრიქონი — თავი)
 *   **მუქი** და *დახრილი* — სტრიქონის შიგნით.
 */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
    part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong>
    : part.startsWith("*") && part.length > 2 ? <em key={i}>{part.slice(1, -1)}</em>
    : part
  );
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export default function LegalText({ body }: { body: string }) {
  const blocks = body.trim().split(/\n\s*\n/);
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        const first = lines[0] ?? "";
        if (first.startsWith("## ")) {
          return <h2 key={i} className="pt-4 text-base font-semibold">{first.slice(3)}</h2>;
        }
        if (first.startsWith("- ") || first.startsWith("+ ")) {
          const items = lines.map((l) => <li key={l}>{inline(l.slice(2))}</li>);
          return first.startsWith("+ ")
            ? <ol key={i} className="list-decimal space-y-1.5 pl-5">{items}</ol>
            : <ul key={i} className="list-disc space-y-1.5 pl-5">{items}</ul>;
        }
        if (first.startsWith("|")) {
          const [head, ...rows] = lines.map(cells);
          return (
            <div key={i} className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>{head.map((c, j) => <th key={j} className="border border-line bg-canvas px-3 py-2 font-semibold">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r, k) => (
                    <tr key={k}>{head.map((_, j) => <td key={j} className="border border-line px-3 py-2 align-top">{inline(r[j] ?? "")}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <p key={i} className="whitespace-pre-line">{inline(lines.join("\n"))}</p>;
      })}
    </div>
  );
}
