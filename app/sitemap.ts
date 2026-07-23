import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://axo-live.vercel.app";

  const routes = [
    "/v2",
    "/v2/map",
    "/v2/stops",
    "/v2/itinerary",
    "/v2/supervision",
    "/v2/about",
  ].map((route) => {
    let changeFrequency: "always" | "daily" | "weekly" = "daily";
    let priority = 0.8;

    if (route === "/v2") {
      changeFrequency = "always";
      priority = 1.0;
    } else if (route === "/v2/map" || route === "/v2/supervision") {
      changeFrequency = "always";
      priority = 0.9;
    } else if (route === "/v2/stops" || route === "/v2/itinerary") {
      changeFrequency = "daily";
      priority = 0.8;
    } else if (route === "/v2/about") {
      changeFrequency = "weekly";
      priority = 0.5;
    }

    return {
      url: `${siteUrl}${route}`,
      lastModified: new Date(),
      changeFrequency,
      priority,
    };
  });

  return routes;
}
