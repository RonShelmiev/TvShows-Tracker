import React, { useId } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '../theme';

const GLOW_HEIGHT = 420;

/**
 * Every screen sits on the midnight background with the city glow bleeding down
 * from the top — blue on the left, pink on the right. Radial rather than linear
 * so it fades to nothing at the edges instead of ending on a visible seam.
 */
export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  // Ids live in the document on web, so keep them unique per mounted screen.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const blue = `glowBlue${uid}`;
  const pink = `glowPink${uid}`;

  return (
    <View style={[styles.root, style]}>
      <View pointerEvents="none" style={styles.glow}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id={blue} cx="18%" cy="0%" rx="72%" ry="100%">
              <Stop offset="0" stopColor={colors.accent} stopOpacity={0.14} />
              <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id={pink} cx="93%" cy="3%" rx="58%" ry="92%">
              <Stop offset="0" stopColor={colors.next} stopOpacity={0.12} />
              <Stop offset="1" stopColor={colors.next} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${blue})`} />
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${pink})`} />
        </Svg>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  glow: { position: 'absolute', left: 0, right: 0, top: 0, height: GLOW_HEIGHT },
});
