import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Badge, Banner, Button, Card, Caption, Empty, Heading, Title } from '../../src/components/ui';
import CowLoader from '../../src/components/CowLoader';
import { useAuth } from '../../src/lib/auth';
import { cows as cowsApi, ApiError } from '../../src/api';
import type { Cow } from '../../src/api/types';
import { cowLabel, cowSubtitle } from '../../src/lib/format';
import { colors, font, radius, size, space } from '../../src/theme';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [herd, setHerd] = useState<Cow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const isFarmer = user?.role === 'farmer';

  const load = useCallback(async () => {
    if (!isFarmer) { setLoading(false); return; }
    try {
      setHerd(await cowsApi.myHerd());
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load your herd.');
    } finally {
      setLoading(false);
    }
  }, [isFarmer]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const firstName = (user?.name ?? '').split(' ')[0];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ padding: space.lg, paddingTop: 64, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.pasture} />}
    >
      <Caption>{isFarmer ? 'Your farm' : roleLine(user?.role)}</Caption>
      <Title>{firstName ? `Namaste, ${firstName}` : 'Kamadhenu'}</Title>

      <View style={{ height: space.xl }} />
      <Banner message={error} />

      {isFarmer ? (
        <FarmerHome herd={herd} loading={loading} onOpen={(id) => router.push(`/cow/${id}`)} onAdd={() => router.push('/cow/new')} />
      ) : (
        <StaffHome onLookup={() => router.push('/(tabs)/lookup')} />
      )}
    </ScrollView>
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
  if (loading && herd.length === 0) {
    return <CowLoader label="Loading your herd…" />;
  }

  if (herd.length === 0) {
    return (
      <Empty
        title="No animals yet"
        body="Add your first cow or buffalo to start keeping its health and vaccination history in one place."
        action={<Button label="Add an animal" onPress={onAdd} />}
      />
    );
  }

  const milking = herd.filter((c) => (c.lactation_number ?? 0) > 0).length;

  return (
    <>
      <View style={{ flexDirection: 'row', gap: space.md, marginBottom: space.lg }}>
        <Stat value={String(herd.length)} label="animals" />
        <Stat value={String(milking)} label="in lactation" tone="milk" />
      </View>

      <Heading>Your herd</Heading>
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
                {cowSubtitle(c) || 'Details not filled in'}
              </Text>
            </View>
            {!c.is_active && <Badge label="Inactive" tone="warn" />}
            <Feather name="chevron-right" size={20} color={colors.muted} style={{ marginLeft: 6 }} />
          </Card>
        </Pressable>
      ))}

      <Button label="Add an animal" onPress={onAdd} variant="secondary" />

      {/* Farm IoT & Health Hub */}
      <View style={{ marginTop: space.xl }}>
        <Heading>Farm Monitoring & Support</Heading>
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
            <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink }}>Barn Environment Monitor</Text>
            <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginTop: 2 }}>
              Track ventilation, humidity, bedding moisture & ammonia
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
            <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink }}>Veterinary Complaints</Text>
            <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginTop: 2 }}>
              Request doctor dispatch & track treatment status
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
