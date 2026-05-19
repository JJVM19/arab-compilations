import { NextResponse } from "next/server";
import { getCompilations, upsertCompilation } from "@/lib/data";

export async function GET() {
  const compilations = await getCompilations();
  return NextResponse.json({ compilations });
}

export async function POST(req: Request) {
  const body = await req.json();
  const c = await upsertCompilation({
    id: body.id,
    title: body.title,
    pitch: body.pitch,
    target_length_min: body.target_length_min,
    clips: body.clips ?? [],
  });
  return NextResponse.json(c);
}
