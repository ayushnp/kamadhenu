import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Badge, Banner, Button, Caption, Card, Empty, Title } from '../../../src/components/ui';
import CowLoader from '../../../src/components/CowLoader';
import TrendLineChart from '../../../src/components/charts/TrendLineChart';
import { useAuth } from '../../../src/lib/auth';
import { cows as cowsApi, risk as riskApi, sensors as sensorsApi, ApiError } from '../../../src/api';
import type {
  AIGuidance,
  CowWithHistory,
  MilkReading,
  RiskResponse,
  WearableReading,
} from '../../../src/api/types';
import { cowLabel, cowSubtitle, prettyDate } from '../../../src/lib/format';
import { colors, font, radius, size, space } from '../../../src/theme';

export default function CattleTrendsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [windowDays, setWindowDays] = useState<7 | 14>(14);
  const [cow, setCow] = useState<CowWithHistory | null>(null);
  const [riskLatest, setRiskLatest] = useState<RiskResponse | null>(null);
  const [riskHistory, setRiskHistory] = useState<RiskResponse[]>([]);
  const [wearableHistory, setWearableHistory] = useState<WearableReading[]>([]);
  const [milkHistory, setMilkHistory] = useState<MilkReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'risk' | 'milk' | 'collar'>('all');

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [cowData, latestRisk, riskHist, wearableData, milkData] = await Promise.all([
        cowsApi.detail(id),
        riskApi.latest(id).catch(() => null),
        riskApi.history(id, windowDays).catch(() => []),
        sensorsApi.cowWearable(id, windowDays).catch(() => []),
        sensorsApi.cowMilk(id, windowDays).catch(() => []),
      ]);

      setCow(cowData);
      setRiskLatest(latestRisk);
      setRiskHistory(riskHist || []);
      setWearableHistory(wearableData || []);
      setMilkHistory(milkData || []);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load cattle biometric trends.');
    } finally {
      setLoading(false);
    }
  }, [id, windowDays]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  if (loading && !cow) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: 'center' }}>
        <CowLoader label="Loading 14-day biometric curves…" />
      </View>
    );
  }

  if (!cow) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, padding: space.lg, paddingTop: 64 }}>
        <Banner message={error || 'Animal not found.'} />
        <Button label="Back" onPress={() => router.back()} variant="secondary" />
      </View>
    );
  }

  // Prepare chart series data
  const riskChartData = riskHistory.map((r) => ({
    date: r.scored_at,
    value: r.score,
  }));

  const ecChartData = milkHistory
    .filter((m) => m.electrical_conductivity != null)
    .map((m) => ({
      date: m.recorded_at,
      value: Number(m.electrical_conductivity),
    }));

  const phChartData = milkHistory
    .filter((m) => m.ph != null)
    .map((m) => ({
      date: m.recorded_at,
      value: Number(m.ph),
    }));

  const ruminationChartData = wearableHistory
    .filter((w) => w.rumination_minutes != null)
    .map((w) => ({
      date: w.recorded_at,
      value: Number(w.rumination_minutes),
    }));

  const tempChartData = wearableHistory
    .filter((w) => w.body_temperature != null)
    .map((w) => ({
      date: w.recorded_at,
      value: Number(w.body_temperature),
    }));

  const activityChartData = wearableHistory
    .filter((w) => w.activity_index != null)
    .map((w) => ({
      date: w.recorded_at,
      value: Number(w.activity_index),
    }));

  const isVet = user?.role === 'doctor';
  const isInspector = user?.role === 'inspector';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ padding: space.lg, paddingTop: 56, paddingBottom: 64 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={colors.pasture} />}
    >
      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: space.md,
          opacity: pressed ? 0.7 : 1,
          alignSelf: 'flex-start',
        })}
      >
        <Feather name="arrow-left" size={19} color={colors.bark} />
        <Text style={{ fontFamily: font.bodyMid, fontSize: size.base, color: colors.bark, marginLeft: 6 }}>
          Back to Animal Profile
        </Text>
      </Pressable>

      <Caption>Biometric Telemetry & Risk Radar</Caption>
      <Title>Cattle Trend Dashboard</Title>
      <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginTop: 2, marginBottom: space.md }}>
        {cowLabel(cow)} · {cowSubtitle(cow) || 'Herd Member'}
      </Text>

      <Banner message={error} />

      {/* Time Window Switcher (7D vs 14D) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[7, 14].map((d) => {
            const active = windowDays === d;
            return (
              <Pressable
                key={d}
                onPress={() => setWindowDays(d as 7 | 14)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: radius.pill,
                  backgroundColor: active ? colors.pasture : colors.milk,
                  borderWidth: 1,
                  borderColor: active ? colors.pasture : colors.line,
                }}
              >
                <Text
                  style={{
                    fontFamily: font.bodySemi,
                    fontSize: size.xs,
                    color: active ? colors.milk : colors.ink,
                  }}
                >
                  {d} Days
                </Text>
              </Pressable>
            );
          })}
        </View>

        {riskLatest && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor:
              riskLatest.category === 'high'
                ? colors.sindoorSoft
                : riskLatest.category === 'moderate'
                ? colors.marigoldSoft
                : colors.pastureSoft,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: radius.pill,
          }}>
            <Text style={{
              fontFamily: font.bodySemi,
              fontSize: 11,
              color:
                riskLatest.category === 'high'
                  ? colors.sindoor
                  : riskLatest.category === 'moderate'
                  ? '#8A5D13'
                  : colors.pasture,
            }}>
              Latest Risk: {riskLatest.score.toFixed(0)}/100 ({riskLatest.category.toUpperCase()})
            </Text>
          </View>
        )}
      </View>

      {/* Category Pills Filter */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: space.md }}>
        {[
          { key: 'all', label: 'All Curves' },
          { key: 'risk', label: 'Risk Score' },
          { key: 'milk', label: 'Milk Quality' },
          { key: 'collar', label: 'Collar Vitals' },
        ].map((t) => {
          const active = activeTab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setActiveTab(t.key as any)}
              style={{
                flex: 1,
                paddingVertical: 6,
                borderRadius: radius.md,
                backgroundColor: active ? colors.ink : colors.milk,
                borderWidth: 1,
                borderColor: active ? colors.ink : colors.line,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: font.bodySemi,
                  fontSize: 11,
                  color: active ? colors.milk : colors.bark,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 1. Mastitis Risk Score Trend Curve */}
      {(activeTab === 'all' || activeTab === 'risk') && (
        <TrendLineChart
          title="🤖 AI Mastitis Probability Trajectory"
          subtitle="Dynamic XGBoost probability output over observation window"
          data={riskChartData}
          color={
            (riskLatest?.score ?? 0) >= 60
              ? colors.sindoor
              : (riskLatest?.score ?? 0) >= 30
              ? '#b45309'
              : colors.pasture
          }
          unit="/100"
          thresholdValue={55}
          thresholdLabel="Action Threshold"
          thresholdColor={colors.sindoor}
          minY={0}
          maxY={100}
          emptyMessage="No AI risk evaluations logged in this window. Tap 'Run AI Assessment' below."
        />
      )}

      {/* 2. Milk Electrical Conductivity Curve */}
      {(activeTab === 'all' || activeTab === 'milk') && (
        <TrendLineChart
          title="🥛 Milk Electrical Conductivity (EC)"
          subtitle="Tissue inflammation causes sodium/chloride leakage into milk"
          data={ecChartData}
          color="#0284c7"
          unit="mS/cm"
          thresholdValue={5.8}
          thresholdLabel="Subclinical Threshold"
          thresholdColor={colors.sindoor}
          minY={4.0}
          maxY={8.0}
          emptyMessage="No milking EC telemetry found for this period."
        />
      )}

      {/* 3. Milk pH Curve */}
      {(activeTab === 'all' || activeTab === 'milk') && (
        <TrendLineChart
          title="🧪 Milk pH Balance"
          subtitle="Normal milk pH is slightly acidic (6.4 - 6.8); mastitis increases alkalinity"
          data={phChartData}
          color="#7c3aed"
          unit="pH"
          thresholdValue={6.8}
          thresholdLabel="Alkaline Warning"
          thresholdColor={colors.sindoor}
          minY={6.0}
          maxY={7.5}
          emptyMessage="No milk pH readings recorded."
        />
      )}

      {/* 4. Wearable Rumination Minutes */}
      {(activeTab === 'all' || activeTab === 'collar') && (
        <TrendLineChart
          title="🐮 Rumination Duration"
          subtitle="Sharp rumination drops indicate systemic pain or infection 24-48h early"
          data={ruminationChartData}
          color={colors.pasture}
          unit="min"
          thresholdValue={15}
          thresholdLabel="Critical Slowdown"
          thresholdColor={colors.sindoor}
          minY={0}
          emptyMessage="No collar rumination sensor data received."
        />
      )}

      {/* 5. Wearable Body Temperature */}
      {(activeTab === 'all' || activeTab === 'collar') && (
        <TrendLineChart
          title="🌡️ Cow Body Temperature"
          subtitle="Normal bovine internal temperature: 38.0°C – 39.3°C"
          data={tempChartData}
          color="#dc2626"
          unit="°C"
          thresholdValue={39.5}
          thresholdLabel="Fever Line"
          thresholdColor="#b91c1c"
          minY={37.0}
          maxY={41.0}
          emptyMessage="No collar temperature readings available."
        />
      )}

      {/* Clinical Correlation Card */}
      <Card style={{ backgroundColor: colors.milk, marginTop: space.sm, marginBottom: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Feather name="activity" size={16} color={colors.pasture} style={{ marginRight: 6 }} />
          <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: colors.ink }}>
            Multi-Sensor Clinical Insights
          </Text>
        </View>
        <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.bark, lineHeight: 18 }}>
          {riskLatest?.category === 'high'
            ? '⚠️ High mastitis probability detected: Multiple biometric markers confirm abnormal tissue permeability and systemic response. Prompt intervention advised.'
            : riskLatest?.category === 'moderate'
            ? '⚡ Subclinical warning: Conductivity fluctuations observed. Perform a California Mastitis Test (CMT) before condition advances to clinical mastitis.'
            : '✅ Health parameters stable: Rumination patterns and electrical conductivity are tracking well within physiological norms.'}
        </Text>
      </Card>

      {/* Groq AI Guidance Summary if present */}
      {riskLatest?.ai_guidance && (
        <Card style={{ backgroundColor: colors.pastureSoft, borderColor: colors.pasture, borderWidth: 1, marginBottom: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="cpu" size={16} color={colors.pasture} />
              <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: colors.pasture }}>
                AI Guidance ({riskLatest.ai_guidance.model_name || 'Groq Llama-3.3'})
              </Text>
            </View>
            <Badge
              label={riskLatest.ai_guidance.urgency.replace('_', ' ').toUpperCase()}
              tone={riskLatest.ai_guidance.urgency === 'immediate' ? 'risk' : 'good'}
            />
          </View>

          <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: colors.ink, marginTop: 4 }}>
            {riskLatest.ai_guidance.verdict}
          </Text>

          <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.bark, marginTop: 6 }}>
            {riskLatest.ai_guidance.explanation_plain}
          </Text>

          {riskLatest.ai_guidance.immediate_actions?.length > 0 && (
            <View style={{ marginTop: space.sm }}>
              <Text style={{ fontFamily: font.bodySemi, fontSize: size.xs, color: colors.ink, marginBottom: 4 }}>
                Recommended Farmer Actions:
              </Text>
              {riskLatest.ai_guidance.immediate_actions.map((act, i) => (
                <Text key={i} style={{ fontFamily: font.body, fontSize: size.xs, color: colors.bark, marginLeft: 6, marginBottom: 2 }}>
                  • {act}
                </Text>
              ))}
            </View>
          )}
        </Card>
      )}

      {/* Role-tailored action buttons */}
      <View style={{ gap: space.sm }}>
        {isVet && (
          <Button
            label="Log Clinical Exam & Treatment"
            onPress={() => router.push(`/cow/health?cowId=${cow.id}`)}
          />
        )}
        {isInspector && (
          <Button
            label="Conduct Barn Inspection"
            onPress={() => router.push('/staff/inspector')}
          />
        )}
        <Button
          label="Raise / View Health Complaints"
          variant="secondary"
          onPress={() => router.push(`/complaints/new?cowId=${cow.id}`)}
        />
      </View>
    </ScrollView>
  );
}
