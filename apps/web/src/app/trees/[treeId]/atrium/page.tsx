import { redirect } from "next/navigation";

export default async function AtriumRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ treeId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { treeId } = await params;
  const sp = (await searchParams) ?? {};
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((val) => query.append(k, val));
    else query.set(k, v);
  }
  const qs = query.toString();
  redirect(`/trees/${treeId}/home${qs ? `?${qs}` : ""}`);
}
