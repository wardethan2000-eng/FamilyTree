import { redirect } from "next/navigation";

export default async function FamilyMapPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  redirect(`/trees/${treeId}/tree`);
}
