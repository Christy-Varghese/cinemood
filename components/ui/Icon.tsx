import type { SVGProps } from "react";

/** Small inline icon set (stroke icons, 24px grid) — no icon font or external requests. */
const paths = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5z",
  search: "m21 21-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z",
  bookmark: "M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1Z",
  user: "M20 21a8 8 0 1 0-16 0M12 13a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z",
  heart: "M12 20s-7.5-4.6-9.2-9.4C1.6 7.2 4 4 7.3 4c2 0 3.6 1.1 4.7 2.7C13.1 5.1 14.7 4 16.7 4 20 4 22.4 7.2 21.2 10.6 19.5 15.4 12 20 12 20Z",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5 10 17l9-10",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  thumbUp: "M7 11v9H4v-9zm0 0 4-7.5c1.5 0 2.5 1 2.5 2.5L13 10h5.6a2 2 0 0 1 2 2.4l-1.3 6A2 2 0 0 1 17.3 20H7",
  thumbDown: "M17 13V4h3v9zm0 0-4 7.5c-1.5 0-2.5-1-2.5-2.5L11 14H5.4a2 2 0 0 1-2-2.4l1.3-6A2 2 0 0 1 6.7 4H17",
  star: "m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1-4.5-4.3 6.1-.8z",
  dice: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3.5 4.5h.01M15.5 7.5h.01M12 12h.01M8.5 16.5h.01M15.5 16.5h.01",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z",
  play: "M7 4.5v15l12-7.5z",
  x: "M6 6l12 12M18 6 6 18",
  arrowLeft: "M19 12H5m6-7-7 7 7 7",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  trend: "M3 17l6-6 4 4 8-8M14 7h7v7",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z",
  cards: "M8 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM4 7v11a3 3 0 0 0 3 3",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  flame: "M12 22c4 0 7-2.8 7-6.8 0-3.6-2.4-5.7-3.8-8.2-.4 1.9-1.4 3-2.6 3.6.3-3.3-1-6.6-4.1-8.6.2 3.5-1.6 5.6-3.2 7.6C4.2 11.2 5 13.6 5 15.2 5 19.2 8 22 12 22Z",
  instagram: "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm5 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm5.5-9.5h.01",
  film: "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 0v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, filled = false, ...rest }: { name: IconName; size?: number; filled?: boolean } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  );
}

/** CineMood mark: a projector beam forming a mood ring. */
export function Logo() {
  return (
    <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="cm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F0B04A" />
          <stop offset="1" stopColor="#F2667A" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#cm-g)" />
      <circle cx="16" cy="16" r="7.2" fill="none" stroke="#1b1306" strokeWidth="2.6" />
      <circle cx="16" cy="16" r="2.4" fill="#1b1306" />
    </svg>
  );
}
