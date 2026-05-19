import { NextResponse } from "next/server";
import { getTitles, upsertTitle } from "@/lib/data";
import type { SavedTitle } from "@/lib/types";

export async function GET() {
  const titles = await getTitles();
  return NextResponse.json({ titles });
}

export async function POST(req: Request) {
  const body = await req.json() as Partial<SavedTitle>;
  const t = await upsertTitle(body);
  return NextResponse.json(t);
}
