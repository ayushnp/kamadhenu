import React, { useRef, useState } from 'react';
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
import { useTranslation } from '../../src/i18n';
import LanguageModal from '../../src/components/LanguageModal';
import { colors, font, radius, size, space } from '../../src/theme';

/* ── Animated role card ────────────────────────────────────────────────────── */
function RoleCard({
  role,
  onPress,
}: {
  role: {
    id: string;
    emoji: string;
    title: string;
    subtitle: string;
    accent: string;
    accentSoft: string;
    available: boolean;
  };
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
                <Text style={styles.soonText}>SOON</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardSub} numberOfLines={2}>
            {role.subtitle}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* ── Main Landing Screen ───────────────────────────────────────────────────── */
export default function LandingScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [langModalVisible, setLangModalVisible] = useState(false);

  const roles = [
    {
      id: 'farmer',
      emoji: '🐄',
      title: t('landing.farmerTitle'),
      subtitle: t('landing.farmerSub'),
      accent: colors.pasture,
      accentSoft: colors.pastureSoft,
      available: true,
    },
    {
      id: 'doctor',
      emoji: '🩺',
      title: t('landing.doctorTitle'),
      subtitle: t('landing.doctorSub'),
      accent: '#2970B8',
      accentSoft: '#E0EDFC',
      available: false,
    },
    {
      id: 'inspector',
      emoji: '🔍',
      title: t('landing.inspectorTitle'),
      subtitle: t('landing.inspectorSub'),
      accent: colors.marigold,
      accentSoft: colors.marigoldSoft,
      available: false,
    },
    {
      id: 'authority',
      emoji: '🏛️',
      title: t('landing.authorityTitle'),
      subtitle: t('landing.authoritySub'),
      accent: colors.sindoor,
      accentSoft: colors.sindoorSoft,
      available: false,
    },
  ];

  function handleRolePress(roleId: string, available: boolean) {
    if (!available) {
      const msg = 'This portal is under development and will be available soon.';
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm }}>
          <Text style={styles.logoText}>🌿 KAMADHENU</Text>
          <Pressable
            onPress={() => setLangModalVisible(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.pastureSoft,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: colors.pasture + '40',
            }}
          >
            <Text style={{ fontSize: 13, marginRight: 4 }}>🌐</Text>
            <Text style={{ fontFamily: font.bodySemi, fontSize: size.xs, color: colors.pasture }}>
              {locale === 'kn' ? 'ಕನ್ನಡ' : locale === 'hi' ? 'हिंदी' : 'English'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.tagline}>VIMARSHA · Bovine AI</Text>
        <Text style={styles.heading}>{t('landing.chooseRole')}</Text>
        <Text style={styles.subheading}>
          {t('landing.heroSubtitle')}
        </Text>
      </View>

      {/* Role cards */}
      <View style={styles.cards}>
        {roles.map((role) => (
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

      <LanguageModal
        visible={langModalVisible}
        onDismiss={() => setLangModalVisible(false)}
      />
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
