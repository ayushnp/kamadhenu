import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { colors, font, radius, size, space } from '../../theme';
import { prettyDate } from '../../lib/format';

export interface DataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface TrendLineChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  gradientColor?: string;
  unit?: string;
  title?: string;
  subtitle?: string;
  thresholdValue?: number;
  thresholdLabel?: string;
  thresholdColor?: string;
  minY?: number;
  maxY?: number;
  emptyMessage?: string;
}

export default function TrendLineChart({
  data,
  height = 180,
  color = colors.pasture,
  gradientColor = colors.pastureSoft,
  unit = '',
  title,
  subtitle,
  thresholdValue,
  thresholdLabel,
  thresholdColor = colors.sindoor,
  minY,
  maxY,
  emptyMessage = 'No telemetry data available for this time window.',
}: TrendLineChartProps) {
  const [containerWidth, setContainerWidth] = useState<number>(320);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 50) setContainerWidth(w);
  };

  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        {title && <Text style={styles.title}>{title}</Text>}
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      </View>
    );
  }

  // Sort chronological
  const sorted = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const values = sorted.map((d) => d.value);
  let computedMin = minY !== undefined ? minY : Math.min(...values);
  let computedMax = maxY !== undefined ? maxY : Math.max(...values);

  if (thresholdValue !== undefined) {
    computedMin = Math.min(computedMin, thresholdValue);
    computedMax = Math.max(computedMax, thresholdValue);
  }

  // Add 10% breathing room on top/bottom if flat
  if (computedMin === computedMax) {
    computedMin = Math.max(0, computedMin - 5);
    computedMax = computedMax + 5;
  } else {
    const span = computedMax - computedMin;
    computedMin = Math.max(0, computedMin - span * 0.1);
    computedMax = computedMax + span * 0.15;
  }

  const paddingLeft = 36;
  const paddingRight = 16;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartW = Math.max(100, containerWidth - paddingLeft - paddingRight);
  const chartH = Math.max(50, height - paddingTop - paddingBottom);

  const getX = (index: number) => {
    if (sorted.length === 1) return paddingLeft + chartW / 2;
    return paddingLeft + (index / (sorted.length - 1)) * chartW;
  };

  const getY = (val: number) => {
    const normalized = (val - computedMin) / (computedMax - computedMin || 1);
    return paddingTop + chartH - normalized * chartH;
  };

  // Build smooth bezier path
  const points = sorted.map((d, i) => ({ x: getX(i), y: getY(d.value) }));

  let linePath = '';
  let areaPath = '';

  if (points.length === 1) {
    linePath = `M ${points[0].x - 10} ${points[0].y} L ${points[0].x + 10} ${points[0].y}`;
  } else if (points.length > 1) {
    linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    const firstPt = points[0];
    const lastPt = points[points.length - 1];
    const bottomY = paddingTop + chartH;
    areaPath = `${linePath} L ${lastPt.x} ${bottomY} L ${firstPt.x} ${bottomY} Z`;
  }

  const selectedPoint =
    selectedIndex !== null && selectedIndex >= 0 && selectedIndex < sorted.length
      ? sorted[selectedIndex]
      : sorted[sorted.length - 1];
  const selectedX = selectedIndex !== null ? getX(selectedIndex) : getX(sorted.length - 1);
  const selectedY = selectedIndex !== null ? getY(selectedPoint.value) : getY(selectedPoint.value);

  // Threshold Y coordinate
  const thresholdY = thresholdValue !== undefined ? getY(thresholdValue) : null;

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* Header Info */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          {title && <Text style={styles.title}>{title}</Text>}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {selectedPoint && (
          <View style={styles.selectionPill}>
            <Text style={styles.selectionDate}>
              {prettyDate(selectedPoint.date)}:
            </Text>
            <Text style={[styles.selectionValue, { color }]}>
              {' '}{selectedPoint.value.toFixed(1)} {unit}
            </Text>
          </View>
        )}
      </View>

      <Svg width={containerWidth} height={height}>
        <Defs>
          <LinearGradient id={`chartGrad-${title}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </LinearGradient>
        </Defs>

        {/* Horizontal grid lines */}
        {[0, 0.5, 1].map((ratio, idx) => {
          const y = paddingTop + chartH * ratio;
          const val = computedMax - ratio * (computedMax - computedMin);
          return (
            <React.Fragment key={idx}>
              <Line
                x1={paddingLeft}
                y1={y}
                x2={containerWidth - paddingRight}
                y2={y}
                stroke={colors.line}
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <SvgText
                x={paddingLeft - 6}
                y={y + 3}
                fontSize="9"
                fill={colors.muted}
                textAnchor="end"
                fontFamily={font.body}
              >
                {val >= 100 ? val.toFixed(0) : val.toFixed(1)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Threshold line if defined */}
        {thresholdY !== null && (
          <>
            <Line
              x1={paddingLeft}
              y1={thresholdY}
              x2={containerWidth - paddingRight}
              y2={thresholdY}
              stroke={thresholdColor}
              strokeDasharray="5 3"
              strokeWidth="1.5"
            />
            {thresholdLabel && (
              <SvgText
                x={containerWidth - paddingRight}
                y={thresholdY - 4}
                fontSize="9"
                fill={thresholdColor}
                textAnchor="end"
                fontFamily={font.bodySemi}
              >
                {thresholdLabel} ({thresholdValue} {unit})
              </SvgText>
            )}
          </>
        )}

        {/* Area fill */}
        {areaPath ? (
          <Path d={areaPath} fill={`url(#chartGrad-${title})`} />
        ) : null}

        {/* Primary Line curve */}
        {linePath ? (
          <Path
            d={linePath}
            stroke={color}
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* Touch interactive scrubber crosshair */}
        <Line
          x1={selectedX}
          y1={paddingTop}
          x2={selectedX}
          y2={paddingTop + chartH}
          stroke={colors.bark}
          strokeDasharray="3 3"
          strokeWidth="1"
          opacity={0.6}
        />

        {/* Points on curve */}
        {points.map((pt, idx) => {
          const isSelected = idx === (selectedIndex ?? sorted.length - 1);
          return (
            <Circle
              key={idx}
              cx={pt.x}
              cy={pt.y}
              r={isSelected ? 5.5 : 3}
              fill={isSelected ? colors.milk : color}
              stroke={color}
              strokeWidth={isSelected ? 2.5 : 1}
            />
          );
        })}

        {/* First and Last Date labels along X axis */}
        {sorted.length > 0 && (
          <>
            <SvgText
              x={paddingLeft}
              y={height - 8}
              fontSize="9"
              fill={colors.muted}
              textAnchor="start"
              fontFamily={font.body}
            >
              {prettyDate(sorted[0].date)}
            </SvgText>
            <SvgText
              x={containerWidth - paddingRight}
              y={height - 8}
              fontSize="9"
              fill={colors.muted}
              textAnchor="end"
              fontFamily={font.body}
            >
              {prettyDate(sorted[sorted.length - 1].date)}
            </SvgText>
          </>
        )}

        {/* Transparent touch catcher strips along the points */}
        {points.map((pt, idx) => {
          const stepW = chartW / (points.length || 1);
          return (
            <Rect
              key={`touch-${idx}`}
              x={pt.x - stepW / 2}
              y={0}
              width={stepW}
              height={height}
              fill="transparent"
              onPress={() => setSelectedIndex(idx)}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.milk,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.sm,
    marginBottom: space.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingHorizontal: space.xs,
  },
  title: {
    fontFamily: font.bodySemi,
    fontSize: size.sm,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: font.body,
    fontSize: 10,
    color: colors.muted,
    marginTop: 1,
  },
  selectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  selectionDate: {
    fontFamily: font.body,
    fontSize: 10,
    color: colors.muted,
  },
  selectionValue: {
    fontFamily: font.bodySemi,
    fontSize: 11,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
  },
  emptyText: {
    fontFamily: font.body,
    fontSize: size.xs,
    color: colors.muted,
    textAlign: 'center',
  },
});
