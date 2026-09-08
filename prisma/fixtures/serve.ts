import { createServer, type Server } from "http";
import { readFileSync } from "fs";
import path from "path";

/**
 * სატესტო მიმწოდებლის API ლოკალურად, მხოლოდ 127.0.0.1-ზე.
 * ფიქსტურები public/-ში არ უნდა იდოს — იქიდან ისინი საჯაროდ გაიცემა.
 */
export function serveFixture(file: string, port: number): Promise<Server> {
  const body = readFileSync(path.join(__dirname, file), "utf8");
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(body);
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}
