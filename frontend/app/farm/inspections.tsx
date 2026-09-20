import React, { useCallback, useEffect, useState } from 'react';
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
import { Badge, Banner, Button, Caption, Card, Empty, Title } from '../../src/components/ui';
import CowLoader from '../../src/components/CowLoader';
import { useAuth } from '../../src/lib/auth';
import { inspections as inspectionsApi, ApiError } from '../../src/api';
import type { FarmInspection, InspectionStatus } from '../../src/api/types';
import { prettyDate } from '../../src/lib/format';
import { colors, font, radius, size, space } from '../../src/theme';

function getStatusDetails(status: InspectionStatus) {
  switch (status) {
    case 'passed':
      return {
        label: 'Grade A · Compliant',
        shortLabel: 'Passed',
        tone: 'good' as const,
        bg: colors.pastureSoft,
        fg: colors.pasture,
        icon: 'check-circle' as const,
      };
    case 'conditional_pass':
      return {
        label: 'Grade B · Attention Needed',
        shortLabel: 'Conditional Pass',
        tone: 'warn' as const,
        bg: colors.marigoldSoft,
        fg: '#8A5D13',
        icon: 'alert-triangle' as const,
      };
    case 'failed':
      return {
        label: 'Grade C · Bio-Hazard Violation',
        shortLabel: 'Failed',
        tone: 'risk' as const,
        bg: colors.sindoorSoft,
        fg: colors.sindoor,
        icon: 'x-circle' as const,
      };
    default:
      return {
        label: status,
        shortLabel: status,
        tone: 'neutral' as const,
        bg: colors.line,
        fg: colors.bark,
        icon: 'info' as const,
      };
  }
}

function ScoreBar({ label, score, max = 5 }: { label: string; score: number; max?: number }) {
  const percentage = Math.min(100, Math.max(0, (score / max) * 100));
  const barColor = score >= 4 ? colors.pasture : score >= 3 ? '#b45309' : colors.sindoor;

  return (
    <View style={styles.scoreRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.scoreLabel}>{label}</Text>
      </View>
      <View style={styles.scoreBarTrack}>
        <View style={[styles.scoreBarFill, { width: `${percentage}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.scoreValue, { color: barColor }]}>{score}/{max}</Text>
    </View>
  );
}

export default function FarmInspectionsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ inspectionId?: string }>();

  const [inspectionsList, setInspectionsList] = useState<FarmInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(params.inspectionId || null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await inspectionsApi.list();
      setInspectionsList(data);
      if (params.inspectionId && data.some((i) => i.id === params.inspectionId)) {
        setExpandedId(params.inspectionId);
      } else if (data.length > 0 && !expandedId) {
        // Expand the most recent by default
        setExpandedId(data[0].id);
      }
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load barn inspections.');
    } finally {
      setLoading(false);
    }
  }, [params.inspectionId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (params.inspectionId) {
      setExpandedId(params.inspectionId);
    }
  }, [params.inspectionId]);

  const latest = inspectionsList.length > 0 ? inspectionsList[0] : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ padding: space.lg, paddingTop: 56, paddingBottom: 56 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.pasture} />}
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
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Feather name="arrow-left" size={19} color={colors.bark} />
        <Text style={{ fontFamily: font.bodyMid, fontSize: size.base, color: colors.bark, marginLeft: 6 }}>
          Back
        </Text>
      </Pressable>

      <Caption>Official Compliance Audits</Caption>
      <Title>Barn & Farm Inspections</Title>
      <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginTop: 4, marginBottom: space.md }}>
        Detailed hygiene, biosecurity & ventilation audit reports filed by certified Field Inspectors.
      </Text>

      <Banner message={error} />

      {latest && (
        <Card style={{ marginBottom: space.lg, backgroundColor: colors.milk, borderColor: colors.line }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.xs }}>
            <Text style={{ fontFamily: font.bodySemi, fontSize: size.xs, color: colors.muted, textTransform: 'uppercase' }}>
              Latest Inspection Status
            </Text>
            <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted }}>
              {prettyDate(latest.inspected_at)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xs }}>
            <View style={{
              width: 52, height: 52, borderRadius: radius.md,
              backgroundColor: getStatusDetails(latest.status).bg,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontFamily: font.display, fontSize: size.xl, color: getStatusDetails(latest.status).fg }}>
                {latest.overall_score}
              </Text>
              <Text style={{ fontFamily: font.bodySemi, fontSize: 9, color: getStatusDetails(latest.status).fg, marginTop: -2 }}>
                / 100
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Feather
                  name={getStatusDetails(latest.status).icon}
                  size={16}
                  color={getStatusDetails(latest.status).fg}
                />
                <Text style={{ fontFamily: font.displayMid, fontSize: size.md, color: colors.ink }}>
                  {getStatusDetails(latest.status).label}
                </Text>
              </View>
              <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.bark, marginTop: 2 }} numberOfLines={2}>
                Inspected by {latest.inspector_name || 'Field Inspector'} · {latest.summary}
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Inspection List */}
      {loading && inspectionsList.length === 0 ? (
        <CowLoader label="Loading official barn inspections…" />
      ) : inspectionsList.length === 0 ? (
        <Empty
          title="No barn inspections yet"
          body="Your farm has not received an official barn inspection yet. When an inspector audits your facility, the biosecurity and hygiene scorecard will appear here."
          action={
            <Button
              label="View Barn Sensors"
              variant="secondary"
              onPress={() => router.push('/farm/environment')}
            />
          }
        />
      ) : (
        inspectionsList.map((item) => {
          const isExpanded = expandedId === item.id;
          const status = getStatusDetails(item.status);

          return (
            <Card key={item.id} style={{ marginBottom: space.md }}>
              {/* Header / Summary row */}
              <Pressable
                onPress={() => setExpandedId(isExpanded ? null : item.id)}
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.xs }}>
                  <View style={{
                    backgroundColor: status.bg,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radius.pill,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <Feather name={status.icon} size={12} color={status.fg} />
                    <Text style={{ fontFamily: font.bodySemi, fontSize: 11, color: status.fg }}>
                      {status.label}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted }}>
                    {prettyDate(item.inspected_at)}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <View style={{ flex: 1, paddingRight: space.sm }}>
                    <Text style={{ fontFamily: font.bodySemi, fontSize: size.base, color: colors.ink }}>
                      Audit Score: {item.overall_score}/100
                    </Text>
                    <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted, marginTop: 2 }}>
                      Auditor: {item.inspector_name || 'Field Inspector'}
                      {item.farmer_place ? ` · ${item.farmer_place}` : ''}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontFamily: font.bodyMid, fontSize: size.xs, color: colors.pasture }}>
                      {isExpanded ? 'Hide Details' : 'View Report'}
                    </Text>
                    <Feather
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.pasture}
                    />
                  </View>
                </View>

                <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.bark, marginTop: space.xs }}>
                  {item.summary}
                </Text>
              </Pressable>

              {/* Detailed Breakdown */}
              {isExpanded && (
                <View style={{ marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.line }}>
                  <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: colors.ink, marginBottom: space.sm }}>
                    Hygiene & Biosecurity Evaluation
                  </Text>

                  <ScoreBar label="Biosecurity & Pest Barrier" score={item.biosecurity_score} />
                  <ScoreBar label="Barn Ventilation & Airflow" score={item.ventilation_score} />
                  <ScoreBar label="Bedding Hygiene & Floor Dryness" score={item.bedding_hygiene_score} />
                  <ScoreBar label="Water & Feed Safety" score={item.water_feed_score} />
                  <ScoreBar label="Milking Sanitation & Teat Care" score={item.milking_hygiene_score} />
                  <ScoreBar label="Animal Housing & Welfare" score={item.animal_welfare_score} />

                  {/* Physical readings observed */}
                  {(item.ammonia_ppm_observed != null || item.bedding_moisture_observed != null) && (
                    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
                      {item.ammonia_ppm_observed != null && (
                        <View style={styles.metricChip}>
                          <Feather
                            name="wind"
                            size={14}
                            color={item.ammonia_ppm_observed > 25 ? colors.sindoor : colors.pasture}
                          />
                          <View>
                            <Text style={styles.metricLabel}>Ammonia (NH3)</Text>
                            <Text style={[styles.metricValue, item.ammonia_ppm_observed > 25 && { color: colors.sindoor }]}>
                              {item.ammonia_ppm_observed.toFixed(1)} ppm
                            </Text>
                          </View>
                        </View>
                      )}
                      {item.bedding_moisture_observed != null && (
                        <View style={styles.metricChip}>
                          <Feather
                            name="droplet"
                            size={14}
                            color={item.bedding_moisture_observed > 50 ? '#b45309' : colors.pasture}
                          />
                          <View>
                            <Text style={styles.metricLabel}>Bedding Moisture</Text>
                            <Text style={[styles.metricValue, item.bedding_moisture_observed > 50 && { color: '#b45309' }]}>
                              {item.bedding_moisture_observed.toFixed(0)}%
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Deficiencies / Violations */}
                  {item.deficiencies ? (
                    <View style={styles.deficienciesBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Feather name="alert-circle" size={15} color={colors.sindoor} style={{ marginRight: 6 }} />
                        <Text style={{ fontFamily: font.bodySemi, fontSize: size.xs, color: colors.sindoor, textTransform: 'uppercase' }}>
                          Deficiencies & Non-Compliances
                        </Text>
                      </View>
                      <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.ink }}>
                        {item.deficiencies}
                      </Text>
                    </View>
                  ) : null}

                  {/* Corrective Recommendations */}
                  {item.recommendations ? (
                    <View style={styles.recommendationsBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Feather name="check-square" size={15} color={colors.pasture} style={{ marginRight: 6 }} />
                        <Text style={{ fontFamily: font.bodySemi, fontSize: size.xs, color: colors.pasture, textTransform: 'uppercase' }}>
                          Corrective Action Plan
                        </Text>
                      </View>
                      <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.ink, lineHeight: 20 }}>
                        {item.recommendations}
                      </Text>
                    </View>
                  ) : null}

                  {/* Follow-up info */}
                  {item.follow_up_required && (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.marigoldSoft,
                      padding: space.sm,
                      borderRadius: radius.md,
                      marginTop: space.sm,
                    }}>
                      <Feather name="calendar" size={15} color="#8A5D13" style={{ marginRight: 8 }} />
                      <Text style={{ fontFamily: font.bodySemi, fontSize: size.xs, color: '#8A5D13' }}>
                        Follow-up Inspection Required
                        {item.follow_up_date ? ` by ${prettyDate(item.follow_up_date)}` : ''}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreLabel: {
    fontFamily: font.body,
    fontSize: size.xs,
    color: colors.bark,
  },
  scoreBarTrack: {
    width: 100,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.line,
    marginHorizontal: space.sm,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  scoreValue: {
    fontFamily: font.bodySemi,
    fontSize: size.xs,
    width: 28,
    textAlign: 'right',
  },
  metricChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.sm,
    borderRadius: radius.md,
  },
  metricLabel: {
    fontFamily: font.body,
    fontSize: 10,
    color: colors.muted,
  },
  metricValue: {
    fontFamily: font.bodySemi,
    fontSize: size.sm,
    color: colors.ink,
  },
  deficienciesBox: {
    backgroundColor: colors.sindoorSoft,
    borderColor: colors.sindoor,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
    marginTop: space.sm,
  },
  recommendationsBox: {
    backgroundColor: colors.pastureSoft,
    borderColor: colors.pasture,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
    marginTop: space.sm,
  },
});
