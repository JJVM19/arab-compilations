import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/data";

// Catalog now merges static videos with Supabase-added ones, so it must be
// dynamic — otherwise newly-added videos won't appear until redeploy.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getCatalog());
}
