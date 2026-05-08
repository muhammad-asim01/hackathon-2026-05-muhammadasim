import { ImageResponse } from "next/og";

// ── App favicon — generated via Next.js Image Metadata API ────────────────────
// Satori (the engine behind ImageResponse) does NOT support <svg> elements —
// they are silently dropped. All shapes must be pure CSS / div-based.
//
// Design: dark background with a rotated amber square (diamond mark).

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
            width: 20,
            height: 20,
            border: "2.5px solid #cab16a",
            transform: "rotate(45deg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Inner amber fill diamond */}
          <div
            style={{
              width: 8,
              height: 8,
              background: "#cab16a",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
