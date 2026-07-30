const DEFAULT_BUCKET = "logo-files";

export type StoredObject = {
  body: Uint8Array;
  contentType: string;
  etag: string;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
};

type PutOptions = {
  contentType?: string;
};

function storageConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured.");
  }
  return {
    url,
    key,
    bucket: process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET,
  };
}

function authHeaders(contentType?: string) {
  const { key } = storageConfig();
  const headers = new Headers({
    apikey: key,
    Authorization: `Bearer ${key}`,
  });
  if (contentType) headers.set("Content-Type", contentType);
  return headers;
}

function objectUrl(key: string) {
  const { url, bucket } = storageConfig();
  return `${url}/storage/v1/object/${bucket}/${key
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function toBytes(body: ArrayBuffer | Uint8Array | string): Uint8Array {
  if (typeof body === "string") return new TextEncoder().encode(body);
  return body instanceof Uint8Array ? body : new Uint8Array(body);
}

function asStoredObject(
  bytes: Uint8Array,
  contentType: string,
  etag: string,
): StoredObject {
  const copy = bytes;
  return {
    body: copy,
    contentType,
    etag,
    async arrayBuffer() {
      return copy.buffer.slice(
        copy.byteOffset,
        copy.byteOffset + copy.byteLength,
      ) as ArrayBuffer;
    },
    async text() {
      return new TextDecoder().decode(copy);
    },
  };
}

function isMissingObject(status: number, detail: string) {
  if (status === 404) return true;
  try {
    const payload = JSON.parse(detail) as {
      statusCode?: string | number;
      code?: string;
      error?: string;
    };
    return (
      payload.code === "NoSuchKey" ||
      payload.error === "not_found" ||
      String(payload.statusCode) === "404"
    );
  } catch {
    return /not_found|NoSuchKey|Object not found/i.test(detail);
  }
}

export async function headObject(key: string): Promise<boolean> {
  // Supabase Storage rejects HEAD on /object/...; probe with GET.
  // Missing keys often come back as HTTP 400 + JSON { code: "NoSuchKey" }.
  const response = await fetch(objectUrl(key), {
    method: "GET",
    headers: authHeaders(),
  });
  if (response.ok) {
    await response.arrayBuffer();
    return true;
  }
  const detail = await response.text().catch(() => "");
  if (isMissingObject(response.status, detail)) return false;
  throw new Error(detail || `Storage head failed (${response.status}).`);
}

export async function getObject(key: string): Promise<StoredObject | null> {
  const response = await fetch(objectUrl(key), {
    method: "GET",
    headers: authHeaders(),
  });
  if (response.ok) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return asStoredObject(
      bytes,
      response.headers.get("content-type") ?? "application/octet-stream",
      response.headers.get("etag") ?? `"${bytes.byteLength}"`,
    );
  }
  const detail = await response.text().catch(() => "");
  if (isMissingObject(response.status, detail)) return null;
  throw new Error(detail || `Storage get failed (${response.status}).`);
}

export async function putObject(
  key: string,
  body: ArrayBuffer | Uint8Array | string,
  options: PutOptions = {},
): Promise<void> {
  const bytes = toBytes(body);
  const contentType = options.contentType ?? "application/octet-stream";
  const headers = authHeaders(contentType);
  headers.set("x-upsert", "true");
  const response = await fetch(objectUrl(key), {
    method: "POST",
    headers,
    body: Buffer.from(bytes),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      detail || `Storage put failed (${response.status}).`,
    );
  }
}

export async function removeObjects(keys: string[]): Promise<void> {
  const unique = Array.from(new Set(keys.filter(Boolean)));
  if (!unique.length) return;
  const { url, bucket, key } = storageConfig();

  // Prefer per-object DELETE (reliable across Storage API versions).
  const failures: string[] = [];
  await Promise.all(
    unique.map(async (objectKey) => {
      const response = await fetch(objectUrl(objectKey), {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (response.ok || response.status === 404) return;
      const detail = await response.text().catch(() => "");
      if (isMissingObject(response.status, detail)) return;
      failures.push(detail || `${objectKey} (${response.status})`);
    }),
  );

  if (failures.length) {
    // Fallback: batch delete with prefixes body (storage-js shape).
    const batch = await fetch(`${url}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: unique }),
    });
    if (!batch.ok) {
      const detail = await batch.text().catch(() => "");
      throw new Error(
        detail || failures[0] || `Storage delete failed (${batch.status}).`,
      );
    }
  }
}
