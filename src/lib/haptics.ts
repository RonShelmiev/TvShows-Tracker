import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** A light tick when you mark an episode. Silently no-ops where unsupported. */
export function tick() {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}
