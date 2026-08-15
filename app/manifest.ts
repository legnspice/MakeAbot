import type { MetadataRoute } from "next";

/**
 * Required for iOS: Safari only exposes the Web Push API to sites the user has
 * added to their Home Screen, and Add to Home Screen needs a web app manifest.
 * Without this file iOS users can never receive push at all.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MakeAbot",
    short_name: "MakeAbot",
    description: "Campus marketplace for Ateneo students.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#3761B0",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
