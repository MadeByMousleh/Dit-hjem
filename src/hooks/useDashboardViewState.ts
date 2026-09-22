import { useState } from "react";

export type DashboardTab = "dashboard" | "home" | "car" | "profile";

export function useDashboardViewState() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("dashboard");
  const [chartScrubbing, setChartScrubbing] = useState(false);

  return {
    activeTab,
    setActiveTab,
    chartScrubbing,
    setChartScrubbing,
  };
}
