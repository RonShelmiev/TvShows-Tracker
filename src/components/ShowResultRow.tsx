import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ShowSummary } from '../api/types';
import { useLibrary } from '../store/library';
import { colors, radius, space, type as typeTokens } from '../theme';
import { Icon } from './Icon';
import { Poster } from './Poster';

/**
 * A show you do not track yet: tap to open it, or track it from here. Shared by
 * Browse and Picks so the two lists stay identical to work with.
 */
export function ShowResultRow({
  show,
  meta,
  note,
}: {
  show: ShowSummary;
  meta: string;
  /** An extra line under the meta — Picks uses it for the "because you watch…" reason. */
  note?: React.ReactNode;
}) {
  const { isTracked, addShow, busy } = useLibrary();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const tracked = isTracked(show.id);
  const adding = !!busy[show.id];

  const onTrack = async () => {
    setError(null);
    try {
      await addShow(show);
    } catch {
      setError('Could not load that show');
    }
  };

  return (
    <View style={styles.row}>
      <Link href={`/show/${show.id}`} asChild>
        <Pressable style={styles.main} accessibilityRole="button">
          <Poster show={show} width={46} height={66} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={styles.title} numberOfLines={1}>
              {show.name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {meta || 'TV series'}
            </Text>
            {note}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </Pressable>
      </Link>

      {tracked ? (
        <Pressable
          onPress={() => router.push(`/show/${show.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`${show.name} is already tracked`}
          style={styles.tracking}
        >
          <Icon name="check" size={14} color={colors.accent} strokeWidth={2.4} />
          <Text style={styles.trackingText}>Tracking</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onTrack}
          disabled={adding}
          accessibilityRole="button"
          accessibilityLabel={`Track ${show.name}`}
          style={({ pressed }) => [styles.track, pressed ? { opacity: 0.6 } : null]}
        >
          {adding ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <>
              <Icon name="plus" size={14} color={colors.textSecondary} strokeWidth={2.1} />
              <Text style={styles.trackText}>Track</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: space.screenX,
    paddingVertical: 9,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { ...typeTokens.mono, fontSize: 11, color: colors.textFaint },
  error: { fontSize: 11, color: colors.next },
  track: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderControl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  tracking: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceButton,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackingText: { fontSize: 13, fontWeight: '500', color: colors.accent },
});
