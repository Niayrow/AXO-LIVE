import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://axo-live.vercel.app";

  const routes = ["", "/map", "/stops", "/itinerary", "/supervision", "/about"].map((route) => {
    // Determine update frequency based on page type
    let changeFrequency: "always" | "daily" | "weekly" = "daily";
    let priority = 0.8;

    if (route === "") {
      changeFrequency = "always";
      priority = 1.0;
    } else if (route === "/map" || route === "/supervision") {
      changeFrequency = "always";
      priority = 0.9;
    } else if (route === "/stops" || route === "/itinerary") {
      changeFrequency = "daily";
      priority = 0.8;
    } else if (route === "/about") {
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
