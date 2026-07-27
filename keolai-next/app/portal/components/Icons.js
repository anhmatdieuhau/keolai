/**
 * Portal icon set — Phosphor-style geometric line icons.
 *
 * Replaces the emoji glyphs the portal shipped with. Emoji render differently
 * per OS/browser, can't inherit color or stroke weight, and read as filler
 * rather than interface. These are one family, one stroke weight (1.75),
 * one 24-unit grid, and inherit currentColor so a single CSS rule restyles
 * every icon in a state (hover, active, disabled).
 */

function Svg({ children, size = 20, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

/* ── Navigation ───────────────────────────────────────── */

export const IconOverview = (p) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
  </Svg>
)

export const IconArticles = (p) => (
  <Svg {...p}>
    <path d="M4 4.5h16v15H4z" />
    <path d="M7.5 9h9M7.5 12.5h9M7.5 16h5.5" />
  </Svg>
)

export const IconSeo = (p) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5 21 21" />
  </Svg>
)

export const IconTopics = (p) => (
  <Svg {...p}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.4.3.6.8.6 1.2h6c0-.4.2-.9.6-1.2A6 6 0 0 0 12 3Z" />
  </Svg>
)

export const IconCosts = (p) => (
  <Svg {...p}>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 16.5v-9Z" />
    <path d="M3 7.5h16" />
    <circle cx="16.5" cy="12.5" r="1.25" />
  </Svg>
)

/* ── Actions ──────────────────────────────────────────── */

export const IconRefresh = (p) => (
  <Svg {...p}>
    <path d="M20 11.5a8 8 0 1 0-.8 4.5" />
    <path d="M20 5.5v6h-6" />
  </Svg>
)

export const IconLogout = (p) => (
  <Svg {...p}>
    <path d="M9.5 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3.5" />
    <path d="M15 16.5 19.5 12 15 7.5M19.5 12H9" />
  </Svg>
)

export const IconExternal = (p) => (
  <Svg {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4 11 13" />
    <path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10" />
  </Svg>
)

export const IconSeed = (p) => (
  <Svg {...p}>
    <path d="M12 21v-7" />
    <path d="M12 14c0-3.9 3.1-7 7-7 0 3.9-3.1 7-7 7Z" />
    <path d="M12 17c0-2.8-2.2-5-5-5 0 2.8 2.2 5 5 5Z" />
  </Svg>
)

export const IconKey = (p) => (
  <Svg {...p}>
    <circle cx="8" cy="12" r="4" />
    <path d="M12 12h9M18 12v3.5M15.5 12v2.5" />
  </Svg>
)

/* ── Status / feedback ────────────────────────────────── */

export const IconCheck = (p) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
)

export const IconX = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)

export const IconClock = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
)

export const IconWarning = (p) => (
  <Svg {...p}>
    <path d="M12 4.5 2.8 20h18.4L12 4.5Z" />
    <path d="M12 10v4.5M12 17.2v.3" />
  </Svg>
)

export const IconTrend = (p) => (
  <Svg {...p}>
    <path d="M3 16.5 9 10l4 4 8-8" />
    <path d="M15 6h6v6" />
  </Svg>
)

export const IconInbox = (p) => (
  <Svg {...p}>
    <path d="M3.5 13.5h4l1.5 3h6l1.5-3h4" />
    <path d="M5.6 5h12.8l2.1 8.5V19a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 19v-5.5L5.6 5Z" />
  </Svg>
)

export const IconGoogle = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.99 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
)

/* ── UI / Data ────────────────────────────────────────── */

export const IconSearch = (p) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5 21 21" />
  </Svg>
)

export const IconEdit = (p) => (
  <Svg {...p}>
    <path d="M17 3a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Svg>
)

export const IconLightbulb = (p) => (
  <Svg {...p}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.4.3.6.8.6 1.2h6c0-.4.2-.9.6-1.2A6 6 0 0 0 12 3Z" />
  </Svg>
)

export const IconBarChart = (p) => (
  <Svg {...p}>
    <path d="M4 20V10M12 20V4M20 20v-7" />
  </Svg>
)

export const IconCalendar = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
    <path d="M3.5 10h17M8 2v4M16 2v4" />
    <rect x="8.5" y="13.5" width="7" height="4.5" rx="1" />
  </Svg>
)

export const IconUsers = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="7.5" r="3.5" />
    <path d="M2 19.5c0-3.5 3.1-6 7-6s7 2.5 7 6" />
    <circle cx="17" cy="7.5" r="2.5" />
    <path d="M15 14c2.3 0 4.5.8 5.5 2.5M15 17.5c1.5 0 3 .6 4 2" />
  </Svg>
)

export const IconEye = (p) => (
  <Svg {...p}>
    <path d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8-10-8-10-8Z" />
    <circle cx="12" cy="12" r="3.5" />
  </Svg>
)

export const IconCursor = (p) => (
  <Svg {...p}>
    <path d="M5.5 3.5 18 15l-6 1-2.5 4.5-2-1L10 15 5.5 18Z" />
  </Svg>
)

export const IconPin = (p) => (
  <Svg {...p}>
    <path d="M12 21v-5.5" />
    <circle cx="12" cy="9" r="7" />
    <circle cx="12" cy="8.5" r="2.5" />
  </Svg>
)

export const IconBolt = (p) => (
  <Svg {...p}>
    <path d="M13 2 3 14h9l-2 8 10-12h-9l2-8Z" />
  </Svg>
)

export const IconFlask = (p) => (
  <Svg {...p}>
    <path d="M8.5 3h7M10 3v6L4.5 18.5a3.5 3.5 0 0 0 2.5 2.5h10a3.5 3.5 0 0 0 2.5-2.5L14 9V3" />
  </Svg>
)

export const IconRobot = (p) => (
  <Svg {...p}>
    <rect x="4" y="5" width="16" height="13" rx="3" />
    <path d="M12 5V2M9 9.5h6M9 13h4" />
    <circle cx="9" cy="9.5" r="1" fill="currentColor" />
    <circle cx="15" cy="9.5" r="1" fill="currentColor" />
  </Svg>
)

export const IconTarget = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  </Svg>
)

export const IconFile = (p) => (
  <Svg {...p}>
    <path d="M14 3.5h-8a1.5 1.5 0 0 0-1.5 1.5v15a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V9Z" />
    <path d="M14 3.5V9h5.5" />
  </Svg>
)

export const IconLink = (p) => (
  <Svg {...p}>
    <path d="M10 14H6.5a4 4 0 0 1 0-8H10M14 6h3.5a4 4 0 1 1 0 8H14M8 12h8" />
  </Svg>
)

export const IconFire = (p) => (
  <Svg {...p}>
    <path d="M12 21c4-3 7-7 7-10a7 7 0 0 0-14 0c0 3 3 7 7 10Z" />
    <path d="M12 21c-2-1.5-3.5-3.5-3.5-6 0-2 1.5-3 3.5-3s3.5 1 3.5 3c0 2.5-1.5 4.5-3.5 6Z" />
  </Svg>
)

export const IconCash = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M15 9.7c0-1.5-1.2-2.7-3-2.7S9 8.2 9 9.7c0 2.3 6 1.7 6 4.6 0 1.5-1.2 2.7-3 2.7s-3-1.2-3-2.7M12 7v10" />
  </Svg>
)

export const IconChevronUp = (p) => (
  <Svg {...p}>
    <path d="M6 15 12 9l6 6" />
  </Svg>
)

export const IconChevronDown = (p) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
)

export const IconArrowUp = (p) => (
  <Svg {...p}>
    <path d="M12 21V3M6 9l6-6 6 6" />
  </Svg>
)

export const IconArrowDown = (p) => (
  <Svg {...p}>
    <path d="M12 3v18M18 15l-6 6-6-6" />
  </Svg>
)

export const IconArrowsSort = (p) => (
  <Svg {...p}>
    <path d="M7 3v14M3 17l4 4 4-4" />
    <path d="M17 21V7M21 7l-4-4-4 4" />
  </Svg>
)

/* ── Primitive ────────────────────────────────────────── */
export const StatusDot = ({ color, size = 8 }) => (
  <span
    style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }}
    aria-hidden="true"
  />
)
