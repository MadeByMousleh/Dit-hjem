// Temporarily hidden from navigation; retain integrations and saved data.
const pausedTabs = new Set(['car', 'charger', 'appliances', 'smartthings']);
export const isPausedHomeTab = (tab: string) => pausedTabs.has(tab);
