// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Matches the Cloudflare runtime binding consumed by Drizzle's ambient D1 types.
type D1Database = any;

interface Fetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
  };
}
