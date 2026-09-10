import React from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Icon } from '../../src/components/Icon';
import { Screen } from '../../src/components/Screen';
import { ShowResultRow } from '../../src/components/ShowResultRow';
import { EmptyState, Label, Loading, Notice, PrimaryButton, Title } from '../../src/components/ui';
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

export default function PicksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { items, loading, error, updatedAt, refresh, hasLibrary, hasWatched } =
    useRecommendations();

  const empty = !hasLibrary
    ? {
        title: 'Track something first',
        body: 'Picks come from the cast and genres of the shows you watch, so there is nothing to go on yet.',
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
          title: 'Watch a couple of episodes',
          body: 'Once you have marked a few episodes, this fills up with shows that share their cast and genres.',
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
        data={empty ? [] : items}
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
                <Label>Based on what you have watched</Label>
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

            {!empty && (items.length > 0 || updatedAt !== null) ? (
              <Text style={styles.updated}>
                {items.length} suggestion{items.length === 1 ? '' : 's'}
                {updatedAt ? ` · updated ${agoLabel(updatedAt)}` : ''}
              </Text>
            ) : null}

            {error ? <Notice text={error} tone="error" onRetry={refresh} /> : null}
            {loading && items.length === 0 ? (
              <Loading label="Reading the cast of your shows" />
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
