import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { VERSION_COOKIE, V1_TO_V2 } from "@/lib/versionPreference";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const v2Path = V1_TO_V2[pathname];
  if (!v2Path) return NextResponse.next();

  // Opt-in legacy UI only
  if (request.cookies.get(VERSION_COOKIE)?.value === "v1") {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = v2Path;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/", "/map", "/itinerary", "/stops", "/supervision", "/about"],
};
