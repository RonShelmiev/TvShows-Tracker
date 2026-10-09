import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Icon } from '../../src/components/Icon';
import { Screen } from '../../src/components/Screen';
import { ShowResultRow } from '../../src/components/ShowResultRow';
import { Chip, EmptyState, Label, Loading, Notice, PrimaryButton, Title } from '../../src/components/ui';
import { showYears } from '../../src/model/progress';
import { useRecommendations } from '../../src/store/recommendations';
import { colors, space, type as typeTokens } from '../../src/theme';

function agoLabel(at: number | null): string {
  if (at === null) return '';
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const MAX_GENRE_CHIPS = 6;

export default function PicksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { items, loading, error, updatedAt, refresh, hasLibrary, hasWatched } =
    useRecommendations();
  const [genre, setGenre] = useState<string | null>(null);

  // Your genres in the order they lead your picks, so the chips mirror the list.
  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      item.genres.forEach((g, i) => counts.set(g, (counts.get(g) ?? 0) + (i === 0 ? 2 : 1)));
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_GENRE_CHIPS)
      .map(([g]) => g);
  }, [items]);

  // A refresh can drop the chosen genre; fall back to everything rather than an empty list.
  const activeGenre = genre !== null && genres.includes(genre) ? genre : null;
  const shown = activeGenre ? items.filter((item) => item.genres.includes(activeGenre)) : items;

  const empty = !hasLibrary
    ? {
        title: 'Track something first',
        body: 'Picks come from the genres and cast of the shows you watch, so there is nothing to go on yet.',
        action: (
          <PrimaryButton
            label="Find a show"
            icon="search"
            onPress={() => router.push('/browse')}
            style={{ paddingHorizontal: 22 }}
          />
        ),
      }
    : !hasWatched
      ? {
          title: 'Watch an episode',
          body: 'Once you have marked an episode or two, this fills up with shows in the same genres, weighted toward what you are watching now.',
          action: (
            <PrimaryButton
              label="Go to my shows"
              icon="tv"
              onPress={() => router.push('/')}
              style={{ paddingHorizontal: 22 }}
            />
          ),
        }
      : null;

  return (
    <Screen>
      <FlatList
        data={empty ? [] : shown}
        keyExtractor={(item) => String(item.show.id)}
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={loading && items.length > 0}
            onRefresh={refresh}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={{ gap: 4, flexShrink: 1 }}>
                <Label>Based on what you watch</Label>
                <Title>Picks</Title>
              </View>
              {empty ? null : (
                <Pressable
                  onPress={refresh}
                  accessibilityRole="button"
                  accessibilityLabel="Rebuild your picks"
                  style={styles.refresh}
                >
                  <Icon name="refresh" size={19} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>

            {!empty && genres.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                <Chip label="All" active={activeGenre === null} onPress={() => setGenre(null)} />
                {genres.map((g) => (
                  <Chip key={g} label={g} active={activeGenre === g} onPress={() => setGenre(g)} />
                ))}
              </ScrollView>
            ) : null}

            {!empty && (items.length > 0 || updatedAt !== null) ? (
              <Text style={styles.updated}>
                {shown.length} suggestion{shown.length === 1 ? '' : 's'}
                {updatedAt ? ` · updated ${agoLabel(updatedAt)}` : ''}
              </Text>
            ) : null}

            {error ? <Notice text={error} tone="error" onRetry={refresh} /> : null}
            {loading && items.length === 0 ? (
              <Loading label="Matching your genres and cast" />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          empty ? (
            <EmptyState title={empty.title} body={empty.body} action={empty.action} />
          ) : null
        }
        renderItem={({ item }) => (
          <ShowResultRow
            show={item.show}
            meta={[showYears(item.show), item.show.network, item.show.rating ? `★ ${item.show.rating.toFixed(1)}` : null]
              .filter(Boolean)
              .join(' · ')}
            note={
              <View style={{ gap: 2, paddingTop: 1 }}>
                <Text style={styles.reason} numberOfLines={1}>
                  {item.reason}
                </Text>
                <Text style={styles.detail} numberOfLines={2}>
                  {item.detail}
                </Text>
              </View>
            }
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: space.screenX,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  refresh: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: space.screenX, paddingTop: 16 },
  updated: {
    ...typeTokens.mono,
    fontSize: 11,
    color: colors.textDim,
    paddingHorizontal: space.screenX,
    paddingTop: 14,
  },
  reason: { fontSize: 12, color: colors.accent, fontWeight: '500' },
  detail: { fontSize: 12, color: colors.textDim },
});
