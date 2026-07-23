export const VERSION_COOKIE = "axo-version";
export const VERSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const V1_TO_V2: Record<string, string> = {
  "/": "/v2",
  "/map": "/v2/map",
  "/itinerary": "/v2/itinerary",
  "/stops": "/v2/stops",
  "/supervision": "/v2/supervision",
  "/about": "/v2/about",
};

export const V2_TO_V1: Record<string, string> = {
  "/v2": "/",
  "/v2/map": "/map",
  "/v2/itinerary": "/itinerary",
  "/v2/stops": "/stops",
  "/v2/supervision": "/supervision",
  "/v2/about": "/about",
};

export function v1PathFromV2(pathname: string): string {
  if (V2_TO_V1[pathname]) return V2_TO_V1[pathname];
  if (pathname.startsWith("/v2/")) {
    const rest = pathname.slice(3);
    return rest || "/";
  }
  if (pathname === "/v2") return "/";
  return "/";
}

export function v2PathFromV1(pathname: string): string {
  return V1_TO_V2[pathname] || "/v2";
}

/** Client-only: prefer legacy v1 UI */
export function preferV1(): void {
  document.cookie = `${VERSION_COOKIE}=v1;path=/;max-age=${VERSION_COOKIE_MAX_AGE};SameSite=Lax`;
}

/** Client-only: clear preference → default to v2 */
export function preferV2(): void {
  document.cookie = `${VERSION_COOKIE}=;path=/;max-age=0;SameSite=Lax`;
}
