import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, radius, type as typeTokens } from '../theme';
import { Icon, type IconName } from './Icon';

/** Small uppercase mono label above a section. */
export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [
        styles.chip,
        active ? styles.chipActive : null,
        pressed && !active ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  icon,
  onPress,
  disabled,
  busy,
  color = colors.accent,
  ink = colors.onAccent,
  style,
}: {
  label: string;
  icon?: IconName;
  onPress?: () => void;
  disabled?: boolean;
  busy?: boolean;
  color?: string;
  ink?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: color, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={ink} size="small" />
      ) : (
        <>
          {icon ? <Icon name={icon} size={17} color={ink} strokeWidth={2.2} /> : null}
          <Text style={[styles.primaryText, { color: ink }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  icon,
  onPress,
  style,
}: {
  label?: string;
  icon?: IconName;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? icon}
      style={({ pressed }) => [styles.secondary, pressed ? styles.pressed : null, style]}
    >
      {icon ? <Icon name={icon} size={18} color={colors.textSecondary} /> : null}
      {label ? <Text style={styles.secondaryText}>{label}</Text> : null}
    </Pressable>
  );
}

/** 44px round tap target used for the "mark watched" checks. */
export function CheckButton({
  checked,
  onPress,
  accessibilityLabel,
}: {
  checked: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [styles.check, pressed ? styles.pressed : null]}
    >
      <View
        style={[
          styles.checkRing,
          checked
            ? { backgroundColor: colors.accent, borderColor: colors.accent }
            : { borderColor: colors.borderControl },
        ]}
      >
        {checked ? <Icon name="check" size={14} color={colors.onAccent} strokeWidth={2.6} /> : null}
      </View>
    </Pressable>
  );
}

export function Notice({
  text,
  tone = 'muted',
  onRetry,
}: {
  text: string;
  tone?: 'muted' | 'error';
  onRetry?: () => void;
}) {
  return (
    <View style={styles.notice}>
      <Text style={[styles.noticeText, tone === 'error' ? { color: colors.next } : null]}>{text}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.retry}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
      {label ? <Text style={styles.loadingText}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typeTokens.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textLabel,
  },
  title: {
    fontSize: 30,
    color: colors.text,
    ...typeTokens.display,
  },
  chip: {
    paddingHorizontal: 15,
    height: 44,
    justifyContent: 'center',
    borderRadius: radius.md + 1,
    backgroundColor: colors.surfaceRaised,
  },
  chipActive: { backgroundColor: colors.accent },
  chipText: { fontSize: 13, color: colors.textMuted },
  chipTextActive: { color: colors.onAccent, fontWeight: '600' },
  primary: {
    height: 46,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryText: { fontSize: 14, fontWeight: '600' },
  secondary: {
    height: 46,
    minWidth: 46,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceButton,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  check: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  checkRing: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  notice: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  noticeText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  retry: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  empty: { paddingHorizontal: 32, paddingVertical: 44, alignItems: 'center', gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyBody: {
    color: colors.textDim,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 6,
  },
  loading: { paddingVertical: 40, alignItems: 'center', gap: 12 },
  loadingText: { color: colors.textDim, fontSize: 13 },
});
