import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Badge, Banner, Button, Caption, Card, Empty, Heading, Segmented, Title } from '../../src/components/ui';
import CowLoader from '../../src/components/CowLoader';
import { cows as cowsApi, sensors as sensorsApi, ApiError } from '../../src/api';
import type { CowTelemetrySummary, CowWithHistory, MilkReading, WearableReading } from '../../src/api/types';
import { useAuth } from '../../src/lib/auth';
import { cowLabel, cowSubtitle, daysUntil, nextDue, openConditions, prettyDate } from '../../src/lib/format';
import { colors, font, radius, size, space } from '../../src/theme';

type Tab = 'health' | 'vaccines' | 'telemetry' | 'identity';

export default function CowDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [cow, setCow] = useState<CowWithHistory | null>(null);
  const [telemetry, setTelemetry] = useState<CowTelemetrySummary | null>(null);
  const [tab, setTab] = useState<Tab>('health');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [cowData, telemetryData] = await Promise.all([
        cowsApi.detail(id),
        sensorsApi.cowSummary(id, 14).catch(() => null),
      ]);
      setCow(cowData);
      setTelemetry(telemetryData);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load this animal.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading && !cow) {
    return <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: 'center' }}><CowLoader label="Fetching animal…" /></View>;
  }

  if (!cow) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ padding: space.lg, paddingTop: 64 }}>
        <Banner message={error || 'Animal not found.'} />
        <Button label="Go back" onPress={() => router.back()} variant="secondary" />
      </ScrollView>
    );
  }

  const open = openConditions(cow.health_records);
  const due = nextDue(cow.vaccinations);
  const dueIn = daysUntil(due?.next_due_date ?? null);
  const canEdit = user?.role === 'farmer' && user.id === cow.farmer_id;

  const latestWearable = telemetry?.wearable && telemetry.wearable.length > 0 ? telemetry.wearable[0] : null;
  const recentMilk = telemetry?.milk && telemetry.milk.length > 0 ? telemetry.milk.slice(0, 4) : [];
  const mastitisQuarter = recentMilk.find((m) => m.electrical_conductivity > 5.8 || m.ph > 6.8 || (m.cmt_result && m.cmt_result !== 'negative'));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ padding: space.lg, paddingTop: 56, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.pasture} />}
    >
      <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.lg }}>
        <Feather name="arrow-left" size={19} color={colors.bark} />
        <Text style={{ fontFamily: font.bodyMid, fontSize: size.base, color: colors.bark, marginLeft: 6 }}>Back</Text>
      </Pressable>

      <Caption>{cow.pashu_aadhar ? `Pashu Aadhar ${cow.pashu_aadhar}` : cow.species}</Caption>
      <Title>{cowLabel(cow)}</Title>
      <Text style={{ fontFamily: font.body, fontSize: size.base, color: colors.muted, marginTop: 4 }}>
        {cowSubtitle(cow) || 'Details not filled in'}
      </Text>

      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md, marginBottom: space.md, flexWrap: 'wrap' }}>
        {open.length > 0
          ? <Badge label={`${open.length} open condition${open.length > 1 ? 's' : ''}`} tone="risk" />
          : <Badge label="No open conditions" tone="good" />}
        {dueIn != null && (
          <Badge
            label={dueIn < 0 ? `Vaccine overdue by ${Math.abs(dueIn)} d` : `Next vaccine in ${dueIn} d`}
            tone={dueIn < 0 ? 'risk' : dueIn < 30 ? 'warn' : 'neutral'}
          />
        )}
        {(cow.lactation_number ?? 0) > 0 && <Badge label={`Lactation ${cow.lactation_number}`} tone="neutral" />}
        {mastitisQuarter && <Badge label={`Mastitis risk (${mastitisQuarter.quarter})`} tone="risk" />}
      </View>

      {/* Quick Action: Raise Complaint */}
      <View style={{ marginBottom: space.lg }}>
        <Button
          label="🚨 Raise Health Complaint"
          onPress={() => router.push(`/complaints/new?cowId=${cow.id}`)}
          variant="secondary"
        />
      </View>

      <Banner message={error} />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'health', label: `Health (${cow.health_records.length})` },
          { value: 'vaccines', label: `Vaccines (${cow.vaccinations.length})` },
          { value: 'telemetry', label: `Sensors (${(telemetry?.wearable_records_count ?? 0) + (telemetry?.milk_records_count ?? 0)})` },
          { value: 'identity', label: 'Identity' },
        ]}
      />

      {tab === 'health' && (
        <>
          {cow.health_records.length === 0 ? (
            <Empty title="No health records" body="Log a diagnosis, a treatment or a chronic condition so the next visit starts with the full picture." />
          ) : (
            [...cow.health_records]
              .sort((a, b) => (b.diagnosed_date ?? b.created_at).localeCompare(a.diagnosed_date ?? a.created_at))
              .map((r) => (
                <Card key={r.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink, flex: 1 }}>{r.disease_name}</Text>
                    {r.resolved_date ? <Badge label="Resolved" tone="good" /> : <Badge label="Open" tone="risk" />}
                  </View>
                  <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginTop: 4 }}>
                    Diagnosed {prettyDate(r.diagnosed_date)}
                    {r.resolved_date ? ` · resolved ${prettyDate(r.resolved_date)}` : ''}
                  </Text>
                  {r.treatment ? <Detail label="Treatment" value={r.treatment} /> : null}
                  {r.notes ? <Detail label="Notes" value={r.notes} /> : null}
                  {r.is_comorbidity ? <View style={{ marginTop: space.md }}><Badge label="Chronic / co-existing" tone="warn" /></View> : null}
                </Card>
              ))
          )}
          <Button label="Add a health record" onPress={() => router.push(`/cow/health?cowId=${cow.id}`)} />
        </>
      )}

      {tab === 'vaccines' && (
        <>
          {cow.vaccinations.length === 0 ? (
            <Empty title="No vaccinations recorded" body="Record the vaccine, the date given and when the next dose falls due." />
          ) : (
            [...cow.vaccinations]
              .sort((a, b) => b.date_administered.localeCompare(a.date_administered))
              .map((v) => {
                const d = daysUntil(v.next_due_date);
                return (
                  <Card key={v.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink, flex: 1 }}>{v.vaccine_name}</Text>
                      {d != null && <Badge label={d < 0 ? 'Overdue' : d < 30 ? 'Due soon' : 'Up to date'} tone={d < 0 ? 'risk' : d < 30 ? 'warn' : 'good'} />}
                    </View>
                    <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginTop: 4 }}>
                      Given {prettyDate(v.date_administered)}
                      {v.next_due_date ? ` · next due ${prettyDate(v.next_due_date)}` : ''}
                    </Text>
                    {v.disease_covered ? <Detail label="Covers" value={v.disease_covered} /> : null}
                    {v.administered_by ? <Detail label="Given by" value={v.administered_by} /> : null}
                    {v.batch_number ? <Detail label="Batch" value={v.batch_number} /> : null}
                    {v.notes ? <Detail label="Notes" value={v.notes} /> : null}
                  </Card>
                );
              })
          )}
          <Button label="Add a vaccination" onPress={() => router.push(`/cow/vaccination?cowId=${cow.id}`)} />
        </>
      )}

      {tab === 'telemetry' && (
        <>
          {/* Collar Wearable Telemetry */}
          <Heading>Collar Vitals</Heading>
          {latestWearable ? (
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm }}>
                <Text style={{ fontFamily: font.bodyMid, fontSize: size.xs, color: colors.muted }}>
                  LATEST SYNC: {prettyDate(latestWearable.recorded_at)}
                </Text>
                {latestWearable.latitude != null && (
                  <Badge label="GPS Active" tone="good" />
                )}
              </View>

              <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.sm }}>
                <TelemetryCard
                  title="Body Temp"
                  value={latestWearable.body_temperature != null ? `${latestWearable.body_temperature.toFixed(1)}°C` : '—'}
                  status={
                    latestWearable.body_temperature == null
                      ? 'neutral'
                      : latestWearable.body_temperature > 39.5
                      ? 'risk'
                      : 'good'
                  }
                  hint="Normal: 38.0–39.2°C"
                />
                <TelemetryCard
                  title="Rumination"
                  value={`${latestWearable.rumination_minutes.toFixed(0)} min`}
                  status={latestWearable.rumination_minutes < 15 ? 'warn' : 'good'}
                  hint="Chewing index"
                />
              </View>

              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <TelemetryCard
                  title="Activity Index"
                  value={latestWearable.activity_index.toFixed(1)}
                  status="neutral"
                  hint="Movement magnitude"
                />
                <TelemetryCard
                  title="Lying Time"
                  value={latestWearable.lying_time_minutes != null ? `${latestWearable.lying_time_minutes.toFixed(0)} min` : '—'}
                  status="neutral"
                  hint="Rest period"
                />
              </View>
            </Card>
          ) : (
            <Card>
              <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted }}>
                No collar readings received yet for this animal.
              </Text>
            </Card>
          )}

          {/* Milk Analyzer Telemetry */}
          <View style={{ marginTop: space.lg }}>
            <Heading>Milking & Udder Analytics</Heading>
          </View>
          {recentMilk.length > 0 ? (
            <>
              {mastitisQuarter && (
                <Card style={{ backgroundColor: colors.sindoorSoft, borderColor: colors.sindoor }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Feather name="alert-triangle" size={17} color={colors.sindoor} style={{ marginRight: 6 }} />
                    <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: colors.sindoor }}>
                      Subclinical Mastitis Warning detected in {mastitisQuarter.quarter} quarter!
                    </Text>
                  </View>
                  <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.bark, marginBottom: space.sm }}>
                    Electrical conductivity ({mastitisQuarter.electrical_conductivity.toFixed(2)} mS/cm) or pH ({mastitisQuarter.ph.toFixed(2)}) is outside normal threshold.
                  </Text>
                  <Button
                    label="Raise Urgent Complaint"
                    onPress={() => router.push(`/complaints/new?cowId=${cow.id}`)}
                  />
                </Card>
              )}

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {recentMilk.map((m) => (
                  <View
                    key={m.id}
                    style={{
                      flex: 1,
                      minWidth: '46%',
                      backgroundColor: colors.milk,
                      borderRadius: radius.md,
                      padding: space.md,
                      borderWidth: 1,
                      borderColor: m.electrical_conductivity > 5.8 ? colors.sindoor : colors.line,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontFamily: font.displayMid, fontSize: size.base, color: colors.ink }}>
                        Quarter {m.quarter}
                      </Text>
                      {m.cmt_result && <Badge label={`CMT ${m.cmt_result}`} tone={m.cmt_result === 'negative' ? 'good' : 'warn'} />}
                    </View>
                    <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted, marginTop: 4 }}>
                      EC: {m.electrical_conductivity.toFixed(2)} mS/cm
                    </Text>
                    <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted }}>
                      pH: {m.ph.toFixed(2)} {m.ph > 6.8 ? '(alkaline)' : ''}
                    </Text>
                    {m.scc != null && (
                      <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.bark, marginTop: 2 }}>
                        SCC: {m.scc.toLocaleString()} cells/mL
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Card>
              <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted }}>
                No 4-quarter milk testing records found.
              </Text>
            </Card>
          )}
        </>
      )}

      {tab === 'identity' && (
        <Card>
          <Line label="Pashu Aadhar" value={cow.pashu_aadhar ?? '—'} />
          <Line label="Ear tag" value={cow.tag_number ?? '—'} />
          <Line label="Barcode" value={cow.barcode ?? '—'} />
          <Line label="Breed" value={cow.breed ?? '—'} />
          <Line label="Species" value={cow.species} />
          <Line label="Age" value={cow.age_years != null ? `${cow.age_years} years` : '—'} />
          <Line label="Calves" value={cow.calf_number != null ? String(cow.calf_number) : '—'} />
          <Line label="Lactation number" value={cow.lactation_number != null ? String(cow.lactation_number) : '—'} />
          <Line
            label="Location"
            value={cow.latitude != null && cow.longitude != null ? `${cow.latitude.toFixed(4)}, ${cow.longitude.toFixed(4)}` : '—'}
          />
          {canEdit && (
            <View style={{ marginTop: space.lg }}>
              <Button label="Edit details" onPress={() => router.push(`/cow/new?editId=${cow.id}`)} variant="secondary" />
            </View>
          )}
        </Card>
      )}
    </ScrollView>
  );
}

function TelemetryCard({
  title,
  value,
  status,
  hint,
}: {
  title: string;
  value: string;
  status: 'good' | 'warn' | 'risk' | 'neutral';
  hint: string;
}) {
  const fg = status === 'risk' ? colors.sindoor : status === 'warn' ? colors.marigold : colors.ink;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.sm, padding: space.md, borderWidth: 1, borderColor: colors.line }}>
      <Text style={{ fontFamily: font.bodyMid, fontSize: size.xs, color: colors.muted }}>{title}</Text>
      <Text style={{ fontFamily: font.displayMid, fontSize: size.lg, color: fg, marginVertical: 2 }}>{value}</Text>
      <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.bark }}>{hint}</Text>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginTop: space.md, backgroundColor: colors.surface, borderRadius: radius.sm, padding: space.md }}>
      <Text style={{ fontFamily: font.bodyMid, fontSize: size.xs, color: colors.muted, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontFamily: font.body, fontSize: size.base, color: colors.bark, lineHeight: 21 }}>{value}</Text>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Text style={{ fontFamily: font.body, fontSize: size.base, color: colors.muted }}>{label}</Text>
      <Text style={{ fontFamily: font.bodyMid, fontSize: size.base, color: colors.ink, maxWidth: '58%', textAlign: 'right' }}>{value}</Text>
    </View>
  );
}
