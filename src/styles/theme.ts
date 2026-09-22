export const colors = {
  // MobilePay corporate palette. Strømblik uses it as a restrained utility UI:
  // blue is the only action/status accent; there are no green states.
  ink: "#3C3246",
  muted: "#504678",
  paper: "#F5F5F2",
  white: "#FFFFFF",
  mint: "#CBD8FF",
  coral: "#FF645A",
  yellow: "#897AFF",
  line: "#CBD8FF",
  navy: "#3C3246",
  primary: "#5A78FF",
  primaryPressed: "#504678",
  primarySoft: "#CBD8FF",
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
