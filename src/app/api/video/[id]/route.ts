import { NextResponse } from "next/server";
import { getVideo, getVideoChunks } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const video = await getVideo(id);
  if (!video) return NextResponse.json({ error: "not found" }, { status: 404 });
  const chunks = await getVideoChunks(id);
  return NextResponse.json({ video, chunks });
}
