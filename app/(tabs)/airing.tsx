import { Link } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Episode, ShowSummary } from '../../src/api/types';
import { Poster } from '../../src/components/Poster';
import { Screen } from '../../src/components/Screen';
import { CheckButton, EmptyState, Label, Title } from '../../src/components/ui';
import { tick } from '../../src/lib/haptics';
import {
  episodeCode,
  formatAirdate,
  hasAired,
  progressFor,
  sortEpisodes,
} from '../../src/model/progress';
import { useLibrary } from '../../src/store/library';
import { colors, space, type as typeTokens } from '../../src/theme';

type Row = { show: ShowSummary; episode: Episode; kind: 'waiting' | 'upcoming' };

const UPCOMING_WINDOW_DAYS = 60;

export default function AiringScreen() {
  const insets = useSafeAreaInsets();
  const { ordered, toggle } = useLibrary();

  const sections = useMemo(() => {
    const now = new Date();
    const horizon = now.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const waiting: Row[] = [];
    const upcoming: Row[] = [];

    for (const tracked of ordered) {
      const watched = new Set(tracked.watched);
      const progress = progressFor(tracked, now);
      if (progress.nextAired) {
        waiting.push({ show: tracked.show, episode: progress.nextAired, kind: 'waiting' });
      }
      for (const episode of sortEpisodes(tracked.episodes)) {
        if (watched.has(episode.id) || hasAired(episode, now)) continue;
        const when = episode.airdate ? Date.parse(`${episode.airdate}T00:00:00`) : NaN;
        if (Number.isNaN(when) || when > horizon) continue;
        upcoming.push({ show: tracked.show, episode, kind: 'upcoming' });
      }
    }

    upcoming.sort((a, b) => (a.episode.airdate ?? '').localeCompare(b.episode.airdate ?? ''));

    return [
      { key: 'waiting', title: 'Waiting for you', meta: `${waiting.length}`, data: waiting },
      {
        key: 'upcoming',
        title: 'Coming up',
        meta: `next ${UPCOMING_WINDOW_DAYS} days`,
        data: upcoming.slice(0, 60),
      },
    ].filter((section) => section.data.length > 0);
  }, [ordered]);

  return (
    <Screen>
      <SectionList
        sections={sections}
        keyExtractor={(row) => `${row.kind}-${row.episode.id}`}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: space.screenX, gap: 4 }}>
            <Label>From the shows you track</Label>
            <Title>Airing</Title>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={ordered.length === 0 ? 'Nothing tracked yet' : 'Nothing scheduled'}
            body={
              ordered.length === 0
                ? 'Track a show and its air dates show up here.'
                : 'None of your shows have an episode waiting or an air date in the next two months.'
            }
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHead}>
            <Label>{section.title}</Label>
            <Text style={styles.sectionMeta}>{section.meta}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Link href={`/show/${item.show.id}`} asChild>
              <Pressable style={styles.rowMain} accessibilityRole="button">
                <Poster show={item.show} width={44} height={62} />
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.show.name}
                  </Text>
                  <Text style={styles.rowCode} numberOfLines={1}>
                    {episodeCode(item.episode.season, item.episode.number)} · {item.episode.name}
                  </Text>
                  <Text
                    style={[
                      styles.rowDate,
                      item.kind === 'waiting' ? { color: colors.next } : null,
                    ]}
                  >
                    {item.kind === 'waiting'
                      ? `Aired ${formatAirdate(item.episode.airdate)} · not watched`
                      : formatAirdate(item.episode.airdate)}
                  </Text>
                </View>
              </Pressable>
            </Link>
            {item.kind === 'waiting' ? (
              <CheckButton
                checked={false}
                onPress={() => {
                  tick();
                  toggle(item.show.id, item.episode.id);
                }}
                accessibilityLabel={`Mark ${item.show.name} ${episodeCode(
                  item.episode.season,
                  item.episode.number,
                )} watched`}
              />
            ) : null}
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    paddingHorizontal: space.screenX,
    paddingTop: 24,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionMeta: { fontSize: 12, color: colors.textDim },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: space.screenX,
    paddingVertical: 9,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowCode: { ...typeTokens.mono, fontSize: 11, color: colors.textFaint },
  rowDate: { fontSize: 12, color: colors.textDim },
});
