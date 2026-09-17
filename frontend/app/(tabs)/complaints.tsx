import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Badge, Banner, Button, Card, Caption, Empty, Segmented, Title } from '../../src/components/ui';
import CowLoader from '../../src/components/CowLoader';
import { useAuth } from '../../src/lib/auth';
import { complaints as complaintsApi, ApiError } from '../../src/api';
import type { Complaint, ComplaintPriority, ComplaintStatus } from '../../src/api/types';
import { prettyDate } from '../../src/lib/format';
import { colors, font, radius, size, space } from '../../src/theme';

type StatusFilter = 'all' | 'open' | 'assigned' | 'in_progress' | 'resolved';

export default function ComplaintsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  const isFarmer = user?.role === 'farmer';
  const isDoctorOrInspector = user?.role === 'doctor' || user?.role === 'inspector';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = filter === 'all' ? undefined : (filter as ComplaintStatus);
      const res = await complaintsApi.list(statusParam ? { status: statusParam } : undefined);
      setItems(res);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load complaints.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openCount = items.filter((c) => c.status === 'open' || c.status === 'assigned').length;
  const inProgressCount = items.filter((c) => c.status === 'in_progress').length;
  const resolvedCount = items.filter((c) => c.status === 'resolved' || c.status === 'closed').length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ padding: space.lg, paddingTop: 64, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.pasture} />}
    >
      <Caption>
        {isFarmer
          ? 'Animal healthcare requests'
          : isDoctorOrInspector
          ? 'Field response inbox'
          : 'District complaint oversight'}
      </Caption>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title>Complaints</Title>
        {isFarmer && (
          <View style={{ minWidth: 90 }}>
            <Button
              label="+ New"
              onPress={() => router.push('/complaints/new')}
            />
          </View>
        )}
      </View>

      <View style={{ height: space.md }} />
      <Banner message={error} />

      {/* Overview Stat Counters */}
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
        <StatCounter value={String(openCount)} label="Open / Assigned" tone="warn" />
        <StatCounter value={String(inProgressCount)} label="In Progress" tone="info" />
        <StatCounter value={String(resolvedCount)} label="Resolved" tone="good" />
      </View>

      {/* Filter Tabs */}
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'open', label: 'Open' },
          { value: 'assigned', label: 'Assigned' },
          { value: 'in_progress', label: 'Active' },
          { value: 'resolved', label: 'Resolved' },
        ]}
      />

      {loading && items.length === 0 ? (
        <CowLoader label="Loading complaints…" />
      ) : items.length === 0 ? (
        <Empty
          title={filter === 'all' ? 'No complaints' : `No ${filter.replace('_', ' ')} complaints`}
          body={
            isFarmer
              ? 'If any animal falls ill or exhibits unusual behavior, raise a complaint for GPS auto-dispatch.'
              : 'Complaints assigned to you or in your jurisdiction will appear here.'
          }
          action={
            isFarmer ? (
              <Button label="Raise a complaint" onPress={() => router.push('/complaints/new')} />
            ) : undefined
          }
        />
      ) : (
        items.map((c) => (
          <Pressable key={c.id} onPress={() => router.push(`/complaints/${c.id}`)}>
            <Card style={{ marginBottom: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Text style={{ fontFamily: font.displayMid, fontSize: size.base, color: colors.ink }}>
                    {c.complaint_ref || `#${c.complaint_number ?? '—'}`}
                  </Text>
                  <PriorityBadge priority={c.priority} />
                </View>
                <StatusBadge status={c.status} />
              </View>

              <Text
                style={{
                  fontFamily: font.bodySemi,
                  fontSize: size.md,
                  color: colors.ink,
                  marginTop: space.sm,
                }}
                numberOfLines={2}
              >
                {c.description}
              </Text>

              {c.symptoms ? (
                <Text
                  style={{
                    fontFamily: font.body,
                    fontSize: size.sm,
                    color: colors.muted,
                    marginTop: 4,
                  }}
                  numberOfLines={1}
                >
                  Symptoms: {c.symptoms}
                </Text>
              ) : null}

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: space.md,
                  paddingTop: space.sm,
                  borderTopWidth: 1,
                  borderTopColor: colors.line,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="clock" size={13} color={colors.muted} style={{ marginRight: 4 }} />
                  <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted }}>
                    {prettyDate(c.created_at)}
                  </Text>
                  {c.animal_lat != null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
                      <Feather name="map-pin" size={13} color={colors.pasture} style={{ marginRight: 2 }} />
                      <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.pasture }}>
                        GPS locked
                      </Text>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontFamily: font.bodyMid, fontSize: size.xs, color: colors.pasture }}>
                    Details
                  </Text>
                  <Feather name="chevron-right" size={16} color={colors.pasture} />
                </View>
              </View>
            </Card>
          </Pressable>
        ))
      )}

      {isFarmer && items.length > 0 && (
        <View style={{ marginTop: space.md }}>
          <Button label="Raise another complaint" onPress={() => router.push('/complaints/new')} variant="secondary" />
        </View>
      )}
    </ScrollView>
  );
}

function StatCounter({ value, label, tone }: { value: string; label: string; tone: 'warn' | 'info' | 'good' }) {
  const bg = tone === 'good' ? colors.pastureSoft : tone === 'warn' ? colors.marigoldSoft : '#e0f2fe';
  const fg = tone === 'good' ? colors.pasture : tone === 'warn' ? '#8A5D13' : '#0369a1';
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: radius.md, padding: space.md }}>
      <Text style={{ fontFamily: font.display, fontSize: size.xl, color: fg }}>{value}</Text>
      <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.bark, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  const map: Record<ComplaintStatus, { label: string; tone: 'neutral' | 'warn' | 'good' | 'risk' }> = {
    open: { label: 'Open', tone: 'neutral' },
    assigned: { label: 'Assigned', tone: 'warn' },
    in_progress: { label: 'In Progress', tone: 'warn' },
    resolved: { label: 'Resolved', tone: 'good' },
    closed: { label: 'Closed', tone: 'neutral' },
  };
  const conf = map[status] ?? { label: status, tone: 'neutral' };
  return <Badge label={conf.label} tone={conf.tone} />;
}

export function PriorityBadge({ priority }: { priority: ComplaintPriority }) {
  const map: Record<ComplaintPriority, { label: string; tone: 'neutral' | 'warn' | 'risk' }> = {
    low: { label: 'Low', tone: 'neutral' },
    medium: { label: 'Medium', tone: 'warn' },
    high: { label: 'High', tone: 'risk' },
    critical: { label: 'Critical', tone: 'risk' },
  };
  const conf = map[priority] ?? { label: priority, tone: 'neutral' };
  return <Badge label={conf.label} tone={conf.tone} />;
}
