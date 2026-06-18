import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Daybreak",
    short_name: "Daybreak",
    description: "Your morning wellness and daily planning companion.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fdf9f0",
    theme_color: "#fdf9f0",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
