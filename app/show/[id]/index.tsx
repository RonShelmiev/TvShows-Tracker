import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getShowWithEpisodes, posterUri, TvmazeError } from '../../../src/api/tvmaze';
import type { Episode, ShowSummary } from '../../../src/api/types';
import { Icon } from '../../../src/components/Icon';
import { ProgressBar } from '../../../src/components/ProgressBar';
import { Screen } from '../../../src/components/Screen';
import {
  Label,
  Loading,
  Notice,
  PrimaryButton,
  SecondaryButton,
} from '../../../src/components/ui';
import { tick } from '../../../src/lib/haptics';
import {
  episodeCode,
  formatAirdate,
  formatMinutes,
  progressFor,
  seasonBreakdown,
  showYears,
  type SeasonSummary,
  type TrackedShow,
} from '../../../src/model/progress';
import { useLibrary } from '../../../src/store/library';
import { colors, radius, space, tintFor, type as typeTokens } from '../../../src/theme';

export default function ShowDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const showId = Number(params.id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { get, addShow, removeShow, markNext, busy, refresh } = useLibrary();

  const tracked = get(showId);
  const [preview, setPreview] = useState<{ show: ShowSummary; episodes: Episode[] } | null>(null);
  const [loading, setLoading] = useState(!tracked);
  const [error, setError] = useState<string | null>(null);

  // Not in the library yet — fetch just enough to show the page.
  useEffect(() => {
    if (tracked || Number.isNaN(showId)) return;
    let cancelled = false;
    setLoading(true);
    getShowWithEpisodes(showId)
      .then((data) => {
        if (!cancelled) {
          setPreview(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof TvmazeError ? err.message : 'Could not load that show');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showId, tracked]);

  const show = tracked?.show ?? preview?.show ?? null;
  const episodes = tracked?.episodes ?? preview?.episodes ?? [];

  if (Number.isNaN(showId)) return <Fallback message="That show link is not valid." />;
  if (loading && !show) {
    return (
      <Screen>
        <BackButton top={insets.top} />
        <View style={{ paddingTop: insets.top + 80 }}>
          <Loading label="Loading show" />
        </View>
      </Screen>
    );
  }
  if (!show) return <Fallback message={error ?? 'That show could not be loaded.'} />;

  const progress = tracked ? progressFor(tracked) : null;
  const seasons = tracked
    ? seasonBreakdown(tracked)
    : seasonBreakdown({ show, episodes, watched: [], addedAt: 0, lastWatchedAt: null, episodesFetchedAt: null });
  const next = progress ? progress.nextAired ?? progress.next : null;
  const heroUri = posterUri({ image: show.imageLarge ?? show.image });

  const onRemove = () => {
    Alert.alert(
      `Stop tracking ${show.name}?`,
      'Your progress for this show will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop tracking',
          style: 'destructive',
          onPress: () => {
            removeShow(show.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[styles.hero, { backgroundColor: tintFor(show.id) }]}>
          {heroUri ? (
            <Image source={{ uri: heroUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          ) : null}
          <LinearGradient
            colors={['rgba(10,13,24,0.15)', 'rgba(10,13,24,0.65)', colors.bg]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          <BackButton top={insets.top} />
          {tracked ? (
            <Pressable
              onPress={() => refresh(show.id)}
              accessibilityRole="button"
              accessibilityLabel="Refresh episode list"
              style={[styles.circleButton, { top: insets.top + 4, right: space.screenX }]}
            >
              <Icon name="refresh" size={19} color={colors.text} />
            </Pressable>
          ) : null}
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{show.name}</Text>
            <Text style={styles.heroMeta}>
              {[
                showYears(show),
                show.genres[0],
                seasons.length > 0 ? `${seasons.length} season${seasons.length === 1 ? '' : 's'}` : null,
                show.runtime ? `${show.runtime} min` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>

        {error ? <Notice text={error} tone="error" /> : null}

        {tracked && progress ? (
          <>
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <View style={{ gap: 3 }}>
                  <Label>Your progress</Label>
                  <Text style={styles.cardSub}>
                    {progress.watched} of {progress.total} episodes
                    {progress.left > 0 ? ` · ${progress.left} left` : ''}
                  </Text>
                </View>
                <Text style={styles.bigPct}>{progress.pct}%</Text>
              </View>
              <ProgressBar pct={progress.pct} height={10} />
              <View style={styles.cardFoot}>
                <Text style={styles.footText}>
                  {progress.behind > 0 ? `${progress.behind} aired and waiting` : 'Nothing waiting'}
                </Text>
                <Text style={styles.footText}>
                  {progress.left > 0 ? `About ${formatMinutes(progress.minutesLeft)} left` : 'Finished'}
                </Text>
              </View>
            </View>

            <View style={styles.actions}>
              <PrimaryButton
                label={next ? `Watched ${episodeCode(next.season, next.number)}` : 'All watched'}
                icon="check"
                disabled={!next}
                onPress={() => {
                  tick();
                  markNext(show.id);
                }}
                style={{ flex: 1 }}
              />
              <Link
                href={`/show/${show.id}/season/${next?.season ?? seasons[0]?.season ?? 1}?position=1`}
                asChild
              >
                <SecondaryButton icon="plus" label="Set position" />
              </Link>
            </View>
          </>
        ) : (
          <View style={styles.actions}>
            <PrimaryButton
              label="Track this show"
              icon="plus"
              busy={!!busy[show.id]}
              onPress={() => addShow(show).catch(() => setError('Could not add that show'))}
              style={{ flex: 1 }}
            />
          </View>
        )}

        <View style={styles.sectionHead}>
          <Label>Seasons</Label>
          <Text style={styles.sectionMeta}>{episodes.length} episodes</Text>
        </View>

        {seasons.map((season) => (
          <SeasonRow key={season.season} showId={show.id} season={season} tracked={!!tracked} />
        ))}

        {show.summary ? (
          <View style={styles.summaryWrap}>
            <Label>About</Label>
            <Text style={styles.summary}>{show.summary}</Text>
          </View>
        ) : null}

        {tracked ? (
          <>
            <Pressable onPress={onRemove} style={styles.remove} accessibilityRole="button">
              <Icon name="trash" size={16} color={colors.textDim} />
              <Text style={styles.removeText}>Stop tracking this show</Text>
            </Pressable>
            <Text style={styles.added}>
              Added {formatAirdate(new Date(tracked.addedAt).toISOString().slice(0, 10))}
            </Text>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function SeasonRow({
  showId,
  season,
  tracked,
}: {
  showId: number;
  season: SeasonSummary;
  tracked: boolean;
}) {
  return (
    <Link href={`/show/${showId}/season/${season.season}`} asChild>
      <Pressable style={styles.seasonRow} accessibilityRole="button">
        <View style={styles.seasonBadge}>
          <Text style={styles.seasonBadgeText}>S{season.season}</Text>
        </View>
        <View style={{ flex: 1, gap: 7 }}>
          <View style={styles.seasonTitleLine}>
            <Text style={[styles.seasonTitle, season.complete ? { color: colors.textLabel } : null]}>
              Season {season.season}
            </Text>
            <Text style={styles.seasonCount}>
              {tracked ? `${season.watched}/${season.total}` : `${season.total} ep`}
            </Text>
          </View>
          {tracked ? (
            <ProgressBar
              pct={season.pct}
              height={5}
              trackColor={colors.trackSmall}
              color={season.complete ? colors.done : colors.accent}
            />
          ) : null}
        </View>
        <Icon name="chevronRight" size={18} color={colors.chevron} />
      </Pressable>
    </Link>
  );
}

function BackButton({ top }: { top: number }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={[styles.circleButton, { top: top + 4, left: space.screenX }]}
    >
      <Icon name="chevronLeft" size={20} color={colors.text} />
    </Pressable>
  );
}

function Fallback({ message }: { message: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Screen>
      <BackButton top={insets.top} />
      <View style={{ paddingTop: insets.top + 90 }}>
        <Notice text={message} tone="error" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { height: 300, justifyContent: 'flex-end' },
  heroText: { paddingHorizontal: space.screenX, paddingBottom: 16, gap: 8 },
  heroTitle: { fontSize: 30, color: colors.textStrong, fontWeight: '800', letterSpacing: -0.4 },
  heroMeta: {
    ...typeTokens.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  circleButton: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(10,13,24,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    marginHorizontal: space.screenX,
    marginTop: 16,
    padding: 16,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 13,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  cardSub: { fontSize: 14, color: colors.textMuted },
  bigPct: { fontSize: 30, color: colors.accent, fontWeight: '800', letterSpacing: -0.6 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between' },
  footText: { ...typeTokens.mono, fontSize: 11, color: colors.textDim },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: space.screenX, paddingTop: 14 },
  sectionHead: {
    paddingHorizontal: space.screenX,
    paddingTop: 24,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionMeta: { fontSize: 12, color: colors.textDim },
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: space.screenX,
    paddingVertical: 11,
  },
  seasonBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seasonBadgeText: { ...typeTokens.mono, fontSize: 13, color: colors.textMuted },
  seasonTitleLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  seasonTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  seasonCount: { ...typeTokens.mono, fontSize: 11, color: colors.textLabel },
  summaryWrap: { paddingHorizontal: space.screenX, paddingTop: 26, gap: 10 },
  summary: { fontSize: 14, lineHeight: 21, color: colors.textMuted },
  remove: {
    marginTop: 28,
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
  removeText: { fontSize: 13, color: colors.textDim },
  added: {
    ...typeTokens.mono,
    fontSize: 10,
    color: colors.chevron,
    textAlign: 'center',
    paddingTop: 12,
  },
});
