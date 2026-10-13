export const colors = {
  // Strømblik's flat, neutral design system; see docs/DESIGN.md.
  ink: "#3C3246",
  muted: "#6158A4",
  paper: "#F5F5F2",
  white: "#FFFFFF",
  mint: "#EEF1FF",
  coral: "#B42318",
  yellow: "#897AFF",
  line: "#E8E8EE",
  navy: "#3C3246",
  brand: "#5A78FF",
  primary: "#4158D8",
  primaryPressed: "#3548B8",
  primarySoft: "#EEF1FF",
  inputBorder: "#8D8798",
  error: "#B42318",
  errorSoft: "#FFF1F0",
  violet: "#897AFF",
  dustyViolet: "#6158A4",
  lightBlue: "#32E6FF",
  turquoise: "#00FFD7",
  surfaceMuted: "#F5F5F2",
} as const;

export const dkTime = new Intl.DateTimeFormat("da-DK", {
  timeZone: "Europe/Copenhagen",
  hour: "2-digit",
  minute: "2-digit",
});

export const dkDay = new Intl.DateTimeFormat("da-DK", {
  timeZone: "Europe/Copenhagen",
  weekday: "long",
  day: "numeric",
  month: "short",
});
