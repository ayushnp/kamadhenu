/**
 * GIS Heatmap Screen — Authority / Doctor / Inspector
 *
 * Renders an interactive OpenStreetMap + Leaflet GIS Heatmap with:
 *   • Real OpenStreetMap tile rendering (100% free, zero Google API keys required)
 *   • Dynamic Heatmap density overlay using leaflet-heat
 *   • Distinct marker pins with custom severity badges & tap popups
 *   • Layer toggles: All / Risk Zones / Open Complaints
 *   • Real-time stats & Top Hotspots bottom sheet
 *   • Cross-platform support: Android (WebView), iOS (WebView), and Web (iframe)
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Banner } from '../../src/components/ui';
import { useAuth } from '../../src/lib/auth';
import { heatmap as heatmapApi, ApiError } from '../../src/api';
import type { HeatmapData, HeatmapPoint, HeatmapKind } from '../../src/api/types';
import { colors, font, radius, size, space } from '../../src/theme';

// ── Types ────────────────────────────────────────────────────────────────────

type LayerMode = 'all' | 'risk' | 'complaint';

// ── Helpers ──────────────────────────────────────────────────────────────────

function severityColor(severity: string): string {
  switch (severity) {
    case 'high':
    case 'critical': return colors.sindoor;
    case 'moderate':
    case 'warning':  return colors.marigold;
    default:         return colors.pasture;
  }
}

// ── Leaflet HTML Builder ──────────────────────────────────────────────────────

function buildLeafletHtml(
  points: HeatmapPoint[],
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  layerMode: LayerMode
): string {
  const pointsJson = JSON.stringify(points);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>GIS Heatmap</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; padding: 0; background: #18281d; overflow: hidden; }
    #map { width: 100%; height: 100%; }

    /* Custom Leaflet Controls */
    .leaflet-control-zoom {
      border: none !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.18) !important;
      border-radius: 10px !important;
      overflow: hidden;
      margin-right: 16px !important;
      margin-bottom: 270px !important;
    }
    .leaflet-control-zoom a {
      background-color: #ffffff !important;
      color: #1c2b21 !important;
      font-size: 16px !important;
      width: 36px !important;
      height: 36px !important;
      line-height: 36px !important;
    }

    /* Popups */
    .leaflet-popup-content-wrapper {
      border-radius: 12px;
      padding: 4px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.25);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .leaflet-popup-content {
      margin: 8px 12px;
      line-height: 1.4;
    }
    .popup-title {
      font-weight: 700;
      font-size: 14px;
      color: #1c2b21;
      margin-bottom: 2px;
    }
    .popup-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .popup-meta {
      font-size: 12px;
      color: #555555;
    }
    .popup-score {
      font-weight: 700;
      color: #1c2b21;
    }

    /* Marker styling */
    .marker-pin {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2.5px solid #ffffff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      font-size: 11px;
      font-weight: bold;
      color: #ffffff;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
  <script>
    var points = ${pointsJson};
    var initialCenter = [${centerLat}, ${centerLng}];

    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView(initialCenter, 10);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // High quality OpenStreetMap tiles
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c']
    }).addTo(map);

    if (points && points.length > 0) {
      // 1. Heatmap layer
      var heatData = points.map(function(p) {
        return [p.lat, p.lng, Math.max(p.weight, 0.2)];
      });

      L.heatLayer(heatData, {
        radius: 35,
        blur: 24,
        maxZoom: 13,
        max: 1.0,
        gradient: {
          0.1: '#22c55e', // safe green
          0.35: '#eab308', // low yellow
          0.65: '#f97316', // moderate orange
          0.9: '#ef4444', // high red
          1.0: '#7f1d1d'  // critical dark red
        }
      }).addTo(map);

      // 2. Markers for hotspots & complaints
      var bounds = L.latLngBounds();

      points.forEach(function(p) {
        bounds.extend([p.lat, p.lng]);

        var isCritical = p.weight >= 0.75;
        var isComplaint = p.kind === 'complaint';

        var bg = '#22c55e';
        var badgeBg = '#dcfce7';
        var badgeText = '#15803d';

        if (p.severity === 'high' || p.severity === 'critical') {
          bg = '#ef4444';
          badgeBg = '#fee2e2';
          badgeText = '#b91c1c';
        } else if (p.severity === 'moderate' || p.severity === 'warning') {
          bg = '#f97316';
          badgeBg = '#ffedd5';
          badgeText = '#c2410c';
        } else if (p.severity === 'low') {
          bg = '#eab308';
          badgeBg = '#fef9c3';
          badgeText = '#a16207';
        }

        // Show marker icon for high-risk points and all complaints
        if (isCritical || isComplaint || points.length <= 25) {
          var icon = L.divIcon({
            className: '',
            html: '<div class="marker-pin" style="background-color: ' + bg + ';">' +
                  (isComplaint ? '🚨' : Math.round(p.weight * 100)) +
                  '</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            popupAnchor: [0, -14]
          });

          var marker = L.marker([p.lat, p.lng], { icon: icon }).addTo(map);

          var popupContent =
            '<div class="popup-title">' + p.label + '</div>' +
            '<span class="popup-badge" style="background-color: ' + badgeBg + '; color: ' + badgeText + ';">' +
              p.severity.toUpperCase() + ' · ' + p.kind.toUpperCase() +
            '</span>' +
            '<div class="popup-meta">' +
              'Intensity: <span class="popup-score">' + Math.round(p.weight * 100) + '%</span><br/>' +
              'GPS: ' + p.lat.toFixed(4) + ', ' + p.lng.toFixed(4) +
            '</div>';

          marker.bindPopup(popupContent);
        }
      });

      // Fit map to fit all points snugly
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
      }
    }
  </script>
</body>
</html>`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function LayerButton({
  label, icon, active, onPress,
}: { label: string; icon: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.layerBtn,
        active && styles.layerBtnActive,
        pressed && { opacity: 0.8 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather
        name={icon as any}
        size={14}
        color={active ? colors.milk : colors.bark}
        style={{ marginRight: 4 }}
      />
      <Text style={[styles.layerBtnText, active && styles.layerBtnTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function StatPill({
  label, value, color,
}: { label: string; value: number | string; color: string }) {
  return (
    <View style={[styles.statPill, { borderColor: color + '44', backgroundColor: color + '11' }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LegendGradient() {
  const steps = [
    { label: 'Safe',     color: '#22c55e' },
    { label: 'Low',      color: '#eab308' },
    { label: 'Moderate', color: '#f97316' },
    { label: 'High',     color: '#ef4444' },
    { label: 'Critical', color: '#7f1d1d' },
  ];
  return (
    <View style={styles.legendRow}>
      <View style={styles.legendBar}>
        {steps.map((s, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: s.color }} />
        ))}
      </View>
      <View style={styles.legendLabels}>
        {steps.map((s, i) => (
          <Text key={i} style={styles.legendText}>{s.label}</Text>
        ))}
      </View>
    </View>
  );
}

function TopHotspotCard({ points }: { points: HeatmapPoint[] }) {
  const hotspots = [...points]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);

  return (
    <View style={styles.hotspotCard}>
      <View style={styles.hotspotHeader}>
        <Feather name="thermometer" size={14} color={colors.sindoor} style={{ marginRight: 6 }} />
        <Text style={styles.hotspotTitle}>Priority Hotspots ({points.length} total)</Text>
      </View>
      {hotspots.map((p, i) => {
        const pct = Math.round(p.weight * 100);
        const col = severityColor(p.severity);
        return (
          <View key={i} style={styles.hotspotRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hotspotName} numberOfLines={1}>{p.label}</Text>
              <Text style={styles.hotspotSub}>{p.kind.toUpperCase()} · {p.severity} · ({p.lat.toFixed(3)}, {p.lng.toFixed(3)})</Text>
            </View>
            <View style={[styles.hotspotBadge, { backgroundColor: col + '22' }]}>
              <Text style={[styles.hotspotBadgeText, { color: col }]}>{pct}%</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HeatmapScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [data, setData]             = useState<HeatmapData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState('');
  const [layer, setLayer]           = useState<LayerMode>('all');
  const [pulseAnim]                 = useState(new Animated.Value(1));

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  };

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const result = await heatmapApi.riskPoints({ days: 14 });
      setData(result);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load heatmap data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fetchData();
    startPulse();
  }, [fetchData]));

  // Filter points based on selected layer
  const visiblePoints: HeatmapPoint[] = useMemo(() => {
    if (!data) return [];
    if (layer === 'all') return data.points;
    return data.points.filter((p) => p.kind === layer);
  }, [data, layer]);

  const riskCount      = data?.total_risk_points ?? 0;
  const complaintCount = data?.total_complaint_points ?? 0;
  const totalPoints    = data?.points.length ?? 0;

  // Build the Leaflet HTML content
  const leafletHtml = useMemo(() => {
    const clat = data?.center_lat ?? 12.55;
    const clng = data?.center_lng ?? 76.81;
    const rad  = data?.bounds_radius_km ?? 50;
    return buildLeafletHtml(visiblePoints, clat, clng, rad, layer);
  }, [visiblePoints, data?.center_lat, data?.center_lng, data?.bounds_radius_km, layer]);

  return (
    <View style={styles.container}>
      {/* ── OpenStreetMap / Leaflet Map ──────────────────────────────────── */}
      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          // Web iframe rendering
          <iframe
            srcDoc={leafletHtml}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="GIS Heatmap"
          />
        ) : (
          // Native Android & iOS WebView
          <WebView
            originWhitelist={['*']}
            source={{ html: leafletHtml }}
            style={styles.webView}
            javaScriptEnabled
            domStorageEnabled
            scalesPageToFit={false}
          />
        )}
      </View>

      {/* ── Top Header Card Overlay ──────────────────────────────────────── */}
      <View style={styles.headerOverlay}>
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Feather name="arrow-left" size={18} color={colors.ink} />
            </Pressable>

            <View style={{ flex: 1, marginLeft: space.xs }}>
              <Text style={styles.headerTitle}>District Risk Heatmap</Text>
              <Text style={styles.headerSub}>
                {user?.jurisdiction ?? 'Mandya District'} · Last 14 days
              </Text>
            </View>

            <Pressable
              onPress={() => fetchData(true)}
              style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Refresh map"
            >
              {refreshing
                ? <ActivityIndicator size={16} color={colors.pasture} />
                : <Feather name="refresh-cw" size={16} color={colors.pasture} />}
            </Pressable>
          </View>

          {/* Layer toggles */}
          <View style={styles.layerRow}>
            <LayerButton label="All Points"  icon="layers"        active={layer === 'all'}       onPress={() => setLayer('all')} />
            <LayerButton label="Risk Zones"  icon="activity"      active={layer === 'risk'}      onPress={() => setLayer('risk')} />
            <LayerButton label="Complaints"  icon="alert-circle"  active={layer === 'complaint'} onPress={() => setLayer('complaint')} />
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <StatPill label="Risk Points"  value={riskCount}            color={colors.sindoor} />
            <StatPill label="Complaints"   value={complaintCount}       color={colors.marigold} />
            <StatPill label="On Map"       value={visiblePoints.length} color={colors.pasture} />
          </View>
        </View>
      </View>

      {/* ── Loading Spinner Overlay ──────────────────────────────────────── */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <Animated.View style={[styles.loadingCard, { transform: [{ scale: pulseAnim }] }]}>
            <ActivityIndicator size="large" color={colors.pasture} />
            <Text style={styles.loadingText}>Fetching GIS hotspot data…</Text>
          </Animated.View>
        </View>
      )}

      {/* ── Error Banner ─────────────────────────────────────────────────── */}
      {!!error && (
        <View style={styles.errorBanner}>
          <Banner message={error} />
        </View>
      )}

      {/* ── Bottom Sheet with Legend & Hotspots ─────────────────────────── */}
      {!loading && data && (
        <View style={styles.bottomSheet}>
          <ScrollView
            horizontal={false}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 240 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={colors.pasture} />
            }
          >
            {/* Legend */}
            <View style={styles.sectionHeader}>
              <Feather name="info" size={13} color={colors.muted} style={{ marginRight: 5 }} />
              <Text style={styles.sectionTitle}>Heatmap Density Scale</Text>
            </View>
            <LegendGradient />

            {/* No data state */}
            {totalPoints === 0 && (
              <View style={styles.emptyState}>
                <Feather name="check-circle" size={24} color={colors.pasture} />
                <Text style={styles.emptyTitle}>No active risk zones</Text>
                <Text style={styles.emptySub}>All farms in your district are within safe thresholds.</Text>
              </View>
            )}

            {/* Hotspots list */}
            {visiblePoints.length > 0 && <TopHotspotCard points={visiblePoints} />}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#18281d',
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#18281d',
  },
  webView: {
    flex: 1,
    backgroundColor: '#18281d',
  },

  // ── Header Overlay ──────────────────────────────────────────────────────────
  headerOverlay: {
    position: 'absolute',
    top: 48,
    left: space.md,
    right: space.md,
  },
  headerCard: {
    backgroundColor: colors.milk,
    borderRadius: radius.lg,
    padding: space.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 8,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  headerTitle: {
    fontFamily: font.display,
    fontSize: size.md,
    color: colors.ink,
  },
  headerSub: {
    fontFamily: font.body,
    fontSize: size.xs,
    color: colors.muted,
    marginTop: 1,
  },
  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.pastureSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Layer Row ───────────────────────────────────────────────────────────────
  layerRow: {
    flexDirection: 'row',
    gap: space.xs,
    marginBottom: space.sm,
  },
  layerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  layerBtnActive: {
    backgroundColor: colors.pasture,
    borderColor: colors.pasture,
  },
  layerBtnText: {
    fontFamily: font.bodySemi,
    fontSize: size.xs,
    color: colors.bark,
  },
  layerBtnTextActive: {
    color: colors.milk,
  },

  // ── Stat Pills ──────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: space.xs,
  },
  statPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.xs,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: font.display,
    fontSize: size.md,
  },
  statLabel: {
    fontFamily: font.body,
    fontSize: 10,
    color: colors.muted,
    textAlign: 'center',
  },

  // ── Loading ─────────────────────────────────────────────────────────────────
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(24, 40, 29, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    backgroundColor: colors.milk,
    borderRadius: radius.lg,
    padding: space.xl,
    alignItems: 'center',
    gap: space.md,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  loadingText: {
    fontFamily: font.bodyMid,
    fontSize: size.base,
    color: colors.bark,
  },

  // ── Error Banner ────────────────────────────────────────────────────────────
  errorBanner: {
    position: 'absolute',
    bottom: 270,
    left: space.md,
    right: space.md,
  },

  // ── Bottom Sheet ────────────────────────────────────────────────────────────
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.milk,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.xs,
    marginTop: space.xs,
  },
  sectionTitle: {
    fontFamily: font.bodySemi,
    fontSize: size.sm,
    color: colors.bark,
  },

  // ── Legend ──────────────────────────────────────────────────────────────────
  legendRow: {
    marginBottom: space.sm,
  },
  legendBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 4,
  },
  legendLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendText: {
    fontFamily: font.body,
    fontSize: 10,
    color: colors.muted,
  },

  // ── Empty State ─────────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: space.xl,
    gap: space.sm,
  },
  emptyTitle: {
    fontFamily: font.bodySemi,
    fontSize: size.base,
    color: colors.pasture,
  },
  emptySub: {
    fontFamily: font.body,
    fontSize: size.sm,
    color: colors.muted,
    textAlign: 'center',
  },

  // ── Hotspots ────────────────────────────────────────────────────────────────
  hotspotCard: {
    marginTop: space.xs,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: space.sm,
  },
  hotspotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.xs,
  },
  hotspotTitle: {
    fontFamily: font.bodySemi,
    fontSize: size.sm,
    color: colors.ink,
  },
  hotspotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  hotspotName: {
    fontFamily: font.bodyMid,
    fontSize: size.sm,
    color: colors.ink,
  },
  hotspotSub: {
    fontFamily: font.body,
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  hotspotBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginLeft: space.sm,
  },
  hotspotBadgeText: {
    fontFamily: font.bodySemi,
    fontSize: size.xs,
  },
});
