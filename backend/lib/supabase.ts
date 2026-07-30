type QueryValue = string | number | boolean | undefined;

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured.");
  }
  return { key, url };
}

function headers(prefer?: string) {
  const { key } = config();
  const result = new Headers({
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  });
  if (prefer) result.set("Prefer", prefer);
  return result;
}

function queryString(query: Record<string, QueryValue>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  const value = params.toString();
  return value ? `?${value}` : "";
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(body?.message || `Supabase request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export async function selectRows<T>(
  table: string,
  query: Record<string, QueryValue>,
) {
  const { url } = config();
  return parse<T[]>(
    await fetch(`${url}/rest/v1/${table}${queryString(query)}`, {
      headers: headers(),
    }),
  );
}

export async function selectOne<T>(
  table: string,
  query: Record<string, QueryValue>,
) {
  const rows = await selectRows<T>(table, { ...query, limit: 1 });
  return rows[0] ?? null;
}

export async function insertRow<T extends Record<string, unknown>>(
  table: string,
  row: T,
) {
  const { url } = config();
  const rows = await parse<T[]>(
    await fetch(`${url}/rest/v1/${table}`, {
      method: "POST",
      headers: headers("return=representation"),
      body: JSON.stringify(row),
    }),
  );
  return rows[0];
}

export async function updateRows<T extends Record<string, unknown>>(
  table: string,
  query: Record<string, QueryValue>,
  values: Partial<T>,
) {
  const { url } = config();
  return parse<T[]>(
    await fetch(`${url}/rest/v1/${table}${queryString(query)}`, {
      method: "PATCH",
      headers: headers("return=representation"),
      body: JSON.stringify(values),
    }),
  );
}

export async function deleteRows(
  table: string,
  query: Record<string, QueryValue>,
) {
  const { url } = config();
  const response = await fetch(
    `${url}/rest/v1/${table}${queryString(query)}`,
    {
      method: "DELETE",
      headers: headers("return=minimal"),
    },
  );
  if (!response.ok) await parse(response);
}

export async function countRows(
  table: string,
  query: Record<string, QueryValue>,
) {
  const { url } = config();
  const response = await fetch(
    `${url}/rest/v1/${table}${queryString({ ...query, select: "id" })}`,
    { headers: headers("count=exact") },
  );
  if (!response.ok) await parse(response);
  const range = response.headers.get("content-range") ?? "*/0";
  return Number(range.split("/")[1] ?? 0);
}
