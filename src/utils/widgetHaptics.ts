import * as Haptics from 'expo-haptics';

export function widgetHaptic(kind: 'grab' | 'step' | 'drop') {
  const feedback = kind === 'step' ? Haptics.selectionAsync() : Haptics.impactAsync(kind === 'grab' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  void feedback.catch(() => {});
}
