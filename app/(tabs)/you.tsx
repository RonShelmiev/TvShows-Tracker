import React, { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../src/components/Icon';
import { Screen } from '../../src/components/Screen';
import { EmptyState, Label, Title } from '../../src/components/ui';
import { formatMinutes, progressFor } from '../../src/model/progress';
import { useLibrary } from '../../src/store/library';
import { colors, radius, space, type as typeTokens } from '../../src/theme';

export default function YouScreen() {
  const insets = useSafeAreaInsets();
  const { shows, clearAll } = useLibrary();

  const stats = useMemo(() => {
    let watched = 0;
    let total = 0;
    let minutesWatched = 0;
    let minutesLeft = 0;
    let finished = 0;
    let behind = 0;

    for (const tracked of shows) {
      const progress = progressFor(tracked);
      watched += progress.watched;
      total += progress.total;
      minutesLeft += progress.minutesLeft;
      behind += progress.behind;
      if (progress.total > 0 && progress.left === 0) finished += 1;

      const seen = new Set(tracked.watched);
      for (const episode of tracked.episodes) {
        if (seen.has(episode.id)) {
          minutesWatched += episode.runtime ?? tracked.show.runtime ?? 45;
        }
      }
    }

    return { watched, total, minutesWatched, minutesLeft, finished, behind };
  }, [shows]);

  const onClear = () => {
    Alert.alert(
      'Clear your library?',
      'Every tracked show and all your progress will be deleted from this phone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete everything', style: 'destructive', onPress: clearAll },
      ],
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 32 }}>
        <View style={{ paddingHorizontal: space.screenX, gap: 4 }}>
          <Label>Your watching</Label>
          <Title>You</Title>
        </View>

        {shows.length === 0 ? (
          <EmptyState
            title="No numbers yet"
            body="Track a show and mark a few episodes — your totals build up here."
          />
        ) : (
          <>
            <View style={styles.grid}>
              <Stat value={String(shows.length)} label="Shows tracked" />
              <Stat value={String(stats.finished)} label="Finished" tone={colors.done} />
              <Stat value={String(stats.watched)} label="Episodes watched" tone={colors.accent} />
              <Stat value={String(stats.total - stats.watched)} label="Episodes left" />
              <Stat value={formatMinutes(stats.minutesWatched)} label="Time watched" tone={colors.accent} />
              <Stat value={formatMinutes(stats.minutesLeft)} label="Time left" />
            </View>

            {stats.behind > 0 ? (
              <View style={styles.behindCard}>
                <Text style={styles.behindNumber}>{stats.behind}</Text>
                <Text style={styles.behindText}>
                  {stats.behind === 1 ? 'episode has' : 'episodes have'} aired that you have not
                  watched yet.
                </Text>
              </View>
            ) : null}

            <View style={styles.sectionHead}>
              <Label>Data</Label>
            </View>
            <Text style={styles.note}>
              Everything lives on this phone only — show details come from TVmaze, your progress
              never leaves the device.
            </Text>
            <Pressable onPress={onClear} style={styles.clear} accessibilityRole="button">
              <Icon name="trash" size={16} color={colors.textDim} />
              <Text style={styles.clearText}>Clear library</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: space.screenX,
    paddingTop: 20,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    padding: 16,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  statValue: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  statLabel: { ...typeTokens.mono, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textLabel },
  behindCard: {
    marginHorizontal: space.screenX,
    marginTop: 12,
    padding: 16,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  behindNumber: { fontSize: 30, fontWeight: '800', color: colors.next, letterSpacing: -0.6 },
  behindText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  sectionHead: { paddingHorizontal: space.screenX, paddingTop: 28, paddingBottom: 10 },
  note: { paddingHorizontal: space.screenX, fontSize: 13, lineHeight: 20, color: colors.textDim },
  clear: {
    marginTop: 16,
    marginHorizontal: space.screenX,
    height: 46,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  clearText: { fontSize: 13, color: colors.textDim },
});
