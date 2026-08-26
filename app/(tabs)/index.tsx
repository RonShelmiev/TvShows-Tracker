import { Link, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../src/components/Icon';
import { Poster } from '../../src/components/Poster';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import {
  CheckButton,
  Chip,
  EmptyState,
  Label,
  Loading,
  PrimaryButton,
  SecondaryButton,
  Title,
} from '../../src/components/ui';
import { tick } from '../../src/lib/haptics';
import {
  episodeCode,
  progressFor,
  type Progress,
  type TrackedShow,
} from '../../src/model/progress';
import { useLibrary } from '../../src/store/library';
import { colors, radius, space, type as typeTokens } from '../../src/theme';

type Filter = 'watching' | 'upnext' | 'finished';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Row = { tracked: TrackedShow; progress: Progress };

export default function MyShowsScreen() {
  const { ordered, hydrated, markNext } = useLibrary();
  const [filter, setFilter] = useState<Filter>('watching');
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const rows = useMemo<Row[]>(
    () => ordered.map((tracked) => ({ tracked, progress: progressFor(tracked) })),
    [ordered],
  );

  const waiting = rows.reduce((sum, row) => sum + row.progress.behind, 0);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'upnext':
        return rows.filter((row) => row.progress.behind > 0);
      case 'finished':
        return rows.filter((row) => row.progress.total > 0 && row.progress.left === 0);
      default:
        return rows.filter((row) => row.progress.left > 0);
    }
  }, [rows, filter]);

  const hero = filtered[0];
  const rest = filtered.slice(1);

  const onMark = (showId: number) => {
    tick();
    markNext(showId);
  };

  if (!hydrated) {
    return (
      <Screen>
        <View style={{ paddingTop: insets.top + 60 }}>
          <Loading label="Opening your library" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={rest}
        keyExtractor={(row) => String(row.tracked.show.id)}
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 24 }}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={{ gap: 4, flexShrink: 1 }}>
                <Label>
                  {WEEKDAYS[new Date().getDay()]}
                  {waiting > 0 ? ` · ${waiting} episode${waiting === 1 ? '' : 's'} waiting` : ' · all caught up'}
                </Label>
                <Title>My Shows</Title>
              </View>
              <Pressable
                onPress={() => router.push('/browse')}
                accessibilityRole="button"
                accessibilityLabel="Find a show"
                style={styles.headerButton}
              >
                <Icon name="search" size={20} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.chips}>
              <Chip label="Watching" active={filter === 'watching'} onPress={() => setFilter('watching')} />
              <Chip label="Up next" active={filter === 'upnext'} onPress={() => setFilter('upnext')} />
              <Chip label="Finished" active={filter === 'finished'} onPress={() => setFilter('finished')} />
            </View>

            {hero ? <HeroCard row={hero} onMark={() => onMark(hero.tracked.show.id)} /> : null}

            {rest.length > 0 ? (
              <View style={styles.sectionHead}>
                <Label>Keep going</Label>
                <Text style={styles.sectionMeta}>Recently watched</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          hero ? null : (
            <EmptyState
              title={emptyTitle(filter, rows.length)}
              body={emptyBody(filter, rows.length)}
              action={
                <PrimaryButton
                  label="Find a show"
                  icon="search"
                  onPress={() => router.push('/browse')}
                  style={{ paddingHorizontal: 22 }}
                />
              }
            />
          )
        }
        renderItem={({ item }) => (
          <ShowRow row={item} onMark={() => onMark(item.tracked.show.id)} />
        )}
      />
    </Screen>
  );
}

function emptyTitle(filter: Filter, tracked: number): string {
  if (tracked === 0) return 'Nothing tracked yet';
  if (filter === 'finished') return 'Nothing finished yet';
  if (filter === 'upnext') return 'You are all caught up';
  return 'Every show is finished';
}

function emptyBody(filter: Filter, tracked: number): string {
  if (tracked === 0) {
    return 'Search for a show and it lands here with every episode listed, so you can mark where you are.';
  }
  if (filter === 'upnext') return 'No aired episodes are waiting for you right now.';
  if (filter === 'finished') return 'Finish a show and it moves here.';
  return 'Add another show, or switch to Finished to see what you have completed.';
}

function HeroCard({ row, onMark }: { row: Row; onMark: () => void }) {
  const { tracked, progress } = row;
  const next = progress.nextAired ?? progress.next;
  const done = progress.left === 0;

  return (
    <View style={styles.hero}>
      <Link href={`/show/${tracked.show.id}`} asChild>
        <Pressable style={styles.heroTop} accessibilityRole="button">
          <Poster show={tracked.show} width={64} height={92} rounding={10} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.heroKicker}>{done ? 'Finished' : 'Up next'}</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {tracked.show.name}
            </Text>
            {next ? (
              <>
                <Text style={styles.heroEpisode} numberOfLines={1}>
                  {episodeCode(next.season, next.number)} · {next.name}
                </Text>
                <Text style={styles.heroMeta}>
                  {next.runtime ?? tracked.show.runtime ?? 45} min
                  {progress.behind > 1 ? ` · ${progress.behind} waiting` : ''}
                </Text>
              </>
            ) : (
              <Text style={styles.heroMeta}>Every episode watched</Text>
            )}
          </View>
        </Pressable>
      </Link>

      <View style={{ gap: 8 }}>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            {progress.watched} of {progress.total} episodes watched
          </Text>
          <Text style={styles.progressPct}>{progress.pct}%</Text>
        </View>
        <ProgressBar pct={progress.pct} height={8} />
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <PrimaryButton
          label={next ? 'Mark watched' : 'All watched'}
          icon="check"
          onPress={onMark}
          disabled={!next}
          style={{ flex: 1 }}
        />
        <Link href={`/show/${tracked.show.id}`} asChild>
          <SecondaryButton icon="list" label={undefined} />
        </Link>
      </View>
    </View>
  );
}

function ShowRow({ row, onMark }: { row: Row; onMark: () => void }) {
  const { tracked, progress } = row;
  const next = progress.nextAired ?? progress.next;

  return (
    <View style={styles.row}>
      <Link href={`/show/${tracked.show.id}`} asChild>
        <Pressable style={styles.rowMain} accessibilityRole="button">
          <Poster show={tracked.show} width={44} height={62} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={styles.rowTitleLine}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {tracked.show.name}
              </Text>
              <Text style={styles.rowLeft}>
                {progress.left === 0 ? 'done' : `${progress.left} left`}
              </Text>
            </View>
            <Text style={styles.rowEpisode} numberOfLines={1}>
              {next ? `${episodeCode(next.season, next.number)} · ${next.name}` : 'Every episode watched'}
            </Text>
            <ProgressBar
              pct={progress.pct}
              height={5}
              trackColor={colors.trackSmall}
              color={progress.left === 0 ? colors.done : colors.accent}
            />
          </View>
        </Pressable>
      </Link>
      <CheckButton
        checked={progress.left === 0}
        onPress={onMark}
        accessibilityLabel={`Mark the next episode of ${tracked.show.name} watched`}
      />
    </View>
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
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: space.screenX, paddingTop: 18 },
  hero: {
    marginHorizontal: space.screenX,
    marginTop: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 16,
    gap: 15,
  },
  heroTop: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  heroKicker: {
    ...typeTokens.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.next,
  },
  heroTitle: { fontSize: 19, color: colors.text, fontWeight: '800', letterSpacing: -0.2 },
  heroEpisode: { ...typeTokens.mono, fontSize: 12, color: colors.textFaint },
  heroMeta: { fontSize: 12, color: colors.textDim },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  progressText: { fontSize: 13, color: colors.textMuted },
  progressPct: { ...typeTokens.mono, fontSize: 13, color: colors.accent },
  sectionHead: {
    paddingHorizontal: space.screenX,
    paddingTop: 22,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionMeta: { fontSize: 12, color: colors.textDim },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.screenX,
    paddingVertical: 9,
    gap: 12,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitleLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  rowLeft: { ...typeTokens.mono, fontSize: 11, color: colors.textLabel },
  rowEpisode: { ...typeTokens.mono, fontSize: 11, color: colors.textFaint },
});
