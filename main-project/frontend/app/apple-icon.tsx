import { ImageResponse } from "next/og";

// ── Apple touch icon (180×180) ────────────────────────────────────────────────
// Used when users add the site to their iOS/iPadOS home screen.
// Must use CSS-only shapes — Satori does not support <svg> elements.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0c0a09",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Outer amber diamond ring */}
        <div
          style={{
            width: 110,
            height: 110,
            border: "12px solid #cab16a",
            transform: "rotate(45deg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Inner amber fill diamond */}
          <div
            style={{
              width: 44,
              height: 44,
              background: "#cab16a",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
