/**
 * AuthorityHome — District Authority oversight dashboard
 *
 * Shows: district-wide stats, outbreak cluster list, visual cluster map (heat grid),
 * staff workload breakdown, and recent all-complaints list.
 */
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Banner, Card, Caption, Title } from "../../src/components/ui";
import { useAuth } from "../../src/lib/auth";
import { complaints as complaintsApi, alerts as alertsApi, users as usersApi, ApiError } from "../../src/api";
import type { Complaint, OutbreakCluster, UserPublic } from "../../src/api/types";
import { prettyDate } from "../../src/lib/format";
import { colors, font, radius, size, space } from "../../src/theme";

/* ── Stat tile ────────────────────────────────────────────────────────────── */
function StatTile({ value, label, icon, bg, fg }: { value: string; label: string; icon: any; bg: string; fg: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: radius.md, padding: space.md, alignItems: "center" }}>
      <Feather name={icon} size={20} color={fg} style={{ marginBottom: 4 }} />
      <Text style={{ fontFamily: font.display, fontSize: size.xl, color: fg }}>{value}</Text>
      <Text style={{ fontFamily: font.body, fontSize: size.xs, color: fg, textAlign: "center", marginTop: 2 }}>{label}</Text>
    </View>
  );
}

/* ── Outbreak row (list) ──────────────────────────────────────────────────── */
function OutbreakRow({ cluster, maxCount }: { cluster: OutbreakCluster; maxCount: number }) {
  const sev = cluster.severity;
  const fg = sev === "critical" ? colors.sindoor : sev === "warning" ? "#8A5D13" : colors.pasture;
  const barBg = sev === "critical" ? colors.sindoor : sev === "warning" ? colors.marigold : colors.pasture;
  const pct = Math.max(0.08, cluster.case_count / Math.max(maxCount, 1));
  return (
    <View style={{ marginBottom: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
        <Feather name="map-pin" size={13} color={fg} style={{ marginRight: 6 }} />
        <Text style={{ fontFamily: font.bodySemi, fontSize: size.base, color: colors.ink, flex: 1 }}>{cluster.village_or_place}</Text>
        <View style={{ backgroundColor: fg + "22", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, marginRight: space.sm }}>
          <Text style={{ fontFamily: font.bodySemi, fontSize: 11, color: fg }}>{sev.toUpperCase()}</Text>
        </View>
        <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: fg }}>{cluster.case_count} cases</Text>
      </View>
      {/* Progress bar */}
      <View style={{ height: 8, backgroundColor: colors.line, borderRadius: 99, overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${Math.round(pct * 100)}%`, backgroundColor: barBg, borderRadius: 99 }} />
      </View>
      <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted, marginTop: 2 }}>Last incident: {prettyDate(cluster.latest_incident_at)}</Text>
    </View>
  );
}

/* ── Heat map (village grid) ─────────────────────────────────────────────── */
function ClusterHeatMap({ clusters }: { clusters: OutbreakCluster[] }) {
  if (clusters.length === 0) return null;
  const maxCount = Math.max(...clusters.map((c) => c.case_count), 1);
  const COLS = 3;
  const rows: OutbreakCluster[][] = [];
  for (let i = 0; i < clusters.length; i += COLS) rows.push(clusters.slice(i, i + COLS));

  return (
    <Card style={{ marginBottom: space.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: space.md }}>
        <Feather name="grid" size={16} color={colors.pasture} style={{ marginRight: space.sm }} />
        <Text style={{ fontFamily: font.bodySemi, fontSize: size.base, color: colors.ink }}>Outbreak Cluster Map</Text>
      </View>
      <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginBottom: space.md }}>
        Cell size reflects relative case burden per village.
      </Text>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", gap: space.sm, marginBottom: space.sm }}>
          {row.map((cluster, ci) => {
            const sev = cluster.severity;
            const intensity = cluster.case_count / maxCount;
            const bg = sev === "critical"
              ? `rgba(184, 64, 47, ${0.15 + intensity * 0.75})`
              : sev === "warning"
              ? `rgba(240, 168, 48, ${0.15 + intensity * 0.75})`
              : `rgba(46, 107, 79, ${0.15 + intensity * 0.75})`;
            const fg = sev === "critical" ? colors.sindoor : sev === "warning" ? "#8A5D13" : colors.pasture;
            return (
              <View key={ci} style={{
                flex: 1, backgroundColor: bg, borderRadius: radius.sm,
                padding: space.sm, minHeight: 72, justifyContent: "flex-end",
              }}>
                <Text style={{ fontFamily: font.bodySemi, fontSize: size.xs, color: fg, flexWrap: "wrap" }} numberOfLines={2}>
                  {cluster.village_or_place}
                </Text>
                <Text style={{ fontFamily: font.display, fontSize: size.lg, color: fg }}>{cluster.case_count}</Text>
              </View>
            );
          })}
          {/* Fill empty cells if row has fewer than COLS */}
          {row.length < COLS && Array.from({ length: COLS - row.length }).map((_, ei) => (
            <View key={`e${ei}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
      {/* Legend */}
      <View style={{ flexDirection: "row", gap: space.md, marginTop: space.sm, justifyContent: "center" }}>
        {[{ label: "Critical", c: colors.sindoor }, { label: "Warning", c: colors.marigold }, { label: "Normal", c: colors.pasture }].map((l) => (
          <View key={l.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: l.c }} />
            <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted }}>{l.label}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

/* ── Staff workload row ───────────────────────────────────────────────────── */
function StaffRow({ staff, count, totalCount }: { staff: UserPublic; count: number; totalCount: number }) {
  const pct = Math.max(0.03, count / Math.max(totalCount, 1));
  const overloaded = count >= 5;
  return (
    <View style={{ marginBottom: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
        <View style={{
          width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.pastureSoft,
          alignItems: "center", justifyContent: "center", marginRight: space.sm,
        }}>
          <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: colors.pasture }}>
            {staff.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: colors.ink }}>{staff.name}</Text>
          <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted }}>{staff.role.charAt(0).toUpperCase() + staff.role.slice(1)}{staff.jurisdiction ? ` · ${staff.jurisdiction}` : ""}</Text>
        </View>
        <View style={{ backgroundColor: overloaded ? colors.sindoorSoft : colors.marigoldSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 }}>
          <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: overloaded ? colors.sindoor : "#8A5D13" }}>{count} cases</Text>
        </View>
      </View>
      <View style={{ height: 6, backgroundColor: colors.line, borderRadius: 99, overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${Math.round(pct * 100)}%`, backgroundColor: overloaded ? colors.sindoor : colors.pasture, borderRadius: 99 }} />
      </View>
    </View>
  );
}

/* ── Complaint summary row ────────────────────────────────────────────────── */
function ComplaintSummaryRow({ c }: { c: Complaint }) {
  const pBg = c.priority === "critical" || c.priority === "high" ? colors.sindoorSoft : colors.marigoldSoft;
  const pFg = c.priority === "critical" || c.priority === "high" ? colors.sindoor : "#8A5D13";
  return (
    <View style={{ paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: "row", alignItems: "center" }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.bodyMid, fontSize: size.sm, color: colors.ink }} numberOfLines={1}>{c.description}</Text>
        <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted }}>{c.complaint_ref ?? `#${c.complaint_number}`} · {prettyDate(c.created_at)}</Text>
      </View>
      <View style={{ backgroundColor: pBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, marginLeft: space.sm }}>
        <Text style={{ fontFamily: font.bodySemi, fontSize: 11, color: pFg }}>{c.priority.toUpperCase()}</Text>
      </View>
    </View>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export default function AuthorityHome({
  onOpenNotifications,
  unreadCount = 0,
  onBack,
}: {
  onOpenNotifications?: () => void;
  unreadCount?: number;
  onBack?: () => void;
} = {}) {
  const { user } = useAuth();
  const router = useRouter();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [outbreaks, setOutbreaks] = useState<OutbreakCluster[]>([]);
  const [staff, setStaff] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allComplaints, outbreakData, doctors, inspectors] = await Promise.all([
        complaintsApi.list(),
        alertsApi.outbreaks(),
        usersApi.listByRole("doctor"),
        usersApi.listByRole("inspector"),
      ]);
      setComplaints(allComplaints);
      setOutbreaks(outbreakData);
      setStaff([...doctors, ...inspectors]);
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load district data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = complaints.filter((c) => c.status === "open" || c.status === "assigned").length;
  const inProgress = complaints.filter((c) => c.status === "in_progress").length;
  const resolved = complaints.filter((c) => c.status === "resolved" || c.status === "closed").length;

  // Staff workload: count active cases per staff member
  const workload: Record<string, number> = {};
  complaints.forEach((c) => {
    if (c.assigned_to && c.status !== "resolved" && c.status !== "closed") {
      workload[c.assigned_to] = (workload[c.assigned_to] ?? 0) + 1;
    }
  });
  const staffWithCases = staff
    .map((s) => ({ staff: s, count: workload[s.id] ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const maxWorkload = Math.max(...staffWithCases.map((s) => s.count), 1);

  const maxOutbreakCount = Math.max(...outbreaks.map((o) => o.case_count), 1);
  const recentComplaints = [...complaints].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  return (
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

      <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: space.xs }}>
        <View style={{ flex: 1, paddingRight: space.md }}>
          <Caption>District Authority Dashboard</Caption>
          <Title>{user?.name?.split(" ")[0] ?? "Authority"}'s Overview</Title>
          {user?.jurisdiction ? (
            <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginTop: 2 }}>
              Jurisdiction: {user.jurisdiction}
            </Text>
          ) : null}
        </View>
        {onOpenNotifications && (
          <Pressable
            onPress={onOpenNotifications}
            style={({ pressed }) => ({
              width: 44, height: 44, borderRadius: radius.pill,
              backgroundColor: colors.milk, borderWidth: 1, borderColor: colors.line,
              alignItems: "center", justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
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
        )}
      </View>
      <View style={{ height: space.sm }} />
      <Banner message={error} />

      {loading ? (
        <ActivityIndicator color={colors.pasture} style={{ marginTop: space.xl }} />
      ) : (
        <>
          {/* District stat tiles */}
          <View style={{ flexDirection: "row", gap: space.sm, marginBottom: space.lg }}>
            <StatTile value={String(open)} label="Open Cases" icon="alert-circle" bg={colors.marigoldSoft} fg="#8A5D13" />
            <StatTile value={String(inProgress)} label="In Progress" icon="activity" bg={colors.pastureSoft} fg={colors.pasture} />
            <StatTile value={String(resolved)} label="Resolved" icon="check-circle" bg={colors.sky} fg={colors.pasture} />
          </View>

          {/* Second row */}
          <View style={{ flexDirection: "row", gap: space.sm, marginBottom: space.xl }}>
            <StatTile value={String(complaints.length)} label="Total Cases" icon="clipboard" bg={colors.surface} fg={colors.bark} />
            <StatTile value={String(outbreaks.length)} label="Outbreak Zones" icon="alert-triangle" bg={colors.sindoorSoft} fg={colors.sindoor} />
            <StatTile value={String(staff.length)} label="Active Staff" icon="users" bg={colors.dusk} fg="#8A5D13" />
          </View>

          {/* Outbreak section header */}
          {outbreaks.length > 0 && (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: space.sm }}>
                <Feather name="alert-triangle" size={16} color={colors.sindoor} style={{ marginRight: space.sm }} />
                <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink, flex: 1 }}>Outbreak Clusters</Text>
              </View>

              {/* List view */}
              <Card style={{ marginBottom: space.md }}>
                {outbreaks.map((o, i) => <OutbreakRow key={i} cluster={o} maxCount={maxOutbreakCount} />)}
              </Card>

              {/* Heat map */}
              <ClusterHeatMap clusters={outbreaks} />
            </>
          )}

          {outbreaks.length === 0 && (
            <Card style={{ marginBottom: space.lg, flexDirection: "row", alignItems: "center" }}>
              <Feather name="check-circle" size={20} color={colors.pasture} style={{ marginRight: space.md }} />
              <Text style={{ fontFamily: font.bodyMid, fontSize: size.base, color: colors.pasture }}>No active outbreak clusters in your district.</Text>
            </Card>
          )}

          {/* Staff workload */}
          {staffWithCases.length > 0 && (
            <Card style={{ marginBottom: space.lg }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: space.md }}>
                <Feather name="users" size={16} color={colors.pasture} style={{ marginRight: space.sm }} />
                <Text style={{ fontFamily: font.bodySemi, fontSize: size.base, color: colors.ink, flex: 1 }}>Staff Workload</Text>
                <Pressable onPress={() => router.push("/staff/workload" as any)}>
                  <Text style={{ fontFamily: font.bodyMid, fontSize: size.xs, color: colors.pasture }}>Manage →</Text>
                </Pressable>
              </View>
              {staffWithCases.map(({ staff: s, count }) => (
                <Pressable
                  key={s.id}
                  onPress={() => router.push(`/staff/workload?staffId=${s.id}` as any)}
                >
                  <StaffRow staff={s} count={count} totalCount={maxWorkload} />
                </Pressable>
              ))}
            </Card>
          )}

          {/* Recent complaints */}
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: space.sm }}>
              <Feather name="clock" size={16} color={colors.pasture} style={{ marginRight: space.sm }} />
              <Text style={{ fontFamily: font.bodySemi, fontSize: size.base, color: colors.ink, flex: 1 }}>Recent Complaints</Text>
              <Pressable onPress={() => router.push("/(tabs)/complaints" as any)}>
                <Text style={{ fontFamily: font.bodyMid, fontSize: size.xs, color: colors.pasture }}>See all →</Text>
              </Pressable>
            </View>
            {recentComplaints.length === 0 ? (
              <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted }}>No complaints yet.</Text>
            ) : (
              recentComplaints.map((c) => <ComplaintSummaryRow key={c.id} c={c} />)
            )}
          </Card>
        </>
      )}
    </ScrollView>
  );
}
