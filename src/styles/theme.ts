export const colors = {
  ink: "#18332F",
  muted: "#65736E",
  paper: "#F4F1E8",
  white: "#FFFEFA",
  mint: "#DCE9DC",
  green: "#0B694F",
  coral: "#E87555",
  yellow: "#F2CA6B",
  line: "#D8D9CF",
  navy: "#163B47",
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
