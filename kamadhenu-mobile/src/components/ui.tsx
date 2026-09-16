import React from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput,
  TextInputProps, View, ViewProps,
} from 'react-native';
import { colors, font, radius, size, space } from '../theme';

/* ── Text ─────────────────────────────────────────────────────────────────── */
export const Title = ({ children }: { children: React.ReactNode }) => (
  <Text style={t.title}>{children}</Text>
);
export const Heading = ({ children }: { children: React.ReactNode }) => (
  <Text style={t.heading}>{children}</Text>
);
export const Body = ({ children, dim }: { children: React.ReactNode; dim?: boolean }) => (
  <Text style={[t.body, dim && { color: colors.muted }]}>{children}</Text>
);
export const Caption = ({ children }: { children: React.ReactNode }) => (
  <Text style={t.caption}>{children}</Text>
);

/* ── Card ─────────────────────────────────────────────────────────────────── */
export function Card({ children, style, ...rest }: ViewProps) {
  return <View style={[t.card, style]} {...rest}>{children}</View>;
}

/* ── Badge ────────────────────────────────────────────────────────────────── */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'good' | 'warn' | 'risk' }) {
  const map = {
    neutral: [colors.surface, colors.bark],
    good: [colors.pastureSoft, colors.pasture],
    warn: [colors.marigoldSoft, '#8A5D13'],
    risk: [colors.sindoorSoft, colors.sindoor],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[t.badge, { backgroundColor: bg }]}>
      <Text style={[t.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/* ── Button ───────────────────────────────────────────────────────────────── */
export function Button({
  label, onPress, variant = 'primary', loading, disabled,
}: {
  label: string; onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost'; loading?: boolean; disabled?: boolean;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      style={({ pressed }) => [
        t.btn,
        variant === 'primary' && { backgroundColor: colors.pasture },
        variant === 'secondary' && { backgroundColor: colors.milk, borderWidth: 1, borderColor: colors.line },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        off && { opacity: 0.5 },
        pressed && !off && { transform: [{ scale: 0.985 }], opacity: 0.9 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.milk : colors.pasture} />
      ) : (
        <Text style={[t.btnText, variant !== 'primary' && { color: colors.pasture }]}>{label}</Text>
      )}
    </Pressable>
  );
}

/* ── Field ────────────────────────────────────────────────────────────────── */
export function Field({
  label, hint, ...rest
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={t.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={t.input}
        {...rest}
      />
      {hint ? <Text style={t.hint}>{hint}</Text> : null}
    </View>
  );
}

/* ── Segmented control ────────────────────────────────────────────────────── */
export function Segmented<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={t.segWrap}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[t.seg, on && t.segOn]}>
            <Text style={[t.segText, on && { color: colors.milk }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ── Banner ───────────────────────────────────────────────────────────────── */
export function Banner({ message, tone = 'risk' }: { message: string; tone?: 'risk' | 'good' }) {
  if (!message) return null;
  const risk = tone === 'risk';
  return (
    <View style={[t.banner, { backgroundColor: risk ? colors.sindoorSoft : colors.pastureSoft }]}>
      <Text style={[t.bannerText, { color: risk ? colors.sindoor : colors.pasture }]}>{message}</Text>
    </View>
  );
}

/* ── Empty state ──────────────────────────────────────────────────────────── */
export function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <View style={t.empty}>
      <Text style={t.emptyTitle}>{title}</Text>
      <Text style={t.emptyBody}>{body}</Text>
      {action ? <View style={{ marginTop: space.lg, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  if (!scroll) return <View style={t.screen}>{children}</View>;
  return (
    <ScrollView style={t.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      {children}
    </ScrollView>
  );
}

const t = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  title: { fontFamily: font.display, fontSize: size.xxl, color: colors.ink, lineHeight: 40 },
  heading: { fontFamily: font.displayMid, fontSize: size.lg, color: colors.ink, marginBottom: space.sm },
  body: { fontFamily: font.body, fontSize: size.base, color: colors.bark, lineHeight: 22 },
  caption: { fontFamily: font.body, fontSize: size.sm, color: colors.muted },

  card: {
    backgroundColor: colors.milk, borderRadius: radius.md, padding: space.lg,
    borderWidth: 1, borderColor: colors.line, marginBottom: space.md,
  },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontFamily: font.bodySemi, fontSize: size.xs },

  btn: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  btnText: { fontFamily: font.bodySemi, fontSize: size.md, color: colors.milk },

  label: { fontFamily: font.bodyMid, fontSize: size.sm, color: colors.bark, marginBottom: 6 },
  input: {
    height: 50, backgroundColor: colors.milk, borderRadius: radius.sm, borderWidth: 1,
    borderColor: colors.line, paddingHorizontal: space.md,
    fontFamily: font.body, fontSize: size.md, color: colors.ink,
  },
  hint: { fontFamily: font.body, fontSize: size.xs, color: colors.muted, marginTop: 5 },

  segWrap: {
    flexDirection: 'row', backgroundColor: colors.milk, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.line, padding: 3, marginBottom: space.lg,
  },
  seg: { flex: 1, height: 38, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.pasture },
  segText: { fontFamily: font.bodyMid, fontSize: size.sm, color: colors.bark },

  banner: { borderRadius: radius.sm, padding: space.md, marginBottom: space.lg },
  bannerText: { fontFamily: font.bodyMid, fontSize: size.sm, lineHeight: 20 },

  empty: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: space.xl },
  emptyTitle: { fontFamily: font.displayMid, fontSize: size.lg, color: colors.ink, marginBottom: 6 },
  emptyBody: { fontFamily: font.body, fontSize: size.base, color: colors.muted, textAlign: 'center', lineHeight: 22 },
});
