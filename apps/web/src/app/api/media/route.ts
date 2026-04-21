import { NextRequest } from "next/server";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(
  /\/$/,
  "",
);

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return Response.json({ error: "Missing media key" }, { status: 400 });
  }

  const upstream = await fetch(`${API_BASE}/api/media?${request.nextUrl.searchParams.toString()}`, {
    headers: {
      Accept: request.headers.get("accept") ?? "*/*",
      ...(request.headers.get("cookie")
        ? { Cookie: request.headers.get("cookie") as string }
        : {}),
      ...(request.headers.get("range")
        ? { Range: request.headers.get("range") as string }
        : {}),
    },
    cache: "no-store",
    redirect: "manual",
  });

  const headers = new Headers();
  for (const name of [
    "accept-ranges",
    "cache-control",
    "content-disposition",
    "content-length",
    "content-range",
    "content-type",
    "etag",
    "last-modified",
    "vary",
  ]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
