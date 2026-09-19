import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Badge, Banner, Button, Card, Caption, Empty, Heading, Title } from '../../src/components/ui';
import CowLoader from '../../src/components/CowLoader';
import { NotificationBanner } from '../../src/components/NotificationBanner';
import { NotificationModal } from '../../src/components/NotificationModal';
import { useAuth } from '../../src/lib/auth';
import { useTranslation } from '../../src/i18n';
import { cows as cowsApi, alerts as alertsApi, ApiError } from '../../src/api';
import type { Cow, AlertRead } from '../../src/api/types';
import { cowLabel, cowSubtitle } from '../../src/lib/format';
import { colors, font, radius, size, space } from '../../src/theme';

const styles = StyleSheet.create({
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.milk,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.sindoor,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.milk,
  },
  bellBadgeText: {
    color: colors.milk,
    fontSize: 10,
    fontFamily: font.bodySemi,
    fontWeight: '700',
  },
  bellIdleDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.pasture,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.milk,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    marginTop: space.xs,
    marginBottom: space.sm,
    gap: space.sm,
  },
  statusIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.pastureSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    fontSize: 13,
    fontFamily: font.bodySemi,
    color: colors.ink,
  },
  statusSub: {
    fontSize: 11,
    fontFamily: font.body,
    color: colors.muted,
  },
});

export default function Home() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [herd, setHerd] = useState<Cow[]>([]);
  const [userAlerts, setUserAlerts] = useState<AlertRead[]>([]);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const isFarmer = user?.role === 'farmer';

  const load = useCallback(async () => {
    try {
      if (isFarmer) {
        setHerd(await cowsApi.myHerd());
      }
      const alertsRes = await alertsApi.my();
      setUserAlerts(alertsRes.alerts);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load your records.');
    } finally {
      setLoading(false);
    }
  }, [isFarmer]);

  const handleDismissAlert = async (alertId: string) => {
    setUserAlerts((prev) => prev.filter((a) => a.id !== alertId));
    try {
      await alertsApi.markRead(alertId);
    } catch {
      // ignore
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const firstName = (user?.name ?? '').split(' ')[0];
  const unreadAlertsCount = userAlerts.filter((a) => !a.is_read).length;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.surface }}
        contentContainerStyle={{ padding: space.lg, paddingTop: 64, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.pasture} />}
      >
        {/* Top Header Row with Greeting & Notification Bell */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: space.xs }}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <Caption>{isFarmer ? t('home.yourFarm') : roleLine(user?.role)}</Caption>
            <Title>{firstName ? t('home.greeting', { name: firstName }) : t('landing.heroTitle')}</Title>
          </View>

          <Pressable
            onPress={() => setNotificationModalVisible(true)}
            style={({ pressed }) => [
              styles.bellBtn,
              pressed && { opacity: 0.8, transform: [{ scale: 0.94 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Feather name="bell" size={22} color={colors.ink} />
            {unreadAlertsCount > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadAlertsCount > 9 ? '9+' : unreadAlertsCount}
                </Text>
              </View>
            ) : (
              <View style={styles.bellIdleDot} />
            )}
          </Pressable>
        </View>

        {/* Carousel for Active Urgent Alerts */}
        <NotificationBanner
          alerts={userAlerts}
          onDismiss={handleDismissAlert}
          onPressAlert={(alert) => {
            if (alert.bovine_id) {
              router.push(`/cow/${alert.bovine_id}`);
            } else if (alert.complaint_id) {
              router.push('/(tabs)/complaints');
            } else if (alert.alert_type === 'barn_environment_hazard') {
              router.push('/farm/environment');
            }
          }}
        />

        {/* Quick Status Bar when there are 0 unread alerts */}
        {unreadAlertsCount === 0 && (
          <Pressable
            onPress={() => setNotificationModalVisible(true)}
            style={styles.statusCard}
          >
            <View style={styles.statusIconWrap}>
              <Feather name="shield" size={16} color={colors.pasture} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>All Clear · Health Baseline Normal</Text>
              <Text style={styles.statusSub}>No active mastitis or outbreak warnings</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
        )}

        <View style={{ height: space.md }} />
        <Banner message={error} />

        {isFarmer ? (
          <FarmerHome herd={herd} loading={loading} onOpen={(id) => router.push(`/cow/${id}`)} onAdd={() => router.push('/cow/new')} />
        ) : (
          <StaffHome onLookup={() => router.push('/(tabs)/lookup')} />
        )}
      </ScrollView>

      {/* Full Notification Center Modal */}
      <NotificationModal
        visible={notificationModalVisible}
        alerts={userAlerts}
        onDismiss={() => setNotificationModalVisible(false)}
        onRefreshAlerts={load}
        onPressAlert={(alert) => {
          setNotificationModalVisible(false);
          if (alert.bovine_id) {
            router.push(`/cow/${alert.bovine_id}`);
          } else if (alert.complaint_id) {
            router.push('/(tabs)/complaints');
          } else if (alert.alert_type === 'barn_environment_hazard') {
            router.push('/farm/environment');
          }
        }}
      />
    </>
  );
}

function roleLine(role?: string) {
  if (role === 'doctor') return 'Veterinary officer';
  if (role === 'inspector') return 'Field inspector';
  if (role === 'authority') return 'District authority';
  return '';
}

function FarmerHome({ herd, loading, onOpen, onAdd }: {
  herd: Cow[]; loading: boolean; onOpen: (id: string) => void; onAdd: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();

  if (loading && herd.length === 0) {
    return <CowLoader label={t('common.loading')} />;
  }

  if (herd.length === 0) {
    return (
      <Empty
        title={t('home.emptyHerdTitle')}
        body={t('home.emptyHerdSub')}
        action={<Button label={t('home.addNewCow')} onPress={onAdd} />}
      />
    );
  }

  const milking = herd.filter((c) => (c.lactation_number ?? 0) > 0).length;

  return (
    <>
      <View style={{ flexDirection: 'row', gap: space.md, marginBottom: space.lg }}>
        <Stat value={String(herd.length)} label={t('home.statAnimals')} />
        <Stat value={String(milking)} label={t('home.statInLactation')} tone="milk" />
      </View>

      <Heading>{t('home.yourHerd')}</Heading>
      {herd.map((c) => (
        <Pressable key={c.id} onPress={() => onOpen(c.id)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.pastureSoft,
              alignItems: 'center', justifyContent: 'center', marginRight: space.md,
            }}>
              <Text style={{ fontFamily: font.displayMid, fontSize: size.md, color: colors.pasture }}>
                {(c.name ?? c.tag_number ?? '?').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink }}>{cowLabel(c)}</Text>
              <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginTop: 2 }}>
                {cowSubtitle(c, t) || '—'}
              </Text>
            </View>
            {!c.is_active && <Badge label="Inactive" tone="warn" />}
            <Feather name="chevron-right" size={20} color={colors.muted} style={{ marginLeft: 6 }} />
          </Card>
        </Pressable>
      ))}

      <Button label={t('home.addNewCow')} onPress={onAdd} variant="secondary" />

      {/* Farm IoT & Health Hub */}
      <View style={{ marginTop: space.xl }}>
        <Heading>{t('home.farmMonitoringTitle')}</Heading>
      </View>
      <Pressable onPress={() => router.push('/farm/environment')}>
        <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            width: 44, height: 44, borderRadius: radius.pill, backgroundColor: '#e0f2fe',
            alignItems: 'center', justifyContent: 'center', marginRight: space.md,
          }}>
            <Feather name="wind" size={20} color="#0369a1" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink }}>
              {t('home.barnMonitorTitle')}
            </Text>
            <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginTop: 2 }}>
              {t('home.barnMonitorSub')}
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.muted} />
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/(tabs)/complaints')}>
        <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.marigoldSoft,
            alignItems: 'center', justifyContent: 'center', marginRight: space.md,
          }}>
            <Feather name="alert-circle" size={20} color="#8A5D13" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink }}>
              {t('home.vetComplaintsTitle')}
            </Text>
            <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginTop: 2 }}>
              {t('home.vetComplaintsSub')}
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.muted} />
        </Card>
      </Pressable>
    </>
  );
}

function StaffHome({ onLookup }: { onLookup: () => void }) {
  const router = useRouter();
  return (
    <>
      <Card>
        <Heading>Start from the animal</Heading>
        <Text style={{ fontFamily: font.body, fontSize: size.base, color: colors.bark, lineHeight: 22, marginBottom: space.lg }}>
          Scan the ear tag or type the Pashu Aadhar number to pull up an animal's full history, then log what you found during the visit.
        </Text>
        <Button label="Find an animal" onPress={onLookup} />
      </Card>

      <Pressable onPress={() => router.push('/(tabs)/complaints')}>
        <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.marigoldSoft,
            alignItems: 'center', justifyContent: 'center', marginRight: space.md,
          }}>
            <Feather name="inbox" size={20} color="#8A5D13" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink }}>Field Response Inbox</Text>
            <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginTop: 2 }}>
              View and resolve assigned farmer health complaints
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.muted} />
        </Card>
      </Pressable>

      <Card>
        <Heading>What you can record</Heading>
        <Row icon="activity" text="Disease and treatment records, including chronic conditions" />
        <Row icon="shield" text="Vaccinations given and when the next dose is due" />
        <Row icon="cpu" text="Review continuous collar telemetry & milk quality analytics" />
        <Row icon="map-pin" text="Herd lists for any farmer in your jurisdiction" />
      </Card>
    </>
  );
}

function Row({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.md }}>
      <Feather name={icon} size={17} color={colors.pasture} style={{ marginRight: 10, marginTop: 2 }} />
      <Text style={{ flex: 1, fontFamily: font.body, fontSize: size.base, color: colors.bark, lineHeight: 21 }}>{text}</Text>
    </View>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: 'milk' }) {
  return (
    <View style={{
      flex: 1, backgroundColor: tone === 'milk' ? colors.marigoldSoft : colors.pastureSoft,
      borderRadius: radius.md, padding: space.lg,
    }}>
      <Text style={{ fontFamily: font.display, fontSize: size.xxl, color: colors.ink }}>{value}</Text>
      <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.bark }}>{label}</Text>
    </View>
  );
}

