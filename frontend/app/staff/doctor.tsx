/**
 * DoctorHome — Veterinarian dashboard
 */
import React, { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Banner, Button, Card, Caption, Title } from "../../src/components/ui";
import { NotificationModal } from "../../src/components/NotificationModal";
import { useAuth } from "../../src/lib/auth";
import { complaints as complaintsApi, alerts as alertsApi, ApiError } from "../../src/api";
import type { Complaint, ComplaintStatus, AlertRead } from "../../src/api/types";
import { prettyDate } from "../../src/lib/format";
import { navigateToAlertTarget } from "../../src/lib/alertNavigation";
import { colors, font, radius, size, space } from "../../src/theme";

const PRIORITY_TONE = { critical: "risk", high: "risk", medium: "warn", low: "neutral" } as const;
const STATUS_LABEL: Record<ComplaintStatus, string> = {
  open: "Open", assigned: "Assigned", in_progress: "In Progress", resolved: "Resolved", closed: "Closed",
};

/* ── Badge ────────────────────────────────────────────────────────────────── */
function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
      <Text style={{ fontFamily: font.bodySemi, fontSize: 11, color: fg }}>{label}</Text>
    </View>
  );
}

/* ── Notes modal ──────────────────────────────────────────────────────────── */
function NotesModal({ visible, title, onConfirm, onCancel, loading }: {
  visible: boolean; title: string;
  onConfirm: (notes: string) => void; onCancel: () => void; loading: boolean;
}) {
  const [notes, setNotes] = useState("");
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onCancel}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
        onPress={onCancel}
      >
        <Pressable onPress={() => {}} style={{
          backgroundColor: colors.milk, borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg, padding: space.xl, paddingBottom: 40,
        }}>
          <Text style={{ fontFamily: font.display, fontSize: size.md, color: colors.ink, marginBottom: space.md }}>{title}</Text>
          <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.bark, marginBottom: space.sm }}>
            Clinical notes / findings (optional)
          </Text>
          <TextInput
            multiline numberOfLines={4} value={notes} onChangeText={setNotes}
            placeholder="Describe observations, diagnosis, or treatment plan…"
            placeholderTextColor={colors.muted}
            style={{
              borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
              padding: space.md, fontFamily: font.body, fontSize: size.base,
              color: colors.ink, minHeight: 100, textAlignVertical: "top", marginBottom: space.lg,
            }}
          />
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={loading} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={loading ? "Saving…" : "Confirm"} onPress={() => onConfirm(notes)} loading={loading} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── Case card ────────────────────────────────────────────────────────────── */
function CaseCard({ complaint: c, onAction }: { complaint: Complaint; onAction: (c: Complaint, s: ComplaintStatus) => void }) {
  const router = useRouter();
  const toneMap = { critical: [colors.sindoorSoft, colors.sindoor], high: [colors.sindoorSoft, colors.sindoor], medium: [colors.marigoldSoft, "#8A5D13"], low: [colors.surface, colors.bark] } as const;
  const [pbg, pfg] = toneMap[c.priority];
  return (
    <Card style={{ marginBottom: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: space.sm, gap: space.sm }}>
        <Pill label={c.priority.toUpperCase()} bg={pbg} fg={pfg} />
        <Pill label={STATUS_LABEL[c.status]} bg={colors.pastureSoft} fg={colors.pasture} />
        <Text style={{ marginLeft: "auto", fontFamily: font.body, fontSize: size.xs, color: colors.muted }}>
          {c.complaint_ref ?? `#${c.complaint_number}`}
        </Text>
      </View>
      <Text style={{ fontFamily: font.bodySemi, fontSize: size.base, color: colors.ink, marginBottom: 4 }} numberOfLines={2}>
        {c.description}
      </Text>
      {c.symptoms ? (
        <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.bark, marginBottom: space.sm }} numberOfLines={1}>
          Symptoms: {c.symptoms}
        </Text>
      ) : null}
      <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted, marginBottom: space.md }}>
        Raised {prettyDate(c.created_at)}
      </Text>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Pressable
          onPress={() => router.push(`/cow/${c.bovine_id}` as any)}
          style={{ flex: 1, padding: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: "center" }}
        >
          <Text style={{ fontFamily: font.bodyMid, fontSize: size.sm, color: colors.pasture }}>View Animal</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/cow/trends/${c.bovine_id}` as any)}
          style={{ flex: 1, padding: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: "center" }}
        >
          <Text style={{ fontFamily: font.bodyMid, fontSize: size.sm, color: colors.pasture }}>Trends 📈</Text>
        </Pressable>
        {c.status === "assigned" && (
          <Pressable
            onPress={() => onAction(c, "in_progress")}
            style={{ flex: 1, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.marigoldSoft, alignItems: "center" }}
          >
            <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: "#8A5D13" }}>Start Visit</Text>
          </Pressable>
        )}
        {c.status === "in_progress" && (
          <Pressable
            onPress={() => onAction(c, "resolved")}
            style={{ flex: 1, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.pastureSoft, alignItems: "center" }}
          >
            <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: colors.pasture }}>Mark Resolved</Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

/* ── Stat tile ────────────────────────────────────────────────────────────── */
function StatTile({ value, label, bg, fg }: { value: string; label: string; bg: string; fg: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: radius.md, padding: space.md, alignItems: "center" }}>
      <Text style={{ fontFamily: font.display, fontSize: size.lg, color: fg }}>{value}</Text>
      <Text style={{ fontFamily: font.body, fontSize: size.xs, color: fg, textAlign: "center", marginTop: 2 }}>{label}</Text>
    </View>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export default function DoctorHome({ onLookup, onBack }: { onLookup?: () => void; onBack?: () => void } = {}) {
  const { user } = useAuth();
  const router = useRouter();
  const handleLookup = onLookup ?? (() => router.push('/(tabs)/lookup'));
  const [cases, setCases] = useState<Complaint[]>([]);
  const [allAlerts, setAllAlerts] = useState<AlertRead[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<AlertRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [pendingComplaint, setPendingComplaint] = useState<Complaint | null>(null);
  const [pendingStatus, setPendingStatus] = useState<ComplaintStatus | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allCases, alertsData] = await Promise.all([
        complaintsApi.list(),
        alertsApi.my(50),
      ]);
      setCases(allCases.filter((c) => c.status !== "resolved" && c.status !== "closed"));
      setAllAlerts(alertsData.alerts);
      setRecentAlerts(alertsData.alerts.filter((a) => !a.is_read).slice(0, 3));
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load cases.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openModal = (complaint: Complaint, newStatus: ComplaintStatus) => {
    setPendingComplaint(complaint);
    setPendingStatus(newStatus);
    setModalVisible(true);
  };

  const confirmAction = async (notes: string) => {
    if (!pendingComplaint || !pendingStatus) return;
    setActionLoading(true);
    try {
      await complaintsApi.updateStatus(pendingComplaint.id, {
        status: pendingStatus,
        resolved_notes: notes.trim() || null,
      });
      setModalVisible(false);
      setPendingComplaint(null);
      setPendingStatus(null);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Status update failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const assigned = cases.filter((c) => c.status === "assigned");
  const inProgress = cases.filter((c) => c.status === "in_progress");

  const unreadCount = allAlerts.filter((a) => !a.is_read).length;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.surface }}
        contentContainerStyle={{ padding: space.lg, paddingTop: 56, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.pasture} />}
      >
        {/* Back navigation button */}
        <Pressable
          onPress={() => {
            if (onBack) onBack();
            else if (router.canGoBack()) router.back();
            else router.replace('/(auth)/landing');
          }}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            marginBottom: space.md,
            opacity: pressed ? 0.7 : 1,
            alignSelf: "flex-start",
          })}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="arrow-left" size={19} color={colors.bark} />
          <Text style={{ fontFamily: font.bodyMid, fontSize: size.base, color: colors.bark, marginLeft: 6 }}>
            Back
          </Text>
        </Pressable>

        {/* Header row with greeting + notification bell */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: space.xs }}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <Caption>Veterinary Dashboard</Caption>
            <Title>Good day, Dr. {user?.name?.split(" ")[0] ?? "Doctor"}</Title>
          </View>
          {/* Bell button */}
          <Pressable
            onPress={() => setNotifModalVisible(true)}
            style={({ pressed }) => ({
              width: 44, height: 44, borderRadius: radius.pill,
              backgroundColor: colors.milk, borderWidth: 1, borderColor: colors.line,
              alignItems: "center", justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
              shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
            })}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Feather name="bell" size={22} color={colors.ink} />
            {unreadCount > 0 ? (
              <View style={{
                position: "absolute", top: -2, right: -2,
                minWidth: 18, height: 18, borderRadius: 9,
                backgroundColor: colors.sindoor,
                alignItems: "center", justifyContent: "center",
                paddingHorizontal: 4, borderWidth: 1.5, borderColor: colors.milk,
              }}>
                <Text style={{ color: colors.milk, fontSize: 10, fontFamily: font.bodySemi }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            ) : (
              <View style={{ position: "absolute", top: 9, right: 10, width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.pasture }} />
            )}
          </Pressable>
        </View>

        <View style={{ height: space.sm }} />
        <Banner message={error} />

        {/* Stats */}
        <View style={{ flexDirection: "row", gap: space.sm, marginBottom: space.lg }}>
          <StatTile value={String(assigned.length)} label="Assigned" bg={colors.marigoldSoft} fg="#8A5D13" />
          <StatTile value={String(inProgress.length)} label="In Progress" bg={colors.pastureSoft} fg={colors.pasture} />
          <StatTile value={String(cases.length)} label="Active Total" bg={colors.surface} fg={colors.bark} />
        </View>

        {/* New alerts */}
        {recentAlerts.length > 0 && (
          <Card style={{ marginBottom: space.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: space.sm }}>
              <Feather name="bell" size={16} color={colors.sindoor} style={{ marginRight: space.sm }} />
              <Text style={{ fontFamily: font.bodySemi, fontSize: size.base, color: colors.ink, flex: 1 }}>New Alerts</Text>
              <Pressable onPress={() => setNotifModalVisible(true)}>
                <Text style={{ fontFamily: font.bodyMid, fontSize: size.xs, color: colors.pasture }}>See all</Text>
              </Pressable>
            </View>
            {recentAlerts.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => navigateToAlertTarget(a, router)}
                style={({ pressed }) => ({
                  flexDirection: "row", alignItems: "center", padding: space.sm,
                  backgroundColor: a.severity === "critical" ? colors.sindoorSoft : colors.marigoldSoft,
                  borderRadius: radius.sm, marginBottom: space.sm,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Feather name="bell" size={14} color={a.severity === "critical" ? colors.sindoor : "#8A5D13"} style={{ marginRight: space.sm }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: colors.ink }}>{a.title}</Text>
                  <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.bark }} numberOfLines={1}>{a.message}</Text>
                </View>
                <Feather name="chevron-right" size={14} color={colors.muted} />
              </Pressable>
            ))}
          </Card>
        )}

        {/* Case list */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: space.sm }}>
          <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink, flex: 1 }}>Your Cases</Text>
          <Pressable onPress={() => router.push("/(tabs)/complaints" as any)}>
            <Text style={{ fontFamily: font.bodyMid, fontSize: size.sm, color: colors.pasture }}>Full inbox →</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.pasture} style={{ marginVertical: space.xl }} />
        ) : cases.length === 0 ? (
          <Card>
            <View style={{ alignItems: "center", padding: space.lg }}>
              <Feather name="check-circle" size={36} color={colors.pasture} />
              <Text style={{ fontFamily: font.bodySemi, fontSize: size.base, color: colors.ink, marginTop: space.sm }}>All clear!</Text>
              <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, textAlign: "center", marginTop: 4 }}>
                No open cases assigned to you right now.
              </Text>
            </View>
          </Card>
        ) : (
          cases.map((c) => <CaseCard key={c.id} complaint={c} onAction={openModal} />)
        )}

        {/* Find animal */}
        <View style={{ height: space.lg }} />
        <Pressable onPress={handleLookup}>
          <Card style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{
              width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.pastureSoft,
              alignItems: "center", justifyContent: "center", marginRight: space.md,
            }}>
              <Feather name="search" size={20} color={colors.pasture} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.bodySemi, fontSize: size.base, color: colors.ink }}>Find an Animal</Text>
              <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginTop: 2 }}>Scan ear tag or enter Pashu Aadhaar</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.muted} />
          </Card>
        </Pressable>
      </ScrollView>

      <NotesModal
        visible={modalVisible}
        title={pendingStatus === "in_progress" ? "Start Field Visit" : "Mark Case Resolved"}
        onConfirm={confirmAction}
        onCancel={() => setModalVisible(false)}
        loading={actionLoading}
      />

      {/* Full notification centre */}
      <NotificationModal
        visible={notifModalVisible}
        alerts={allAlerts}
        onDismiss={() => setNotifModalVisible(false)}
        onRefreshAlerts={load}
        onPressAlert={(alert) => {
          setNotifModalVisible(false);
          navigateToAlertTarget(alert, router);
        }}
      />
    </>
  );
}
