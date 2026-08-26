import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../../../src/components/Icon';
import { ProgressBar } from '../../../../src/components/ProgressBar';
import { Screen } from '../../../../src/components/Screen';
import { CheckButton, Label, Notice } from '../../../../src/components/ui';
import { tick } from '../../../../src/lib/haptics';
import type { Episode } from '../../../../src/api/types';
import {
  episodeCode,
  episodesInSeason,
  formatAirdate,
  hasAired,
  progressFor,
  seasonBreakdown,
} from '../../../../src/model/progress';
import { useLibrary } from '../../../../src/store/library';
import { colors, radius, space, type as typeTokens } from '../../../../src/theme';

export default function SeasonScreen() {
  const params = useLocalSearchParams<{ id: string; season: string; position?: string }>();
  const showId = Number(params.id);
  const season = Number(params.season);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { get, toggle, setSeason, setPosition } = useLibrary();

  const tracked = get(showId);
  const episodes = useMemo(
    () => (tracked ? episodesInSeason(tracked, season) : []),
    [tracked, season],
  );
  const seasons = useMemo(() => (tracked ? seasonBreakdown(tracked) : []), [tracked]);
  const nextUp = tracked ? (progressFor(tracked).nextAired ?? progressFor(tracked).next) : null;

  if (!tracked) {
    return (
      <Screen>
        <View style={{ paddingTop: insets.top + 70 }}>
          <Notice text="This show is not in your library yet." />
        </View>
      </Screen>
    );
  }

  const watched = new Set(tracked.watched);
  const seasonWatched = episodes.filter((e) => watched.has(e.id)).length;
  const seasonPct = episodes.length === 0 ? 0 : Math.round((seasonWatched / episodes.length) * 100);
  const allWatched = episodes.length > 0 && seasonWatched === episodes.length;

  const onRowPress = (episode: Episode) => {
    Alert.alert(
      `${episodeCode(episode.season, episode.number)} · ${episode.name}`,
      'Set where you are, or just tick this one episode.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: watched.has(episode.id) ? 'Un-tick this episode' : 'Tick this episode',
          onPress: () => {
            tick();
            toggle(showId, episode.id);
          },
        },
        {
          text: 'I am here — mark everything before',
          onPress: () => {
            tick();
            setPosition(showId, episode.id);
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <FlatList
        data={episodes}
        keyExtractor={(episode) => String(episode.id)}
        contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: 28 }}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace(`/show/${showId}`))}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                style={styles.back}
              >
                <Icon name="chevronLeft" size={20} color={colors.text} />
              </Pressable>
              <View style={{ gap: 2, flex: 1 }}>
                <Label>{tracked.show.name}</Label>
                <Text style={styles.title}>Season {season}</Text>
              </View>
            </View>

            <View style={styles.seasonChips}>
              {seasons.map((s) => (
                <Pressable
                  key={s.season}
                  onPress={() => router.replace(`/show/${showId}/season/${s.season}`)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: s.season === season }}
                  style={[styles.seasonChip, s.season === season ? styles.seasonChipActive : null]}
                >
                  <Text
                    style={[
                      styles.seasonChipText,
                      s.season === season ? styles.seasonChipTextActive : null,
                    ]}
                  >
                    S{s.season}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.progressBlock}>
              <View style={styles.progressLine}>
                <Text style={styles.progressText}>
                  {seasonWatched} of {episodes.length} watched this season
                </Text>
                <Pressable
                  onPress={() => {
                    tick();
                    setSeason(showId, season, !allWatched);
                  }}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text style={styles.markSeason}>{allWatched ? 'Clear season' : 'Mark season'}</Text>
                </Pressable>
              </View>
              <ProgressBar pct={seasonPct} height={8} />
              {params.position ? (
                <Text style={styles.hint}>Tap an episode to say you are up to there.</Text>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={<Notice text="TVmaze lists no episodes for this season yet." />}
        renderItem={({ item }) => (
          <EpisodeRow
            episode={item}
            checked={watched.has(item.id)}
            isNext={nextUp?.id === item.id}
            onToggle={() => {
              tick();
              toggle(showId, item.id);
            }}
            onPress={() => onRowPress(item)}
          />
        )}
      />
    </Screen>
  );
}

function EpisodeRow({
  episode,
  checked,
  isNext,
  onToggle,
  onPress,
}: {
  episode: Episode;
  checked: boolean;
  isNext: boolean;
  onToggle: () => void;
  onPress: () => void;
}) {
  const aired = hasAired(episode);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        isNext ? { backgroundColor: colors.surfaceSoft } : null,
        pressed ? { opacity: 0.7 } : null,
      ]}
    >
      <CheckButton
        checked={checked}
        onPress={onToggle}
        accessibilityLabel={`Mark ${episodeCode(episode.season, episode.number)} ${
          checked ? 'unwatched' : 'watched'
        }`}
      />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.code}>{episodeCode(episode.season, episode.number)}</Text>
          <Text
            style={[styles.rowTitle, checked ? { color: colors.textDone } : null]}
            numberOfLines={1}
          >
            {episode.name}
          </Text>
        </View>
        <View style={styles.rowMetaLine}>
          <Text style={styles.rowMeta}>
            {episode.runtime ? `${episode.runtime} min · ` : ''}
            {formatAirdate(episode.airdate)}
            {!aired ? ' · upcoming' : ''}
          </Text>
          {isNext ? (
            <View style={styles.nextBadge}>
              <Text style={styles.nextBadgeText}>Next up</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: space.screenX - 10,
    paddingRight: space.screenX,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, color: colors.text, fontWeight: '800', letterSpacing: -0.3 },
  seasonChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: space.screenX,
    paddingTop: 16,
  },
  seasonChip: {
    minWidth: 52,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seasonChipActive: { backgroundColor: colors.accent },
  seasonChipText: { ...typeTokens.mono, fontSize: 13, color: colors.textDim },
  seasonChipTextActive: { color: colors.onAccent, fontWeight: '600' },
  progressBlock: { paddingHorizontal: space.screenX, paddingTop: 18, paddingBottom: 12, gap: 9 },
  progressLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  progressText: { fontSize: 13, color: colors.textMuted },
  markSeason: {
    ...typeTokens.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  hint: { fontSize: 12, color: colors.textDim, paddingTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: space.screenX,
    paddingVertical: 10,
  },
  rowTitleLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  code: { ...typeTokens.mono, fontSize: 12, color: colors.textLabel },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text },
  rowMetaLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowMeta: { fontSize: 12, color: colors.textDim },
  nextBadge: {
    backgroundColor: colors.next,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  nextBadgeText: {
    ...typeTokens.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.onNext,
  },
});
