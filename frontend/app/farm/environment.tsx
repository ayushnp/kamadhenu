import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Badge, Banner, Button, Caption, Card, Empty, Field, Heading, Title } from '../../src/components/ui';
import CowLoader from '../../src/components/CowLoader';
import { useAuth } from '../../src/lib/auth';
import { sensors as sensorsApi, ApiError } from '../../src/api';
import type { EnvironmentReading } from '../../src/api/types';
import { prettyDate } from '../../src/lib/format';
import { colors, font, radius, size, space } from '../../src/theme';

export default function FarmEnvironmentScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [history, setHistory] = useState<EnvironmentReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Manual logging modal / form
  const [isLogging, setIsLogging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    ambient_temperature: '',
    humidity: '',
    bedding_moisture: '',
    ammonia_ppm: '',
    hygiene_score: '2',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const readings = await sensorsApi.farmEnvironment(7);
      setHistory(readings);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load barn environmental conditions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const latest = history.length > 0 ? history[0] : null;

  async function handleRecord() {
    if (!f.ambient_temperature || !f.humidity || !f.bedding_moisture) {
      return setError('Please enter temperature, humidity and bedding moisture.');
    }

    setSaving(true);
    setError('');
    try {
      await sensorsApi.ingestEnvironment({
        farmer_id: user?.id,
        farmer_phone: user?.phone,
        ambient_temperature: parseFloat(f.ambient_temperature),
        humidity: parseFloat(f.humidity),
        bedding_moisture: parseFloat(f.bedding_moisture),
        ammonia_ppm: f.ammonia_ppm ? parseFloat(f.ammonia_ppm) : null,
        hygiene_score: parseInt(f.hygiene_score, 10) || 2,
      });

      setNotice('Barn environment telemetry logged successfully.');
      setIsLogging(false);
      setF({ ambient_temperature: '', humidity: '', bedding_moisture: '', ammonia_ppm: '', hygiene_score: '2' });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to record environment reading.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.surface }}
        contentContainerStyle={{ padding: space.lg, paddingTop: 56, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.pasture} />}
      >
        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.lg }}>
          <Feather name="arrow-left" size={19} color={colors.bark} />
          <Text style={{ fontFamily: font.bodyMid, fontSize: size.base, color: colors.bark, marginLeft: 6 }}>Back</Text>
        </Pressable>

        <Caption>Barn IoT node</Caption>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title>Barn Environment</Title>
          <View style={{ minWidth: 110 }}>
            <Button
              label={isLogging ? 'Cancel' : '+ Log reading'}
              onPress={() => { setIsLogging(!isLogging); setNotice(''); }}
              variant="secondary"
            />
          </View>
        </View>

        <Text style={{ fontFamily: font.body, fontSize: size.base, color: colors.muted, marginTop: 4, marginBottom: space.lg }}>
          Monitor shed ventilation, temperature humidity index (THI), bedding moisture, and toxic ammonia buildup.
        </Text>

        <Banner message={error} />
        <Banner message={notice} tone="good" />

        {/* Manual Ingestion Form */}
        {isLogging && (
          <Card>
            <Heading>Record Barn Reading</Heading>
            <Field
              label="Ambient Temperature (°C)"
              value={f.ambient_temperature}
              onChangeText={(v) => setF({ ...f, ambient_temperature: v })}
              placeholder="e.g. 26.5"
              keyboardType="numeric"
            />
            <Field
              label="Relative Humidity (%)"
              value={f.humidity}
              onChangeText={(v) => setF({ ...f, humidity: v })}
              placeholder="e.g. 68"
              keyboardType="numeric"
            />
            <Field
              label="Bedding Moisture (%)"
              value={f.bedding_moisture}
              onChangeText={(v) => setF({ ...f, bedding_moisture: v })}
              placeholder="e.g. 35"
              keyboardType="numeric"
            />
            <Field
              label="Ammonia Gas Level (ppm)"
              value={f.ammonia_ppm}
              onChangeText={(v) => setF({ ...f, ammonia_ppm: v })}
              placeholder="e.g. 12.0 (Alert threshold > 25 ppm)"
              keyboardType="numeric"
            />
            <Field
              label="Hygiene Score (1: Clean to 4: Dirty)"
              value={f.hygiene_score}
              onChangeText={(v) => setF({ ...f, hygiene_score: v })}
              placeholder="1, 2, 3, or 4"
              keyboardType="number-pad"
            />
            <Button label="Submit Barn Telemetry" onPress={handleRecord} loading={saving} />
          </Card>
        )}

        {/* Latest Snapshot Cards */}
        {latest ? (
          <>
            <Heading>Current Barn Vitals</Heading>
            <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted, marginBottom: space.sm }}>
              Last updated: {prettyDate(latest.recorded_at)}
            </Text>

            {latest.ammonia_ppm != null && latest.ammonia_ppm > 25 && (
              <Card style={{ backgroundColor: colors.sindoorSoft, borderColor: colors.sindoor, marginBottom: space.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="alert-triangle" size={18} color={colors.sindoor} style={{ marginRight: 6 }} />
                  <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: colors.sindoor }}>
                    High Ammonia Concentration ({latest.ammonia_ppm.toFixed(1)} ppm)
                  </Text>
                </View>
                <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.bark, marginTop: 4 }}>
                  Ensure barn ventilation fans are operational to prevent bovine respiratory illness.
                </Text>
              </Card>
            )}

            <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.sm }}>
              <VitalCard
                label="Temperature"
                value={`${latest.ambient_temperature.toFixed(1)}°C`}
                hint={latest.ambient_temperature > 30 ? 'Heat stress risk' : 'Optimal'}
                tone={latest.ambient_temperature > 30 ? 'warn' : 'good'}
              />
              <VitalCard
                label="Humidity"
                value={`${latest.humidity.toFixed(0)}%`}
                hint={latest.humidity > 80 ? 'High moisture' : 'Moderate'}
                tone={latest.humidity > 80 ? 'warn' : 'neutral'}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
              <VitalCard
                label="Bedding Moisture"
                value={`${latest.bedding_moisture.toFixed(0)}%`}
                hint={latest.bedding_moisture > 50 ? 'Wet bedding risk' : 'Dry stall floor'}
                tone={latest.bedding_moisture > 50 ? 'risk' : 'good'}
              />
              <VitalCard
                label="Ammonia Gas"
                value={latest.ammonia_ppm != null ? `${latest.ammonia_ppm.toFixed(1)} ppm` : '—'}
                hint="Threshold < 25 ppm"
                tone={latest.ammonia_ppm != null && latest.ammonia_ppm > 25 ? 'risk' : 'good'}
              />
            </View>

            <Heading>Recent Barn Logs</Heading>
            {history.map((r) => (
              <Card key={r.id} style={{ marginBottom: space.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: colors.ink }}>
                    {prettyDate(r.recorded_at)}
                  </Text>
                  {r.hygiene_score != null && (
                    <Badge
                      label={`Hygiene ${r.hygiene_score}/4`}
                      tone={r.hygiene_score <= 2 ? 'good' : 'warn'}
                    />
                  )}
                </View>
                <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted, marginTop: 4 }}>
                  Temp: {r.ambient_temperature.toFixed(1)}°C · Humidity: {r.humidity.toFixed(0)}% · Bedding: {r.bedding_moisture.toFixed(0)}%
                  {r.ammonia_ppm != null ? ` · NH3: ${r.ammonia_ppm.toFixed(1)} ppm` : ''}
                </Text>
              </Card>
            ))}
          </>
        ) : loading ? (
          <CowLoader label="Loading barn conditions…" />
        ) : (
          <Empty
            title="No barn telemetry"
            body="No environmental readings logged for your farm yet. Connect your barn IoT sensor or tap '+ Log reading' to manually track conditions."
            action={<Button label="Log a reading" onPress={() => setIsLogging(true)} />}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function VitalCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'good' | 'warn' | 'risk' | 'neutral';
}) {
  const fg = tone === 'risk' ? colors.sindoor : tone === 'warn' ? colors.marigold : colors.ink;
  const bg = tone === 'risk' ? colors.sindoorSoft : tone === 'warn' ? colors.marigoldSoft : colors.milk;
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: radius.md, padding: space.md, borderWidth: 1, borderColor: colors.line }}>
      <Text style={{ fontFamily: font.bodyMid, fontSize: size.xs, color: colors.muted }}>{label}</Text>
      <Text style={{ fontFamily: font.display, fontSize: size.xl, color: fg, marginVertical: 2 }}>{value}</Text>
      <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.bark }}>{hint}</Text>
    </View>
  );
}
