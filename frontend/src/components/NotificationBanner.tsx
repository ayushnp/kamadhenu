import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { useTranslation } from '../i18n';
import type { AlertRead } from '../api/types';

interface NotificationBannerProps {
  alerts: AlertRead[];
  onDismiss: (id: string) => void;
  onPressAlert?: (alert: AlertRead) => void;
}

export function NotificationBanner({ alerts, onDismiss, onPressAlert }: NotificationBannerProps) {
  const { t } = useTranslation();

  const unreadAlerts = alerts.filter((a) => !a.is_read);
  if (unreadAlerts.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {unreadAlerts.map((alert) => {
          const isCritical = alert.severity === 'critical';
          const isOutbreak = alert.alert_type === 'outbreak_warning';
          const isCaseAssigned = alert.alert_type === 'case_assigned';

          const iconName = isOutbreak
            ? 'warning'
            : isCaseAssigned
            ? 'clipboard'
            : isCritical
            ? 'alert-circle'
            : 'information-circle';

          const cardBg = isCritical ? '#FEF2F2' : isOutbreak ? '#FFFBEB' : '#F0FDF4';
          const borderColor = isCritical ? '#FCA5A5' : isOutbreak ? '#FCD34D' : '#86EFAC';
          const accentColor = isCritical ? colors.sindoor : isOutbreak ? '#D97706' : colors.pasture;

          return (
            <Pressable
              key={alert.id}
              style={[
                styles.card,
                { backgroundColor: cardBg, borderColor: borderColor },
              ]}
              onPress={() => onPressAlert?.(alert)}
            >
              <View style={styles.headerRow}>
                <View style={styles.iconTitleRow}>
                  <Ionicons name={iconName} size={20} color={accentColor} style={styles.icon} />
                  <Text style={[styles.badgeText, { color: accentColor }]}>
                    {isOutbreak
                      ? t('alerts.outbreakWarning')
                      : isCaseAssigned
                      ? t('alerts.caseAssigned')
                      : isCritical
                      ? t('alerts.highRiskMastitis')
                      : t('alerts.urgentNotice')}
                  </Text>
                </View>

                <Pressable
                  hitSlop={8}
                  onPress={() => onDismiss(alert.id)}
                  style={styles.dismissBtn}
                >
                  <Ionicons name="close" size={16} color={colors.muted} />
                </Pressable>
              </View>

              <Text style={styles.title} numberOfLines={1}>
                {alert.title}
              </Text>

              <Text style={styles.message} numberOfLines={2}>
                {alert.message}
              </Text>

              <View style={styles.footerRow}>
                <Text style={styles.timeText}>
                  {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Pressable
                  hitSlop={4}
                  onPress={() => onDismiss(alert.id)}
                  style={styles.actionLink}
                >
                  <Text style={[styles.actionLinkText, { color: accentColor }]}>
                    {t('alerts.dismiss')}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: space.sm,
  },
  scrollContent: {
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  card: {
    width: 310,
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: space.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.xs,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 6,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dismissBtn: {
    padding: 2,
    borderRadius: radius.sm,
  },
  title: {
    fontSize: 14,
    fontFamily: font.bodySemi,
    color: colors.bark,
    marginBottom: 4,
  },
  message: {
    fontSize: 12,
    fontFamily: font.body,
    color: colors.ink,
    lineHeight: 17,
    marginBottom: space.xs,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingTop: 6,
  },
  timeText: {
    fontSize: 10,
    fontFamily: font.body,
    color: colors.muted,
  },
  actionLink: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  actionLinkText: {
    fontSize: 11,
    fontFamily: font.bodyMid,
  },
});
