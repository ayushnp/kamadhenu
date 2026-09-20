/**
 * InspectorHome — Inspector dashboard
 */
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Banner, Button, Card, Caption, Title } from "../../src/components/ui";
import { useAuth } from "../../src/lib/auth";
import {
  complaints as complaintsApi,
  alerts as alertsApi,
  inspections as inspectionsApi,
  ApiError,
} from "../../src/api";
import type {
  Complaint,
  ComplaintStatus,
  FarmInspection,
  InspectionStatus,
  OutbreakCluster,
  UserPublic,
} from "../../src/api/types";
import { prettyDate } from "../../src/lib/format";
import { colors, font, radius, size, space } from "../../src/theme";

const STATUS_LABEL: Record<ComplaintStatus, string> = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

/* ── Rating Picker Component ──────────────────────────────────────────────── */
function RatingPills({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <View style={{ marginBottom: space.sm }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.bark }}>{label}</Text>
        <Text style={{ fontFamily: font.bodySemi, fontSize: size.xs, color: colors.pasture }}>{value} / 5</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {[1, 2, 3, 4, 5].map((num) => {
          const active = value === num;
          return (
            <Pressable
              key={num}
              onPress={() => onChange(num)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: radius.md,
                backgroundColor: active ? colors.pasture : colors.milk,
                borderWidth: 1,
                borderColor: active ? colors.pasture : colors.line,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: font.bodySemi,
                  fontSize: size.sm,
                  color: active ? colors.milk : colors.ink,
                }}
              >
                {num}★
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ── Conduct Barn Inspection Modal ────────────────────────────────────────── */
function BarnInspectionModal({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [farmers, setFarmers] = useState<UserPublic[]>([]);
  const [loadingFarmers, setLoadingFarmers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFarmer, setSelectedFarmer] = useState<UserPublic | null>(null);

  const [status, setStatus] = useState<InspectionStatus>("passed");
  const [overallScore, setOverallScore] = useState("85");
  const [biosecurity, setBiosecurity] = useState(4);
  const [ventilation, setVentilation] = useState(4);
  const [bedding, setBedding] = useState(4);
  const [waterFeed, setWaterFeed] = useState(4);
  const [milking, setMilking] = useState(4);
  const [welfare, setWelfare] = useState(4);

  const [ammoniaPpm, setAmmoniaPpm] = useState("");
  const [beddingMoisture, setBeddingMoisture] = useState("");
  const [summary, setSummary] = useState("");
  const [deficiencies, setDeficiencies] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [followUpRequired, setFollowUpRequired] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const loadFarmers = useCallback(async () => {
    setLoadingFarmers(true);
    try {
      const list = await inspectionsApi.farmers();
      setFarmers(list);
      if (list.length > 0 && !selectedFarmer) {
        setSelectedFarmer(list[0]);
      }
    } catch {
      // ignore
    } finally {
      setLoadingFarmers(false);
    }
  }, [selectedFarmer]);

  useFocusEffect(
    useCallback(() => {
      if (visible) loadFarmers();
    }, [visible, loadFarmers])
  );

  const handleStatusChange = (newStatus: InspectionStatus) => {
    setStatus(newStatus);
    if (newStatus === "passed") {
      setOverallScore("88");
      setBiosecurity(4);
      setVentilation(4);
      setBedding(4);
    } else if (newStatus === "conditional_pass") {
      setOverallScore("68");
      setBiosecurity(3);
      setVentilation(3);
      setBedding(2);
    } else {
      setOverallScore("42");
      setBiosecurity(2);
      setVentilation(2);
      setBedding(1);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFarmer) {
      return setFormError("Please select a farmer to inspect.");
    }
    if (!summary.trim()) {
      return setFormError("Please enter an inspection summary.");
    }

    setSubmitting(true);
    setFormError("");

    try {
      const followUpDate = followUpRequired
        ? new Date(Date.now() + 14 * 86400000).toISOString()
        : null;

      await inspectionsApi.create({
        farmer_id: selectedFarmer.id,
        status,
        overall_score: parseInt(overallScore, 10) || 80,
        biosecurity_score: biosecurity,
        ventilation_score: ventilation,
        bedding_hygiene_score: bedding,
        water_feed_score: waterFeed,
        milking_hygiene_score: milking,
        animal_welfare_score: welfare,
        ammonia_ppm_observed: ammoniaPpm ? parseFloat(ammoniaPpm) : null,
        bedding_moisture_observed: beddingMoisture ? parseFloat(beddingMoisture) : null,
        summary: summary.trim(),
        deficiencies: deficiencies.trim() || null,
        recommendations: recommendations.trim() || null,
        follow_up_required: followUpRequired,
        follow_up_date: followUpDate,
      });

      onSuccess();
      onClose();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Failed to submit barn inspection.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredFarmers = farmers.filter((f) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (f.name && f.name.toLowerCase().includes(q)) ||
      (f.place && f.place.toLowerCase().includes(q)) ||
      (f.phone && f.phone.includes(q))
    );
  });

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            maxHeight: "92%",
            paddingTop: space.lg,
          }}
        >
          {/* Modal Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: space.lg,
              marginBottom: space.sm,
            }}
          >
            <View>
              <Text style={{ fontFamily: font.display, fontSize: size.md, color: colors.ink }}>
                Conduct Barn Inspection
              </Text>
              <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted }}>
                Report will be automatically shared with the farmer
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.line,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="x" size={18} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {formError ? <Banner message={formError} /> : null}

            {/* Step 1: Select Farmer */}
            <Text style={styles.sectionHeading}>1. Select Farm / Farmer</Text>
            <TextInput
              placeholder="Search farmer by name, place, or phone…"
              placeholderTextColor={colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.input}
            />

            {loadingFarmers ? (
              <ActivityIndicator color={colors.pasture} style={{ marginVertical: 8 }} />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: space.md }}
              >
                {filteredFarmers.map((f) => {
                  const isSel = selectedFarmer?.id === f.id;
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => setSelectedFarmer(f)}
                      style={{
                        padding: space.sm,
                        paddingHorizontal: space.md,
                        borderRadius: radius.md,
                        backgroundColor: isSel ? colors.pastureSoft : colors.milk,
                        borderWidth: 1.5,
                        borderColor: isSel ? colors.pasture : colors.line,
                        marginRight: space.xs,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: font.bodySemi,
                          fontSize: size.xs,
                          color: isSel ? colors.pasture : colors.ink,
                        }}
                      >
                        {f.name}
                      </Text>
                      <Text style={{ fontFamily: font.body, fontSize: 10, color: colors.muted }}>
                        {f.place || "Registered Farm"}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* Step 2: Inspection Outcome & Grade */}
            <Text style={styles.sectionHeading}>2. Overall Compliance Outcome</Text>
            <View style={{ flexDirection: "row", gap: space.xs, marginBottom: space.md }}>
              {[
                { key: "passed", label: "Grade A · Pass", bg: colors.pastureSoft, fg: colors.pasture },
                { key: "conditional_pass", label: "Grade B · Warning", bg: colors.marigoldSoft, fg: "#8A5D13" },
                { key: "failed", label: "Grade C · Hazard", bg: colors.sindoorSoft, fg: colors.sindoor },
              ].map((s) => {
                const active = status === s.key;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => handleStatusChange(s.key as InspectionStatus)}
                    style={{
                      flex: 1,
                      paddingVertical: space.sm,
                      borderRadius: radius.md,
                      backgroundColor: active ? s.bg : colors.milk,
                      borderWidth: active ? 2 : 1,
                      borderColor: active ? s.fg : colors.line,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: font.bodySemi,
                        fontSize: size.xs,
                        color: active ? s.fg : colors.bark,
                      }}
                    >
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: "row", gap: space.md, marginBottom: space.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Overall Audit Score (0 - 100)</Text>
                <TextInput
                  value={overallScore}
                  onChangeText={setOverallScore}
                  keyboardType="numeric"
                  placeholder="e.g. 85"
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Ammonia Gas (ppm)</Text>
                <TextInput
                  value={ammoniaPpm}
                  onChangeText={setAmmoniaPpm}
                  keyboardType="numeric"
                  placeholder="e.g. 14.5"
                  style={styles.input}
                />
              </View>
            </View>

            <View style={{ marginBottom: space.md }}>
              <Text style={styles.label}>Observed Bedding Moisture (%)</Text>
              <TextInput
                value={beddingMoisture}
                onChangeText={setBeddingMoisture}
                keyboardType="numeric"
                placeholder="e.g. 35 (Dry < 40%, Wet > 50%)"
                style={styles.input}
              />
            </View>

            {/* Step 3: Hygiene & Biosecurity Categories */}
            <Text style={styles.sectionHeading}>3. Category Ratings (1 to 5 Stars)</Text>
            <RatingPills label="Biosecurity & Pest Barrier" value={biosecurity} onChange={setBiosecurity} />
            <RatingPills label="Barn Ventilation & Airflow" value={ventilation} onChange={setVentilation} />
            <RatingPills label="Bedding Hygiene & Dryness" value={bedding} onChange={setBedding} />
            <RatingPills label="Water & Feed Safety" value={waterFeed} onChange={setWaterFeed} />
            <RatingPills label="Milking Sanitation & Teat Care" value={milking} onChange={setMilking} />
            <RatingPills label="Animal Housing & Welfare" value={welfare} onChange={setWelfare} />

            {/* Step 4: Summary & Recommendations */}
            <Text style={styles.sectionHeading}>4. Findings & Recommendations</Text>
            <Text style={styles.label}>Inspection Summary *</Text>
            <TextInput
              multiline
              numberOfLines={3}
              value={summary}
              onChangeText={setSummary}
              placeholder="Summary of shed condition, cleanliness, and overall findings…"
              placeholderTextColor={colors.muted}
              style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]}
            />

            <Text style={styles.label}>Deficiencies / Non-Compliances (Optional)</Text>
            <TextInput
              multiline
              numberOfLines={2}
              value={deficiencies}
              onChangeText={setDeficiencies}
              placeholder="e.g. Standing slurry near pen 3, feed trough contamination…"
              placeholderTextColor={colors.muted}
              style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
            />

            <Text style={styles.label}>Corrective Action Plan for Farmer (Optional)</Text>
            <TextInput
              multiline
              numberOfLines={2}
              value={recommendations}
              onChangeText={setRecommendations}
              placeholder="e.g. Spread dry lime powder, unblock ventilation louvers…"
              placeholderTextColor={colors.muted}
              style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
            />

            {/* Follow-up toggle */}
            <Pressable
              onPress={() => setFollowUpRequired(!followUpRequired)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginVertical: space.sm,
              }}
            >
              <Feather
                name={followUpRequired ? "check-square" : "square"}
                size={20}
                color={followUpRequired ? colors.pasture : colors.muted}
              />
              <Text style={{ fontFamily: font.bodySemi, fontSize: size.xs, color: colors.ink }}>
                Schedule Follow-up Re-Inspection (within 14 days)
              </Text>
            </Pressable>

            {/* Actions */}
            <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
              <View style={{ flex: 1 }}>
                <Button label="Cancel" variant="secondary" onPress={onClose} disabled={submitting} />
              </View>
              <View style={{ flex: 2 }}>
                <Button
                  label={submitting ? "Submitting Report…" : "Submit Report"}
                  onPress={handleSubmit}
                  loading={submitting}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ── Notes modal for complaint actions ────────────────────────────────────── */
function NotesModal({
  visible,
  title,
  onConfirm,
  onCancel,
  loading,
}: {
  visible: boolean;
  title: string;
  onConfirm: (notes: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [notes, setNotes] = useState("");
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onCancel}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
        onPress={onCancel}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.milk,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: space.xl,
            paddingBottom: 40,
          }}
        >
          <Text
            style={{
              fontFamily: font.display,
              fontSize: size.md,
              color: colors.ink,
              marginBottom: space.md,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontFamily: font.body,
              fontSize: size.sm,
              color: colors.bark,
              marginBottom: space.sm,
            }}
          >
            Inspection findings (optional)
          </Text>
          <TextInput
            multiline
            numberOfLines={4}
            value={notes}
            onChangeText={setNotes}
            placeholder="Describe inspection findings, violations, or actions taken…"
            placeholderTextColor={colors.muted}
            style={{
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: radius.md,
              padding: space.md,
              fontFamily: font.body,
              fontSize: size.base,
              color: colors.ink,
              minHeight: 100,
              textAlignVertical: "top",
              marginBottom: space.lg,
            }}
          />
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={loading} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={loading ? "Saving…" : "Submit"}
                onPress={() => onConfirm(notes)}
                loading={loading}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── Assigned Complaint card ─────────────────────────────────────────────── */
function InspectionCard({
  complaint: c,
  onAction,
}: {
  complaint: Complaint;
  onAction: (c: Complaint, s: ComplaintStatus) => void;
}) {
  const router = useRouter();
  const pBg =
    c.priority === "critical" || c.priority === "high"
      ? colors.sindoorSoft
      : colors.marigoldSoft;
  const pFg =
    c.priority === "critical" || c.priority === "high" ? colors.sindoor : "#8A5D13";
  return (
    <Card style={{ marginBottom: space.md }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: space.sm,
          gap: space.sm,
        }}
      >
        <View style={{ backgroundColor: pBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
          <Text style={{ fontFamily: font.bodySemi, fontSize: 11, color: pFg }}>
            {c.priority.toUpperCase()}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: colors.pastureSoft,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 99,
          }}
        >
          <Text style={{ fontFamily: font.bodySemi, fontSize: 11, color: colors.pasture }}>
            {STATUS_LABEL[c.status]}
          </Text>
        </View>
        <Text
          style={{
            marginLeft: "auto",
            fontFamily: font.body,
            fontSize: size.xs,
            color: colors.muted,
          }}
        >
          {c.complaint_ref ?? `#${c.complaint_number}`}
        </Text>
      </View>
      <Text
        style={{
          fontFamily: font.bodySemi,
          fontSize: size.base,
          color: colors.ink,
          marginBottom: 4,
        }}
        numberOfLines={2}
      >
        {c.description}
      </Text>
      {c.symptoms ? (
        <Text
          style={{
            fontFamily: font.body,
            fontSize: size.sm,
            color: colors.bark,
            marginBottom: space.sm,
          }}
          numberOfLines={1}
        >
          Symptoms: {c.symptoms}
        </Text>
      ) : null}
      <Text
        style={{
          fontFamily: font.body,
          fontSize: size.xs,
          color: colors.muted,
          marginBottom: space.md,
        }}
      >
        Raised {prettyDate(c.created_at)}
      </Text>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Pressable
          onPress={() => router.push(`/cow/${c.bovine_id}` as any)}
          style={{
            flex: 1,
            padding: space.sm,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.line,
            alignItems: "center",
          }}
        >
          <Text style={{ fontFamily: font.bodyMid, fontSize: size.sm, color: colors.pasture }}>
            View Animal
          </Text>
        </Pressable>
        {c.status === "assigned" && (
          <Pressable
            onPress={() => onAction(c, "in_progress")}
            style={{
              flex: 1,
              padding: space.sm,
              borderRadius: radius.md,
              backgroundColor: colors.marigoldSoft,
              alignItems: "center",
            }}
          >
            <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: "#8A5D13" }}>
              Begin Visit
            </Text>
          </Pressable>
        )}
        {c.status === "in_progress" && (
          <Pressable
            onPress={() => onAction(c, "resolved")}
            style={{
              flex: 1,
              padding: space.sm,
              borderRadius: radius.md,
              backgroundColor: colors.pastureSoft,
              alignItems: "center",
            }}
          >
            <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: colors.pasture }}>
              Log Findings
            </Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

/* ── Outbreak card ────────────────────────────────────────────────────────── */
function OutbreakCard({ cluster }: { cluster: OutbreakCluster }) {
  const sev = cluster.severity;
  const bg =
    sev === "critical"
      ? colors.sindoorSoft
      : sev === "warning"
      ? colors.marigoldSoft
      : colors.pastureSoft;
  const fg =
    sev === "critical" ? colors.sindoor : sev === "warning" ? "#8A5D13" : colors.pasture;
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: radius.md,
        padding: space.md,
        marginBottom: space.sm,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Feather name="alert-triangle" size={18} color={fg} style={{ marginRight: space.sm }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.bodySemi, fontSize: size.base, color: colors.ink }}>
          {cluster.village_or_place}
        </Text>
        <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.bark }}>
          {cluster.case_count} {cluster.case_count === 1 ? "case" : "cases"} · Last{" "}
          {prettyDate(cluster.latest_incident_at)}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: fg,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 99,
        }}
      >
        <Text style={{ fontFamily: font.bodySemi, fontSize: 11, color: colors.milk }}>
          {sev.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

/* ── Stat tile ────────────────────────────────────────────────────────────── */
function StatTile({
  value,
  label,
  bg,
  fg,
}: {
  value: string;
  label: string;
  bg: string;
  fg: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: bg,
        borderRadius: radius.md,
        padding: space.md,
        alignItems: "center",
      }}
    >
      <Text style={{ fontFamily: font.display, fontSize: size.lg, color: fg }}>{value}</Text>
      <Text
        style={{
          fontFamily: font.body,
          fontSize: size.xs,
          color: fg,
          textAlign: "center",
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/* ── Main InspectorHome ───────────────────────────────────────────────────── */
export default function InspectorHome({
  onLookup,
  onOpenNotifications,
  unreadCount = 0,
  onBack,
}: {
  onLookup?: () => void;
  onOpenNotifications?: () => void;
  unreadCount?: number;
  onBack?: () => void;
} = {}) {
  const { user } = useAuth();
  const router = useRouter();
  const handleLookup = onLookup ?? (() => router.push("/(tabs)/lookup"));

  const [cases, setCases] = useState<Complaint[]>([]);
  const [outbreaks, setOutbreaks] = useState<OutbreakCluster[]>([]);
  const [barnInspections, setBarnInspections] = useState<FarmInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");

  // Modals
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [pendingComplaint, setPendingComplaint] = useState<Complaint | null>(null);
  const [pendingStatus, setPendingStatus] = useState<ComplaintStatus | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [barnModalVisible, setBarnModalVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allCases, outbreakData, allInspections] = await Promise.all([
        complaintsApi.list(),
        alertsApi.outbreaks(),
        inspectionsApi.list(),
      ]);
      setCases(allCases.filter((c) => c.status !== "resolved" && c.status !== "closed"));
      setOutbreaks(outbreakData);
      setBarnInspections(allInspections);
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openNotesModal = (complaint: Complaint, newStatus: ComplaintStatus) => {
    setPendingComplaint(complaint);
    setPendingStatus(newStatus);
    setNotesModalVisible(true);
  };

  const confirmAction = async (notes: string) => {
    if (!pendingComplaint || !pendingStatus) return;
    setActionLoading(true);
    try {
      await complaintsApi.updateStatus(pendingComplaint.id, {
        status: pendingStatus,
        resolved_notes: notes.trim() || null,
      });
      setNotesModalVisible(false);
      setPendingComplaint(null);
      setPendingStatus(null);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Update failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const assigned = cases.filter((c) => c.status === "assigned");
  const inProgress = cases.filter((c) => c.status === "in_progress");

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
            else router.replace("/(auth)/landing");
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
            <Caption>Field Inspector Dashboard</Caption>
            <Title>Welcome, {user?.name?.split(" ")[0] ?? "Inspector"}</Title>
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
                width: 44,
                height: 44,
                borderRadius: radius.pill,
                backgroundColor: colors.milk,
                borderWidth: 1,
                borderColor: colors.line,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Feather name="bell" size={22} color={colors.ink} />
              {unreadCount > 0 ? (
                <View
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: colors.sindoor,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 4,
                    borderWidth: 1.5,
                    borderColor: colors.milk,
                  }}
                >
                  <Text style={{ color: colors.milk, fontSize: 10, fontFamily: font.bodySemi }}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    position: "absolute",
                    top: 9,
                    right: 10,
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: colors.pasture,
                  }}
                />
              )}
            </Pressable>
          )}
        </View>
        <View style={{ height: space.sm }} />

        <Banner message={error} />
        {successNotice ? <Banner message={successNotice} tone="good" /> : null}

        {/* Action Card: Conduct Farm / Barn Inspection */}
        <Card
          style={{
            backgroundColor: colors.pastureSoft,
            borderColor: colors.pasture,
            borderWidth: 1.5,
            marginBottom: space.lg,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: radius.pill,
                backgroundColor: colors.milk,
                alignItems: "center",
                justifyContent: "center",
                marginRight: space.md,
              }}
            >
              <Feather name="clipboard" size={24} color={colors.pasture} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.bodySemi, fontSize: size.base, color: colors.ink }}>
                Barn & Farm Inspection
              </Text>
              <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.bark, marginTop: 2 }}>
                Conduct on-site audit for ventilation, hygiene & biosecurity. Delivers an official report card to the farmer.
              </Text>
            </View>
          </View>
          <View style={{ marginTop: space.md }}>
            <Button
              label="+ Conduct Barn Inspection"
              onPress={() => {
                setSuccessNotice("");
                setBarnModalVisible(true);
              }}
            />
          </View>
        </Card>

        {/* Stats */}
        <View style={{ flexDirection: "row", gap: space.sm, marginBottom: space.lg }}>
          <StatTile value={String(assigned.length)} label="Pending Cases" bg={colors.marigoldSoft} fg="#8A5D13" />
          <StatTile value={String(inProgress.length)} label="In Progress" bg={colors.pastureSoft} fg={colors.pasture} />
          <StatTile value={String(barnInspections.length)} label="Audits Filed" bg={colors.milk} fg={colors.pasture} />
        </View>

        {/* Outbreak warnings */}
        {outbreaks.length > 0 && (
          <Card style={{ marginBottom: space.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: space.sm }}>
              <Feather name="alert-triangle" size={16} color={colors.sindoor} style={{ marginRight: space.sm }} />
              <Text style={{ fontFamily: font.bodySemi, fontSize: size.base, color: colors.ink }}>
                Outbreak Warnings in Your Area
              </Text>
            </View>
            {outbreaks.slice(0, 3).map((o, i) => (
              <OutbreakCard key={i} cluster={o} />
            ))}
          </Card>
        )}

        {/* Section: Recent Barn Inspection Reports Filed */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.sm }}>
          <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink }}>
            Recent Barn Inspections
          </Text>
          <Pressable onPress={() => router.push("/farm/inspections")}>
            <Text style={{ fontFamily: font.bodyMid, fontSize: size.sm, color: colors.pasture }}>
              View all ({barnInspections.length}) →
            </Text>
          </Pressable>
        </View>

        {barnInspections.length === 0 ? (
          <Card style={{ marginBottom: space.lg }}>
            <View style={{ alignItems: "center", padding: space.md }}>
              <Feather name="file-text" size={28} color={colors.muted} />
              <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: colors.ink, marginTop: space.xs }}>
                No audits filed yet
              </Text>
              <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted, textAlign: "center", marginTop: 2 }}>
                Tap "+ Conduct Barn Inspection" above to audit a farm.
              </Text>
            </View>
          </Card>
        ) : (
          barnInspections.slice(0, 3).map((bi) => {
            const gradeBg =
              bi.status === "passed"
                ? colors.pastureSoft
                : bi.status === "conditional_pass"
                ? colors.marigoldSoft
                : colors.sindoorSoft;
            const gradeFg =
              bi.status === "passed"
                ? colors.pasture
                : bi.status === "conditional_pass"
                ? "#8A5D13"
                : colors.sindoor;

            return (
              <Pressable
                key={bi.id}
                onPress={() => router.push(`/farm/inspections?inspectionId=${bi.id}`)}
              >
                <Card style={{ marginBottom: space.sm }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <View style={{ backgroundColor: gradeBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill }}>
                      <Text style={{ fontFamily: font.bodySemi, fontSize: 10, color: gradeFg }}>
                        {bi.status === "passed" ? "GRADE A" : bi.status === "conditional_pass" ? "GRADE B" : "GRADE C"} · {bi.overall_score}/100
                      </Text>
                    </View>
                    <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted }}>
                      {prettyDate(bi.inspected_at)}
                    </Text>
                  </View>

                  <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: colors.ink }}>
                    {bi.farmer_name || "Farm"} {bi.farmer_place ? `(${bi.farmer_place})` : ""}
                  </Text>
                  <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.bark, marginTop: 2 }} numberOfLines={2}>
                    {bi.summary}
                  </Text>
                </Card>
              </Pressable>
            );
          })
        )}

        <View style={{ height: space.md }} />

        {/* Assigned Complaints Section */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: space.sm }}>
          <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink, flex: 1 }}>
            Assigned Complaint Visits
          </Text>
          <Pressable onPress={() => router.push("/(tabs)/complaints" as any)}>
            <Text style={{ fontFamily: font.bodyMid, fontSize: size.sm, color: colors.pasture }}>
              View all →
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.pasture} style={{ marginVertical: space.xl }} />
        ) : cases.length === 0 ? (
          <Card>
            <View style={{ alignItems: "center", padding: space.lg }}>
              <Feather name="check-circle" size={36} color={colors.pasture} />
              <Text style={{ fontFamily: font.bodySemi, fontSize: size.base, color: colors.ink, marginTop: space.sm }}>
                All clear!
              </Text>
              <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, textAlign: "center", marginTop: 4 }}>
                No pending complaint inspections.
              </Text>
            </View>
          </Card>
        ) : (
          cases.map((c) => <InspectionCard key={c.id} complaint={c} onAction={openNotesModal} />)
        )}

        {/* Quick search */}
        <View style={{ height: space.lg }} />
        <Pressable onPress={handleLookup}>
          <Card style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.pill,
                backgroundColor: colors.pastureSoft,
                alignItems: "center",
                justifyContent: "center",
                marginRight: space.md,
              }}
            >
              <Feather name="search" size={20} color={colors.pasture} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.bodySemi, fontSize: size.base, color: colors.ink }}>
                Find an Animal
              </Text>
              <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginTop: 2 }}>
                Scan ear tag or enter Pashu Aadhaar
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.muted} />
          </Card>
        </Pressable>
      </ScrollView>

      {/* Complaint visit notes modal */}
      <NotesModal
        visible={notesModalVisible}
        title={pendingStatus === "in_progress" ? "Begin Inspection" : "Log Inspection Findings"}
        onConfirm={confirmAction}
        onCancel={() => setNotesModalVisible(false)}
        loading={actionLoading}
      />

      {/* Conduct Barn Inspection Modal */}
      <BarnInspectionModal
        visible={barnModalVisible}
        onClose={() => setBarnModalVisible(false)}
        onSuccess={() => {
          setSuccessNotice("Barn inspection filed successfully! Report delivered to the farmer.");
          load();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeading: {
    fontFamily: font.bodySemi,
    fontSize: size.sm,
    color: colors.ink,
    marginTop: space.sm,
    marginBottom: space.xs,
  },
  label: {
    fontFamily: font.body,
    fontSize: size.xs,
    color: colors.bark,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
    fontFamily: font.body,
    fontSize: size.sm,
    color: colors.ink,
    backgroundColor: colors.milk,
    marginBottom: space.sm,
  },
});
