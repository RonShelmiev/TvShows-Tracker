import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { posterUri } from '../api/tvmaze';
import type { ShowSummary } from '../api/types';
import { colors, radius, tintFor } from '../theme';

type Props = {
  show: Pick<ShowSummary, 'id' | 'name' | 'image'>;
  width: number;
  height: number;
  rounding?: number;
};

/** Real artwork when TVmaze has it, otherwise a tinted placeholder with initials. */
export function Poster({ show, width, height, rounding = radius.sm }: Props) {
  const uri = posterUri(show);
  const initials = show.name
    .replace(/^(The|A|An)\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <View
      style={[
        styles.frame,
        { width, height, borderRadius: rounding, backgroundColor: tintFor(show.id || show.name) },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width, height }}
          contentFit="cover"
          transition={180}
          accessibilityLabel={show.name}
        />
      ) : (
        <Text style={[styles.initials, { fontSize: Math.max(12, width * 0.3) }]}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  initials: {
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '800',
    letterSpacing: 1,
  },
});
