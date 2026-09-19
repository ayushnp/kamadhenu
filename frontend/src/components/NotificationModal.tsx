import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { colors, font, radius, size, space } from '../theme';
import { useTranslation } from '../i18n';
import type { AlertRead } from '../api/types';
import { alerts as alertsApi } from '../api';

interface NotificationModalProps {
  visible: boolean;
  alerts: AlertRead[];
  onDismiss: () => void;
  onRefreshAlerts: () => void;
  onPressAlert?: (alert: AlertRead) => void;
}

export function NotificationModal({
  visible,
  alerts,
  onDismiss,
  onRefreshAlerts,
  onPressAlert,
}: NotificationModalProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [simulating, setSimulating] = useState(false);

  const unreadAlerts = alerts.filter((a) => !a.is_read);
  const displayedAlerts = filter === 'unread' ? unreadAlerts : alerts;

  const handleMarkRead = async (alertId: string) => {
    try {
      await alertsApi.markRead(alertId);
      onRefreshAlerts();
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await Promise.all(unreadAlerts.map((a) => alertsApi.markRead(a.id)));
      onRefreshAlerts();
    } catch {
      // ignore
    }
  };

  const handleSimulateAlert = async () => {
    setSimulating(true);
    try {
      await alertsApi.simulate();
      onRefreshAlerts();
    } catch {
      // ignore
    } finally {
      setSimulating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.bellIconWrap}>
                <Feather name="bell" size={20} color={colors.pasture} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Notifications & Alerts</Text>
                <Text style={styles.headerSub}>
                  {unreadAlerts.length} unread {unreadAlerts.length === 1 ? 'alert' : 'alerts'}
                </Text>
              </View>
            </View>

            <Pressable onPress={onDismiss} hitSlop={12} style={styles.closeBtn}>
              <Feather name="x" size={22} color={colors.ink} />
            </Pressable>
          </View>

          {/* Filter Pills + Mark All Read */}
          <View style={styles.filterRow}>
            <View style={styles.segmented}>
              <Pressable
                onPress={() => setFilter('all')}
                style={[styles.segmentBtn, filter === 'all' && styles.segmentBtnActive]}
              >
                <Text
                  style={[styles.segmentText, filter === 'all' && styles.segmentTextActive]}
                >
                  All ({alerts.length})
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setFilter('unread')}
                style={[styles.segmentBtn, filter === 'unread' && styles.segmentBtnActive]}
              >
                <Text
                  style={[styles.segmentText, filter === 'unread' && styles.segmentTextActive]}
                >
                  Unread ({unreadAlerts.length})
                </Text>
              </Pressable>
            </View>

            {unreadAlerts.length > 0 && (
              <Pressable onPress={handleMarkAllRead} style={styles.markAllBtn}>
                <Text style={styles.markAllText}>Mark all read</Text>
              </Pressable>
            )}
          </View>

          {/* List or Empty State */}
          <ScrollView contentContainerStyle={styles.listContent}>
            {displayedAlerts.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconCircle}>
                  <Feather name="check-circle" size={36} color={colors.pasture} />
                </View>
                <Text style={styles.emptyTitle}>All Clear!</Text>
                <Text style={styles.emptySub}>
                  {filter === 'unread'
                    ? 'No unread notifications right now.'
                    : 'No health alerts or disease outbreaks detected in your herd.'}
                </Text>

                <Pressable
                  onPress={handleSimulateAlert}
                  disabled={simulating}
                  style={styles.demoBtn}
                >
                  {simulating ? (
                    <ActivityIndicator color={colors.milk} size="small" />
                  ) : (
                    <>
                      <Feather name="zap" size={16} color={colors.milk} style={{ marginRight: 6 }} />
                      <Text style={styles.demoBtnText}>Generate Test Alert</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : (
              displayedAlerts.map((alert) => {
                const isCritical = alert.severity === 'critical';
                const isOutbreak = alert.alert_type === 'outbreak_warning';
                const isCase = alert.alert_type === 'case_assigned';

                const iconName = isOutbreak
                  ? 'alert-triangle'
                  : isCase
                  ? 'clipboard'
                  : 'activity';

                const accentColor = isCritical
                  ? colors.sindoor
                  : isOutbreak
                  ? colors.marigold
                  : colors.pasture;

                return (
                  <Pressable
                    key={alert.id}
                    onPress={() => {
                      if (!alert.is_read) handleMarkRead(alert.id);
                      onPressAlert?.(alert);
                    }}
                    style={[
                      styles.alertCard,
                      !alert.is_read && styles.alertCardUnread,
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={[styles.typeBadge, { backgroundColor: isCritical ? '#FEF2F2' : '#F0FDF4' }]}>
                        <Feather name={iconName} size={14} color={accentColor} style={{ marginRight: 4 }} />
                        <Text style={[styles.typeBadgeText, { color: accentColor }]}>
                          {alert.severity.toUpperCase()}
                        </Text>
                      </View>

                      <View style={styles.timeAndStatus}>
                        <Text style={styles.timeAgo}>
                          {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {!alert.is_read ? (
                          <View style={styles.unreadDot} />
                        ) : (
                          <Feather name="check" size={14} color={colors.muted} />
                        )}
                      </View>
                    </View>

                    <Text style={styles.cardTitle}>{alert.title}</Text>
                    <Text style={styles.cardMessage}>{alert.message}</Text>

                    <View style={styles.cardFooter}>
                      {!alert.is_read && (
                        <Pressable
                          onPress={() => handleMarkRead(alert.id)}
                          style={styles.markReadAction}
                        >
                          <Text style={styles.markReadText}>Mark read</Text>
                        </Pressable>
                      )}

                      {(alert.bovine_id || alert.complaint_id) && (
                        <Pressable
                          onPress={() => {
                            if (!alert.is_read) handleMarkRead(alert.id);
                            onPressAlert?.(alert);
                          }}
                          style={styles.inspectAction}
                        >
                          <Text style={styles.inspectText}>
                            {alert.bovine_id ? 'View Cow Health →' : 'View Complaint →'}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </Pressable>
                );
              })
            )}

            {/* Test Trigger Button for developers / demo */}
            {displayedAlerts.length > 0 && (
              <Pressable
                onPress={handleSimulateAlert}
                disabled={simulating}
                style={styles.secondaryDemoBtn}
              >
                {simulating ? (
                  <ActivityIndicator color={colors.pasture} size="small" />
                ) : (
                  <>
                    <Feather name="plus-circle" size={14} color={colors.pasture} style={{ marginRight: 6 }} />
                    <Text style={styles.secondaryDemoBtnText}>Trigger Another Demo Alert</Text>
                  </>
                )}
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '85%',
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  bellIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.pastureSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: size.md,
    fontFamily: font.displayMid,
    color: colors.ink,
  },
  headerSub: {
    fontSize: size.xs,
    fontFamily: font.body,
    color: colors.muted,
  },
  closeBtn: {
    padding: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.milk,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.milk,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 2,
  },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  segmentBtnActive: {
    backgroundColor: colors.pasture,
  },
  segmentText: {
    fontSize: 12,
    fontFamily: font.bodyMid,
    color: colors.muted,
  },
  segmentTextActive: {
    color: colors.milk,
  },
  markAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  markAllText: {
    fontSize: 12,
    fontFamily: font.bodyMid,
    color: colors.pasture,
  },
  listContent: {
    padding: space.lg,
    gap: space.md,
  },
  alertCard: {
    backgroundColor: colors.milk,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
  },
  alertCardUnread: {
    borderColor: colors.pasture,
    backgroundColor: '#FAFDFB',
    borderLeftWidth: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.xs,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  typeBadgeText: {
    fontSize: 10,
    fontFamily: font.bodySemi,
    letterSpacing: 0.5,
  },
  timeAndStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeAgo: {
    fontSize: 11,
    fontFamily: font.body,
    color: colors.muted,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.sindoor,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: font.bodySemi,
    color: colors.ink,
    marginBottom: 4,
  },
  cardMessage: {
    fontSize: 12,
    fontFamily: font.body,
    color: colors.bark,
    lineHeight: 18,
    marginBottom: space.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: space.xs,
  },
  markReadAction: {
    paddingVertical: 4,
  },
  markReadText: {
    fontSize: 11,
    fontFamily: font.bodyMid,
    color: colors.muted,
  },
  inspectAction: {
    paddingVertical: 4,
  },
  inspectText: {
    fontSize: 12,
    fontFamily: font.bodySemi,
    color: colors.pasture,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.pastureSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  emptyTitle: {
    fontSize: size.md,
    fontFamily: font.displayMid,
    color: colors.ink,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: size.sm,
    fontFamily: font.body,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: space.xl,
  },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.pasture,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radius.md,
  },
  demoBtnText: {
    color: colors.milk,
    fontSize: size.sm,
    fontFamily: font.bodySemi,
  },
  secondaryDemoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.pasture,
    borderStyle: 'dashed',
    paddingVertical: 10,
    borderRadius: radius.md,
    marginTop: space.sm,
  },
  secondaryDemoBtnText: {
    color: colors.pasture,
    fontSize: size.xs,
    fontFamily: font.bodyMid,
  },
});
