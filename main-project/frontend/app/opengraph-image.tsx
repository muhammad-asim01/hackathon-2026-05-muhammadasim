import { ImageResponse } from "next/og";

// ── Default OG image — generated via Next.js Image Metadata API ───────────────
// Served as the og:image / twitter:image for every page that doesn't override it.
// Dimensions match Twitter summary_large_image + OpenGraph spec (1200×630).

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0c0a09",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Amber radial glow */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "900px",
            height: "500px",
            background:
              "radial-gradient(ellipse, rgba(202,177,106,0.18) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Logo mark + wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            marginBottom: "52px",
          }}
        >
          <div
            style={{
              background: "#cab16a",
              width: "48px",
              height: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="26" height="26" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1L14 5V11L8 15L2 11V5L8 1Z"
                stroke="#0c0a09"
                strokeWidth="1.5"
                fill="none"
              />
              <path d="M8 4L11 6.5V9.5L8 12L5 9.5V6.5L8 4Z" fill="#0c0a09" />
            </svg>
          </div>
          <span
            style={{
              color: "#ffffff",
              fontSize: "26px",
              fontWeight: 600,
              letterSpacing: "-0.5px",
            }}
          >
            sift.ai
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            color: "#ffffff",
            fontSize: "68px",
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: "-1.5px",
            margin: "0 0 28px 0",
            maxWidth: "860px",
          }}
        >
          Find Local Leads{" "}
          <span style={{ color: "#cab16a" }}>Before Anyone Else.</span>
        </h1>

        {/* Sub-headline */}
        <p
          style={{
            color: "#a89984",
            fontSize: "24px",
            margin: 0,
            maxWidth: "700px",
            lineHeight: 1.5,
          }}
        >
          AI pipeline that scans Google Maps, scores websites, and drafts
          personalized outreach — while you sleep.
        </p>
      </div>
    ),
    { ...size }
  );
}
