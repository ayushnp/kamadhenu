import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, font, radius, size, space } from '../../src/theme';

/* ── Role card data ────────────────────────────────────────────────────────── */
const ROLES = [
  {
    id: 'farmer',
    emoji: '🐄',
    title: 'Farmer',
    subtitle: 'Manage your herd, track health & milk yield',
    accent: colors.pasture,
    accentSoft: colors.pastureSoft,
    available: true,
  },
  {
    id: 'doctor',
    emoji: '🩺',
    title: 'Veterinary Doctor',
    subtitle: 'Review cases, diagnose & prescribe treatment',
    accent: '#2970B8',
    accentSoft: '#E0EDFC',
    available: false,
  },
  {
    id: 'inspector',
    emoji: '🔍',
    title: 'Inspector',
    subtitle: 'Conduct field visits and submit compliance reports',
    accent: colors.marigold,
    accentSoft: colors.marigoldSoft,
    available: false,
  },
  {
    id: 'authority',
    emoji: '🏛️',
    title: 'District Authority',
    subtitle: 'Monitor district-wide herd health & alerts',
    accent: colors.sindoor,
    accentSoft: colors.sindoorSoft,
    available: false,
  },
] as const;

/* ── Animated role card ────────────────────────────────────────────────────── */
function RoleCard({
  role,
  onPress,
}: {
  role: (typeof ROLES)[number];
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={({ pressed }) => [
          styles.card,
          { borderColor: role.accent + '40' },
          pressed && { opacity: 0.92 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${role.title} login`}
      >
        {/* Accent strip on left */}
        <View style={[styles.accentStrip, { backgroundColor: role.accent }]} />

        <View style={[styles.emojiWrap, { backgroundColor: role.accentSoft }]}>
          <Text style={styles.emoji}>{role.emoji}</Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardTitle, { color: role.accent }]}>{role.title}</Text>
            {!role.available && (
              <View style={styles.soonBadge}>
                <Text style={styles.soonText}>Coming soon</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardSub}>{role.subtitle}</Text>
        </View>

        {/* Arrow indicator */}
        <Text style={[styles.arrow, { color: role.accent + '99' }]}>›</Text>
      </Pressable>
    </Animated.View>
  );
}

/* ── Landing screen ────────────────────────────────────────────────────────── */
export default function LandingScreen() {
  const router = useRouter();

  function handleRolePress(roleId: string, available: boolean) {
    if (!available) {
      const msg =
        'This portal is coming soon. Login credentials will be issued by your district authority.';
      if (Platform.OS === 'android') {
        ToastAndroid.show(msg, ToastAndroid.LONG);
      } else {
        Alert.alert('Coming Soon', msg);
      }
      return;
    }
    router.push('/(auth)/login');
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logoText}>🌿 KAMADHENU</Text>
        <Text style={styles.tagline}>VIMARSHA · Bovine AI</Text>
        <Text style={styles.heading}>Who are you?</Text>
        <Text style={styles.subheading}>
          Select your role to sign in or create an account.
        </Text>
      </View>

      {/* Role cards */}
      <View style={styles.cards}>
        {ROLES.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            onPress={() => handleRolePress(role.id, role.available)}
          />
        ))}
      </View>

      {/* Footer note */}
      <Text style={styles.footer}>
        Credentials for veterinary, inspector &amp; authority portals are issued by your
        district animal husbandry department.
      </Text>
    </ScrollView>
  );
}

/* ── Styles ────────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl + 8,
  },
  header: {
    paddingTop: 64,
    paddingBottom: space.xl,
  },
  logoText: {
    fontFamily: font.display,
    fontSize: size.sm,
    color: colors.pasture,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  tagline: {
    fontFamily: font.bodyMid,
    fontSize: size.xs,
    color: colors.muted,
    letterSpacing: 2,
    marginBottom: space.xl,
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: font.display,
    fontSize: size.xxl,
    color: colors.ink,
    lineHeight: 40,
  },
  subheading: {
    fontFamily: font.body,
    fontSize: size.base,
    color: colors.bark,
    marginTop: 6,
    lineHeight: 22,
  },
  cards: {
    gap: space.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.milk,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  accentStrip: {
    width: 5,
    alignSelf: 'stretch',
  },
  emojiWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    margin: space.md,
  },
  emoji: {
    fontSize: 26,
  },
  cardBody: {
    flex: 1,
    paddingVertical: space.md,
    paddingRight: space.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontFamily: font.bodySemi,
    fontSize: size.md,
  },
  cardSub: {
    fontFamily: font.body,
    fontSize: size.sm,
    color: colors.bark,
    marginTop: 3,
    lineHeight: 18,
  },
  soonBadge: {
    backgroundColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  soonText: {
    fontFamily: font.bodyMid,
    fontSize: size.xs,
    color: colors.muted,
  },
  arrow: {
    fontSize: 28,
    paddingRight: space.lg,
    fontFamily: font.body,
  },
  footer: {
    fontFamily: font.body,
    fontSize: size.xs,
    color: colors.muted,
    textAlign: 'center',
    marginTop: space.xxl,
    lineHeight: 18,
    paddingHorizontal: space.md,
  },
});
