import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Badge, Banner, Button, Caption, Card, Empty, Title } from '../../src/components/ui';
import { StatusBadge, PriorityBadge } from '../(tabs)/complaints';
import { complaints as complaintsApi, users as usersApi, ApiError } from '../../src/api';
import type { Complaint, UserPublic } from '../../src/api/types';
import { prettyDate } from '../../src/lib/format';
import { colors, font, radius, size, space } from '../../src/theme';

export default function StaffWorkloadScreen() {
  const router = useRouter();
  const { staffId } = useLocalSearchParams<{ staffId?: string }>();

  const [staffList, setStaffList] = useState<UserPublic[]>([]);
  const [complaintList, setComplaintList] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [roleFilter, setRoleFilter] = useState<'all' | 'doctor' | 'inspector'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<UserPublic | null>(null);
  const [caseTab, setCaseTab] = useState<'active' | 'resolved'>('active');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [doctors, inspectors, allComplaints] = await Promise.all([
        usersApi.listByRole('doctor'),
        usersApi.listByRole('inspector'),
        complaintsApi.list(),
      ]);

      const allStaff = [...doctors, ...inspectors];
      setStaffList(allStaff);
      setComplaintList(allComplaints);
      setError('');

      if (staffId) {
        const found = allStaff.find((s) => s.id === staffId);
        if (found) setSelectedStaff(found);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load staff workload.');
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Map cases per staff member
  const staffCasesMap = useMemo(() => {
    const map: Record<string, Complaint[]> = {};
    complaintList.forEach((c) => {
      if (c.assigned_to) {
        if (!map[c.assigned_to]) map[c.assigned_to] = [];
        map[c.assigned_to].push(c);
      }
    });
    return map;
  }, [complaintList]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      if (roleFilter !== 'all' && s.role !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesJurisdiction = s.jurisdiction?.toLowerCase().includes(q);
        const matchesEmpId = s.employee_id?.toLowerCase().includes(q);
        const matchesPhone = s.phone?.toLowerCase().includes(q);
        if (!matchesName && !matchesJurisdiction && !matchesEmpId && !matchesPhone) return false;
      }
      return true;
    });
  }, [staffList, roleFilter, searchQuery]);

  // Workload statistics
  const stats = useMemo(() => {
    let activeCases = 0;
    let overloadedCount = 0;
    let availableCount = 0;

    staffList.forEach((s) => {
      const cases = staffCasesMap[s.id] || [];
      const active = cases.filter((c) => c.status !== 'resolved' && c.status !== 'closed').length;
      activeCases += active;
      if (active >= 5) overloadedCount++;
      if (active === 0) availableCount++;
    });

    const unassignedCount = complaintList.filter(
      (c) => !c.assigned_to && c.status !== 'resolved' && c.status !== 'closed'
    ).length;

    return {
      totalStaff: staffList.length,
      activeCases,
      overloadedCount,
      availableCount,
      unassignedCount,
    };
  }, [staffList, complaintList, staffCasesMap]);

  // Selected staff's cases
  const selectedStaffCases = useMemo(() => {
    if (!selectedStaff) return { active: [], resolved: [] };
    const cases = staffCasesMap[selectedStaff.id] || [];
    return {
      active: cases.filter((c) => c.status !== 'resolved' && c.status !== 'closed'),
      resolved: cases.filter((c) => c.status === 'resolved' || c.status === 'closed'),
    };
  }, [selectedStaff, staffCasesMap]);

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.surface }}
        contentContainerStyle={{ padding: space.lg, paddingTop: 56, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.pasture} />}
      >
        {/* Back navigation button */}
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: space.sm,
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

        <Caption>District Authority</Caption>
        <Title>Staff Workload & Caseloads</Title>
        <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginTop: 4, marginBottom: space.md }}>
          Monitor officer workloads, view detailed contact information, and review assigned field complaints.
        </Text>

        <Banner message={error} />

        {/* Summary Stat Tiles */}
        <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.sm }}>
          <StatBox value={String(stats.totalStaff)} label="Active Staff" color={colors.pasture} bg={colors.pastureSoft} />
          <StatBox value={String(stats.activeCases)} label="Active Cases" color="#8A5D13" bg={colors.marigoldSoft} />
          <StatBox value={String(stats.overloadedCount)} label="Overloaded (≥5)" color={colors.sindoor} bg={colors.sindoorSoft} />
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
          <StatBox value={String(stats.availableCount)} label="Available (0)" color="#0369a1" bg="#e0f2fe" />
          <StatBox value={String(stats.unassignedCount)} label="Unassigned" color={colors.bark} bg={colors.surface} />
        </View>

        {/* Role Filter Chips */}
        <View style={{ flexDirection: 'row', gap: space.xs, marginBottom: space.md }}>
          <FilterChip
            label="All Staff"
            count={staffList.length}
            selected={roleFilter === 'all'}
            onPress={() => setRoleFilter('all')}
          />
          <FilterChip
            label="Veterinarians"
            count={staffList.filter((s) => s.role === 'doctor').length}
            selected={roleFilter === 'doctor'}
            onPress={() => setRoleFilter('doctor')}
          />
          <FilterChip
            label="Inspectors"
            count={staffList.filter((s) => s.role === 'inspector').length}
            selected={roleFilter === 'inspector'}
            onPress={() => setRoleFilter('inspector')}
          />
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color={colors.muted} style={{ marginRight: space.sm }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, jurisdiction, employee ID..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Feather name="x" size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>

        {/* Staff Directory */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }}>
          <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink }}>
            Staff Directory ({filteredStaff.length})
          </Text>
          <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted }}>
            Tap an officer to view cases
          </Text>
        </View>

        {loading && staffList.length === 0 ? (
          <ActivityIndicator color={colors.pasture} style={{ marginVertical: space.xl }} />
        ) : filteredStaff.length === 0 ? (
          <Empty
            title="No staff found"
            body={searchQuery ? 'Try changing your search term or role filter.' : 'No active staff registered in this district.'}
          />
        ) : (
          filteredStaff.map((staff) => {
            const cases = staffCasesMap[staff.id] || [];
            const activeCount = cases.filter((c) => c.status !== 'resolved' && c.status !== 'closed').length;
            const isOverloaded = activeCount >= 5;
            const isDoctor = staff.role === 'doctor';

            return (
              <Pressable
                key={staff.id}
                onPress={() => {
                  setSelectedStaff(staff);
                  setCaseTab('active');
                }}
                style={({ pressed }) => [styles.staffCard, pressed && { opacity: 0.85 }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {/* Avatar */}
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: isDoctor ? '#e0f2fe' : colors.marigoldSoft },
                    ]}
                  >
                    <Text
                      style={{
                        fontFamily: font.displayMid,
                        fontSize: size.md,
                        color: isDoctor ? '#0369a1' : '#8A5D13',
                      }}
                    >
                      {staff.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1, paddingRight: space.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' }}>
                      <Text style={{ fontFamily: font.bodySemi, fontSize: size.base, color: colors.ink }}>
                        {staff.name}
                      </Text>
                      <Badge
                        label={isDoctor ? 'Veterinarian' : 'Field Inspector'}
                        tone={isDoctor ? 'good' : 'warn'}
                      />
                    </View>

                    <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted, marginTop: 2 }}>
                      {[staff.employee_id, staff.jurisdiction || 'District General'].filter(Boolean).join(' · ')}
                    </Text>

                    {staff.phone ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                        <Feather name="phone" size={11} color={colors.muted} style={{ marginRight: 4 }} />
                        <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.bark }}>
                          {staff.phone}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Case Count Badge */}
                  <View
                    style={[
                      styles.caseloadBadge,
                      {
                        backgroundColor: isOverloaded
                          ? colors.sindoorSoft
                          : activeCount > 0
                          ? colors.marigoldSoft
                          : colors.pastureSoft,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontFamily: font.bodySemi,
                        fontSize: size.xs,
                        color: isOverloaded ? colors.sindoor : activeCount > 0 ? '#8A5D13' : colors.pasture,
                      }}
                    >
                      {activeCount} {activeCount === 1 ? 'case' : 'cases'}
                    </Text>
                  </View>
                </View>

                {/* Workload Progress Bar */}
                <View style={styles.workloadBarWrap}>
                  <View
                    style={[
                      styles.workloadBar,
                      {
                        width: `${Math.min(100, Math.max(6, (activeCount / 6) * 100))}%`,
                        backgroundColor: isOverloaded
                          ? colors.sindoor
                          : activeCount >= 3
                          ? colors.marigold
                          : colors.pasture,
                      },
                    ]}
                  />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs }}>
                  <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted }}>
                    {isOverloaded ? '⚠️ Heavy Load' : activeCount === 0 ? '🟢 Available for dispatch' : 'Active caseload'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontFamily: font.bodyMid, fontSize: size.xs, color: colors.pasture, marginRight: 2 }}>
                      View cases
                    </Text>
                    <Feather name="chevron-right" size={14} color={colors.pasture} />
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Staff Detail & Assigned Cases Modal */}
      {selectedStaff && (
        <Modal
          visible={!!selectedStaff}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setSelectedStaff(null)}
        >
          <View style={{ flex: 1, backgroundColor: colors.surface }}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Caption>Staff Officer Profile</Caption>
                <Title>{selectedStaff.name}</Title>
              </View>
              <Pressable
                onPress={() => setSelectedStaff(null)}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Feather name="x" size={20} color={colors.ink} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
              {/* Detailed Officer Profile Card */}
              <Card style={{ marginBottom: space.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
                  <View
                    style={[
                      styles.largeAvatar,
                      { backgroundColor: selectedStaff.role === 'doctor' ? '#e0f2fe' : colors.marigoldSoft },
                    ]}
                  >
                    <Text
                      style={{
                        fontFamily: font.displayMid,
                        fontSize: size.xl,
                        color: selectedStaff.role === 'doctor' ? '#0369a1' : '#8A5D13',
                      }}
                    >
                      {selectedStaff.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: space.md }}>
                    <Text style={{ fontFamily: font.displayMid, fontSize: size.lg, color: colors.ink }}>
                      {selectedStaff.name}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: space.xs, marginTop: 4 }}>
                      <Badge
                        label={selectedStaff.role === 'doctor' ? 'Veterinary Officer' : 'Field Inspector'}
                        tone={selectedStaff.role === 'doctor' ? 'good' : 'warn'}
                      />
                      {selectedStaff.is_active ? (
                        <Badge label="Active" tone="good" />
                      ) : (
                        <Badge label="Inactive" tone="risk" />
                      )}
                    </View>
                  </View>
                </View>

                <View style={styles.profileDivider} />

                {/* Profile Fields */}
                <DetailRow icon="briefcase" label="Employee ID" value={selectedStaff.employee_id || 'Not assigned'} />
                <DetailRow icon="map-pin" label="Jurisdiction" value={selectedStaff.jurisdiction || 'District General'} />
                <DetailRow icon="layers" label="Department" value={selectedStaff.department || 'Animal Husbandry & Veterinary'} />
                <DetailRow icon="phone" label="Phone" value={selectedStaff.phone || 'None'} />
                <DetailRow icon="mail" label="Email" value={selectedStaff.email || 'None'} />
              </Card>

              {/* Caseload Summary Card */}
              <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
                <StatBox
                  value={String(selectedStaffCases.active.length)}
                  label="Active Assigned"
                  color={selectedStaffCases.active.length >= 5 ? colors.sindoor : '#8A5D13'}
                  bg={selectedStaffCases.active.length >= 5 ? colors.sindoorSoft : colors.marigoldSoft}
                />
                <StatBox
                  value={String(selectedStaffCases.resolved.length)}
                  label="Resolved Cases"
                  color={colors.pasture}
                  bg={colors.pastureSoft}
                />
              </View>

              {/* Cases Header & Tabs */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }}>
                <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink }}>
                  Assigned Complaints
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: space.xs, marginBottom: space.md }}>
                <FilterChip
                  label="Active Cases"
                  count={selectedStaffCases.active.length}
                  selected={caseTab === 'active'}
                  onPress={() => setCaseTab('active')}
                />
                <FilterChip
                  label="Completed / Resolved"
                  count={selectedStaffCases.resolved.length}
                  selected={caseTab === 'resolved'}
                  onPress={() => setCaseTab('resolved')}
                />
              </View>

              {/* List of Cases */}
              {(caseTab === 'active' ? selectedStaffCases.active : selectedStaffCases.resolved).length === 0 ? (
                <Card>
                  <View style={{ alignItems: 'center', padding: space.lg }}>
                    <Feather
                      name={caseTab === 'active' ? 'check-circle' : 'archive'}
                      size={32}
                      color={colors.pasture}
                    />
                    <Text style={{ fontFamily: font.bodySemi, fontSize: size.base, color: colors.ink, marginTop: space.sm }}>
                      {caseTab === 'active' ? 'No active cases' : 'No resolved cases recorded'}
                    </Text>
                    <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, textAlign: 'center', marginTop: 4 }}>
                      {caseTab === 'active'
                        ? 'This officer is currently available for dispatch and new case assignments.'
                        : 'Resolved cases will appear here once marked completed.'}
                    </Text>
                  </View>
                </Card>
              ) : (
                (caseTab === 'active' ? selectedStaffCases.active : selectedStaffCases.resolved).map((complaint) => (
                  <Pressable
                    key={complaint.id}
                    onPress={() => {
                      setSelectedStaff(null);
                      router.push(`/complaints/${complaint.id}`);
                    }}
                  >
                    <Card style={{ marginBottom: space.sm }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                          <Text style={{ fontFamily: font.displayMid, fontSize: size.base, color: colors.ink }}>
                            {complaint.complaint_ref || `#${complaint.complaint_number ?? '—'}`}
                          </Text>
                          <PriorityBadge priority={complaint.priority} />
                        </View>
                        <StatusBadge status={complaint.status} />
                      </View>

                      <Text
                        style={{
                          fontFamily: font.bodySemi,
                          fontSize: size.sm,
                          color: colors.ink,
                          marginTop: space.xs,
                        }}
                        numberOfLines={2}
                      >
                        {complaint.description}
                      </Text>

                      {complaint.symptoms ? (
                        <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
                          Symptoms: {complaint.symptoms}
                        </Text>
                      ) : null}

                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: space.sm,
                          paddingTop: space.xs,
                          borderTopWidth: 1,
                          borderTopColor: colors.line,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Feather name="clock" size={12} color={colors.muted} style={{ marginRight: 4 }} />
                          <Text style={{ fontFamily: font.body, fontSize: size.xs, color: colors.muted }}>
                            {prettyDate(complaint.created_at)}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontFamily: font.bodyMid, fontSize: size.xs, color: colors.pasture }}>
                            Open Case Detail →
                          </Text>
                        </View>
                      </View>
                    </Card>
                  </Pressable>
                ))
              )}

              <View style={{ height: space.lg }} />
              <Button label="Close Profile" onPress={() => setSelectedStaff(null)} variant="secondary" />
            </ScrollView>
          </View>
        </Modal>
      )}
    </>
  );
}

function StatBox({ value, label, color, bg }: { value: string; label: string; color: string; bg: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: radius.md, padding: space.sm, alignItems: 'center' }}>
      <Text style={{ fontFamily: font.display, fontSize: size.lg, color }}>{value}</Text>
      <Text style={{ fontFamily: font.body, fontSize: size.xs, color, textAlign: 'center', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function FilterChip({
  label,
  count,
  selected,
  onPress,
}: {
  label: string;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.pasture : colors.milk,
        borderWidth: 1,
        borderColor: selected ? colors.pasture : colors.line,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: font.bodySemi,
          fontSize: size.xs,
          color: selected ? colors.milk : colors.ink,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          marginLeft: 6,
          backgroundColor: selected ? 'rgba(255,255,255,0.25)' : colors.line,
          paddingHorizontal: 6,
          paddingVertical: 1,
          borderRadius: 99,
        }}
      >
        <Text
          style={{
            fontFamily: font.bodySemi,
            fontSize: 10,
            color: selected ? colors.milk : colors.bark,
          }}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

function DetailRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
      <Feather name={icon} size={15} color={colors.muted} style={{ width: 22, marginRight: space.xs }} />
      <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, width: 110 }}>{label}:</Text>
      <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: colors.ink, flex: 1 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.milk,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    marginBottom: space.lg,
  },
  searchInput: {
    flex: 1,
    fontFamily: font.body,
    fontSize: size.sm,
    color: colors.ink,
    padding: 0,
  },
  staffCard: {
    backgroundColor: colors.milk,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    marginBottom: space.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  largeAvatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caseloadBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  workloadBarWrap: {
    height: 5,
    backgroundColor: colors.line,
    borderRadius: 99,
    overflow: 'hidden',
    marginTop: space.sm,
    marginBottom: 4,
  },
  workloadBar: {
    height: '100%',
    borderRadius: 99,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: 56,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.milk,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDivider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: space.sm,
  },
});
