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

export async function headObject(key: string): Promise<boolean> {
  const response = await fetch(objectUrl(key), {
    method: "HEAD",
    headers: authHeaders(),
  });
  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(`Storage head failed (${response.status}).`);
  }
  return true;
}

export async function getObject(key: string): Promise<StoredObject | null> {
  const response = await fetch(objectUrl(key), {
    method: "GET",
    headers: authHeaders(),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Storage get failed (${response.status}).`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return asStoredObject(
    bytes,
    response.headers.get("content-type") ?? "application/octet-stream",
    response.headers.get("etag") ?? `"${bytes.byteLength}"`,
  );
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
  const response = await fetch(`${url}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(unique),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      detail || `Storage delete failed (${response.status}).`,
    );
  }
}
