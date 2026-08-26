import React from 'react';
import { View } from 'react-native';

import { colors, radius } from '../theme';

type Props = {
  pct: number;
  height?: number;
  color?: string;
  trackColor?: string;
};

export function ProgressBar({
  pct,
  height = 8,
  color = colors.accent,
  trackColor = colors.track,
}: Props) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={{
        height,
        borderRadius: radius.pill,
        backgroundColor: trackColor,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped}%`,
          height: '100%',
          borderRadius: radius.pill,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
