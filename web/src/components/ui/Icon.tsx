import type { ReactNode } from "react";

export type IconName =
  | "arrow"
  | "check"
  | "close"
  | "menu"
  | "plus"
  | "chevron"
  | "people"
  | "calendar"
  | "flag"
  | "wallet"
  | "mail"
  | "camera"
  | "spark"
  | "food"
  | "tent"
  | "clock"
  | "lock"
  | "eye"
  | "eye-off"
  | "pin"
  | "phone"
  | "circle-check"
  | "message"
  | "link"
  | "dashboard"
  | "store"
  | "globe"
  | "settings"
  | "logout"
  | "search";

type IconProps = {
  name: IconName;
  className?: string;
};

const paths: Record<IconName, ReactNode> = {
  arrow: (
    <>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M7 3v4M17 3v4M3 11h18m-13 5 3 3 5-5" />
    </>
  ),
  flag: (
    <>
      <path d="M5 21V4m0 0c5-4 9 4 14 0v10c-5 4-9-4-14 0" />
    </>
  ),
  wallet: (
    <>
      <path d="M20 8V5a2 2 0 0 0-2-2L5 6a3 3 0 0 0-2 3v10a2 2 0 0 0 2 2h15V8H6" />
      <path d="M20 12h-5v5h5" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8h4l2-3h6l2 3h4v12H3Z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
    </>
  ),
  food: (
    <>
      <path d="M5 3v7m3-7v7M2 3v7a3 3 0 0 0 6 0M5 13v8M20 3c-5 4-5 10 0 10V3Zm0 10v8" />
    </>
  ),
  tent: (
    <>
      <path d="M3 11 12 3l9 8M5 10v11h14V10M9 21v-7h6v7M2 21h20M12 3V1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "eye-off": (
    <>
      <path d="m3 3 18 18M10.6 5.1A11 11 0 0 1 12 5c6 0 10 7 10 7a20 20 0 0 1-3 3.8M6.2 6.2A20 20 0 0 0 2 12s4 7 10 7a12 12 0 0 0 5.8-1.8M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  pin: (
    <>
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  phone: (
    <path d="m8 3 3 5-3 3a13 13 0 0 0 5 5l3-3 5 3c0 4-3 5-5 5C9 20 4 15 3 8c0-2 1-5 5-5Z" />
  ),
  "circle-check": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  message: <path d="M21 12a9 9 0 0 1-13 8l-5 1 1-5A9 9 0 1 1 21 12Z" />,
  link: (
    <>
      <path d="m10 8 3-3a4 4 0 0 1 6 6l-3 3M14 16l-3 3a4 4 0 0 1-6-6l3-3M8 16l8-8" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  store: (
    <>
      <path d="M3 10 5 3h14l2 7M3 10c0 4 6 4 6 0 0 4 6 4 6 0 0 4 6 4 6 0M5 14v7h14v-7M9 21v-6h6v6" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18M5 7h14M5 17h14" />
    </>
  ),
  settings: (
    <>
      <path d="m10 3-1 3-3 1-3 1 1 3-1 3 3 2 1 3 3-1 3 1 2-3 3-1-1-3 1-3-3-2-1-3-3 1Z" />
      <circle cx="10.5" cy="11.5" r="3" />
    </>
  ),
  logout: <path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
};

export function Icon({ name, className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon ${className}`}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
