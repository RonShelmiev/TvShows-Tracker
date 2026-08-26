import { Link, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSchedule, searchShows, TvmazeError } from '../../src/api/tvmaze';
import type { ShowSummary } from '../../src/api/types';
import { Icon } from '../../src/components/Icon';
import { Poster } from '../../src/components/Poster';
import { Screen } from '../../src/components/Screen';
import { Chip, EmptyState, Label, Loading, Notice, Title } from '../../src/components/ui';
import { episodeCode, showYears } from '../../src/model/progress';
import { useLibrary } from '../../src/store/library';
import { colors, radius, space, type as typeTokens } from '../../src/theme';

const COUNTRIES = [
  { code: 'US', label: 'US' },
  { code: 'GB', label: 'UK' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
];

/** Search results and the schedule render through the same row. */
type BrowseRow = { show: ShowSummary; line?: string };

function todayISO(): string {
  const now = new Date();
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export default function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ShowSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [country, setCountry] = useState('US');
  const [tonight, setTonight] = useState<BrowseRow[]>([]);
  const [tonightLoading, setTonightLoading] = useState(false);
  const [tonightError, setTonightError] = useState<string | null>(null);

  const trimmed = query.trim();

  // Debounced search — one request per pause in typing, older ones aborted.
  useEffect(() => {
    if (trimmed === '') {
      setResults([]);
      setSearching(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchShows(trimmed, controller.signal);
        if (!controller.signal.aborted) {
          setResults(found);
          setError(null);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setResults([]);
          setError(err instanceof TvmazeError ? err.message : 'Search failed');
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const loadTonight = useCallback(async () => {
    const controller = new AbortController();
    setTonightLoading(true);
    setTonightError(null);
    try {
      const entries = await getSchedule(country, todayISO(), controller.signal);
      const seen = new Set<number>();
      const rows: BrowseRow[] = [];
      for (const entry of entries) {
        if (seen.has(entry.show.id)) continue;
        seen.add(entry.show.id);
        rows.push({
          show: entry.show,
          line: [
            episodeCode(entry.episode.season, entry.episode.number),
            entry.airtime,
            entry.network,
          ]
            .filter(Boolean)
            .join(' · '),
        });
      }
      setTonight(rows.slice(0, 40));
    } catch (err) {
      setTonightError(err instanceof TvmazeError ? err.message : 'Could not load tonight’s schedule');
    } finally {
      setTonightLoading(false);
    }
  }, [country]);

  useEffect(() => {
    loadTonight();
  }, [loadTonight]);

  const showingSearch = trimmed !== '';
  const rows: BrowseRow[] = showingSearch ? results.map((show) => ({ show })) : tonight;

  return (
    <Screen>
      <FlatList
        data={rows}
        keyExtractor={(row, index) => `${showingSearch ? 's' : 't'}-${row.show.id}-${index}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 24 }}
        ListHeaderComponent={
          <View>
            <View style={{ paddingHorizontal: space.screenX }}>
              <Title>Browse</Title>
            </View>

            <View style={styles.searchWrap}>
              <View style={styles.search}>
                <Icon name="search" size={18} color={colors.textDim} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search shows, people, networks"
                  placeholderTextColor={colors.textDim}
                  style={styles.searchInput}
                  autoCorrect={false}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                  accessibilityLabel="Search TVmaze for a show"
                />
                {searching ? <ActivityIndicator size="small" color={colors.textDim} /> : null}
              </View>
            </View>

            {!showingSearch ? (
              <View style={styles.chips}>
                {COUNTRIES.map((c) => (
                  <Chip
                    key={c.code}
                    label={c.label}
                    active={country === c.code}
                    onPress={() => setCountry(c.code)}
                  />
                ))}
              </View>
            ) : null}

            <View style={styles.sectionHead}>
              <Label>{showingSearch ? 'Results' : 'On today'}</Label>
              <Text style={styles.sectionMeta}>
                {showingSearch
                  ? `${results.length} show${results.length === 1 ? '' : 's'}`
                  : `${tonight.length} show${tonight.length === 1 ? '' : 's'}`}
              </Text>
            </View>

            {error ? <Notice text={error} tone="error" /> : null}
            {!showingSearch && tonightError ? (
              <Notice text={tonightError} tone="error" onRetry={loadTonight} />
            ) : null}
            {!showingSearch && tonightLoading && tonight.length === 0 ? <Loading /> : null}
            {showingSearch && searching && results.length === 0 ? <Loading /> : null}
          </View>
        }
        ListEmptyComponent={
          showingSearch && !searching && !error ? (
            <EmptyState
              title="No shows found"
              body={`TVmaze has nothing matching “${trimmed}”. Try a shorter title or the original-language name.`}
            />
          ) : null
        }
        renderItem={({ item }) => <ResultRow show={item.show} line={item.line} />}
      />
    </Screen>
  );
}

function ResultRow({ show, line }: { show: ShowSummary; line?: string }) {
  const { isTracked, addShow, busy } = useLibrary();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const tracked = isTracked(show.id);
  const adding = !!busy[show.id];

  const meta =
    line ??
    [showYears(show), show.network, show.genres[0]].filter(Boolean).join(' · ');

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
        <Pressable style={styles.rowMain} accessibilityRole="button">
          <Poster show={show} width={46} height={66} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {show.name}
            </Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {meta || 'TV series'}
            </Text>
            {error ? <Text style={styles.rowError}>{error}</Text> : null}
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
  searchWrap: { paddingHorizontal: space.screenX, paddingTop: 14 },
  search: {
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: space.screenX, paddingTop: 16 },
  sectionHead: {
    paddingHorizontal: space.screenX,
    paddingTop: 22,
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
  rowMeta: { ...typeTokens.mono, fontSize: 11, color: colors.textFaint },
  rowError: { fontSize: 11, color: colors.next },
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
