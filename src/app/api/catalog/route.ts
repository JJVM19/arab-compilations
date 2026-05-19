import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/data";

export async function GET() {
  return NextResponse.json(getCatalog());
}
