import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NLE Reviewer",
    short_name: "NLE Reviewer",
    description: "A local-first board exam quiz and progress tracker.",
    start_url: "/workspace",
    display: "standalone",
    background_color: "#f3f6f8",
    theme_color: "#071722",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
