import type { MetadataRoute } from "next";
import { getBranding } from "@/lib/branding";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const b = await getBranding();
  return {
    name: b.naam,
    short_name: b.naam.length > 12 ? b.naam.split(" ")[0] : b.naam,
    description: `Managementplatform van ${b.naam}`,
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4ef",
    theme_color: b.zijbalk,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    share_target: {
      action: "/api/delen",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", files: [{ name: "files", accept: ["image/*", "video/*", "application/pdf"] }] },
    },
  } as MetadataRoute.Manifest;
}
