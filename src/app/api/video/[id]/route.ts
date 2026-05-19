import { NextResponse } from "next/server";
import { getVideo, getVideoChunks } from "@/lib/data";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const video = getVideo(id);
  if (!video) return NextResponse.json({ error: "not found" }, { status: 404 });
  const chunks = getVideoChunks(id);
  return NextResponse.json({ video, chunks });
}
