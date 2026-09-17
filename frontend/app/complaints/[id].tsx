import React, { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Badge, Banner, Button, Caption, Card, Empty, Field, Heading, Title } from '../../src/components/ui';
import CowLoader from '../../src/components/CowLoader';
import { useAuth } from '../../src/lib/auth';
import { complaints as complaintsApi, cows as cowsApi, users as usersApi, ApiError } from '../../src/api';
import type { Complaint, ComplaintStatus, CowWithHistory, UserPublic } from '../../src/api/types';
import { PriorityBadge, StatusBadge } from '../(tabs)/complaints';
import { cowLabel, prettyDate } from '../../src/lib/format';
import { colors, font, radius, size, space } from '../../src/theme';

export default function ComplaintDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [bovine, setBovine] = useState<CowWithHistory | null>(null);
  const [assignedStaff, setAssignedStaff] = useState<UserPublic | null>(null);
  const [staffList, setStaffList] = useState<UserPublic[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  // Status transition state
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [reassignTarget, setReassignTarget] = useState('');

  const isFarmer = user?.role === 'farmer';
  const isDoctorOrInspector = user?.role === 'doctor' || user?.role === 'inspector';
  const isAuthority = user?.role === 'authority';

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const c = await complaintsApi.byId(id);
      setComplaint(c);
      setError('');

      // Fetch bovine details
      if (c.bovine_id) {
        try {
          const cow = await cowsApi.detail(c.bovine_id);
          setBovine(cow);
        } catch {
          // Non-blocking if animal fetch fails
        }
      }

      // Fetch assigned staff name if available
      if (c.assigned_to) {
        try {
          const staff = await usersApi.byId(c.assigned_to);
          setAssignedStaff(staff);
        } catch {
          // Non-blocking
        }
      }

      // If authority, load staff list for reassignment
      if (user?.role === 'authority') {
        try {
          const [doctors, inspectors] = await Promise.all([
            usersApi.listByRole('doctor'),
            usersApi.listByRole('inspector'),
          ]);
          setStaffList([...doctors, ...inspectors]);
        } catch {
          // Non-blocking
        }
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load complaint details.');
    } finally {
      setLoading(false);
    }
  }, [id, user?.role]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(nextStatus: ComplaintStatus, notes?: string) {
    if (!complaint) return;
    if (nextStatus === 'resolved' && !notes?.trim()) {
      return setError('Please enter resolution notes describing diagnosis and treatment.');
    }

    setActionBusy(true);
    setError('');
    try {
      const updated = await complaintsApi.updateStatus(complaint.id, {
        status: nextStatus,
        resolved_notes: notes?.trim() || null,
      });
      setComplaint(updated);
      setNotice(`Status updated to ${nextStatus.replace('_', ' ')}.`);
      setResolutionNotes('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update complaint status.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReassign() {
    if (!complaint || !reassignTarget) return;
    setActionBusy(true);
    setError('');
    try {
      const updated = await complaintsApi.assign(complaint.id, {
        assigned_to: reassignTarget,
      });
      setComplaint(updated);
      setNotice('Complaint reassigned successfully.');
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to reassign complaint.');
    } finally {
      setActionBusy(false);
    }
  }

  if (loading && !complaint) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: 'center' }}>
        <CowLoader label="Loading complaint…" />
      </View>
    );
  }

  if (!complaint) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ padding: space.lg, paddingTop: 64 }}>
        <Banner message={error || 'Complaint not found.'} />
        <Button label="Go back" onPress={() => router.back()} variant="secondary" />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.surface }}
        contentContainerStyle={{ padding: space.lg, paddingTop: 56, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.pasture} />}
      >
        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.lg }}>
          <Feather name="arrow-left" size={19} color={colors.bark} />
          <Text style={{ fontFamily: font.bodyMid, fontSize: size.base, color: colors.bark, marginLeft: 6 }}>Back</Text>
        </Pressable>

        <Caption>Complaint tracking</Caption>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title>{complaint.complaint_ref || `#${complaint.complaint_number ?? '—'}`}</Title>
          <StatusBadge status={complaint.status} />
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm, marginBottom: space.lg, flexWrap: 'wrap' }}>
          <PriorityBadge priority={complaint.priority} />
          <Badge label={`Reported ${prettyDate(complaint.created_at)}`} tone="neutral" />
          {complaint.animal_lat != null && (
            <Badge label={`GPS: ${complaint.animal_lat.toFixed(4)}, ${complaint.animal_lng?.toFixed(4)}`} tone="neutral" />
          )}
        </View>

        <Banner message={error} />
        <Banner message={notice} tone="good" />

        {/* Animal Details Card */}
        {bovine && (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontFamily: font.bodyMid, fontSize: size.xs, color: colors.muted }}>AFFECTED ANIMAL</Text>
                <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink, marginTop: 2 }}>
                  {cowLabel(bovine)}
                </Text>
                <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.bark }}>
                  {bovine.pashu_aadhar ? `Pashu Aadhar: ${bovine.pashu_aadhar}` : bovine.species}
                </Text>
              </View>
              <View style={{ minWidth: 100 }}>
                <Button
                  label="View Animal"
                  onPress={() => router.push(`/cow/${bovine.id}`)}
                  variant="secondary"
                />
              </View>
            </View>
          </Card>
        )}

        {/* Complaint Description & Symptoms */}
        <Card>
          <Heading>Issue description</Heading>
          <Text style={{ fontFamily: font.body, fontSize: size.base, color: colors.ink, lineHeight: 22 }}>
            {complaint.description}
          </Text>

          {complaint.symptoms && (
            <View style={{ marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.line }}>
              <Text style={{ fontFamily: font.bodyMid, fontSize: size.xs, color: colors.muted, marginBottom: 2 }}>
                SYMPTOMS
              </Text>
              <Text style={{ fontFamily: font.body, fontSize: size.base, color: colors.bark }}>
                {complaint.symptoms}
              </Text>
            </View>
          )}
        </Card>

        {/* Assigned Officer */}
        <Card>
          <Heading>Field response assignment</Heading>
          {assignedStaff ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.pastureSoft,
                alignItems: 'center', justifyContent: 'center', marginRight: space.md,
              }}>
                <Feather name="user-check" size={18} color={colors.pasture} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.bodySemi, fontSize: size.md, color: colors.ink }}>{assignedStaff.name}</Text>
                <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted }}>
                  {assignedStaff.role === 'doctor' ? 'Veterinary Doctor' : 'Field Inspector'}
                  {assignedStaff.phone ? ` · ${assignedStaff.phone}` : ''}
                </Text>
              </View>
            </View>
          ) : complaint.assigned_to ? (
            <Text style={{ fontFamily: font.body, fontSize: size.base, color: colors.bark }}>
              Assigned to officer ID: {complaint.assigned_to}
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Feather name="alert-circle" size={18} color="#8A5D13" style={{ marginRight: space.sm }} />
              <Text style={{ fontFamily: font.body, fontSize: size.base, color: '#8A5D13' }}>
                No active veterinary officer in direct range. Searching jurisdiction.
              </Text>
            </View>
          )}
        </Card>

        {/* Resolution Notes (if resolved) */}
        {complaint.resolved_notes && (
          <Card style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.xs }}>
              <Feather name="check-circle" size={18} color={colors.pasture} style={{ marginRight: space.xs }} />
              <Heading>Resolution & Treatment</Heading>
            </View>
            <Text style={{ fontFamily: font.body, fontSize: size.base, color: colors.ink, lineHeight: 22 }}>
              {complaint.resolved_notes}
            </Text>
          </Card>
        )}

        {/* Doctor / Inspector Status Workflow Actions */}
        {isDoctorOrInspector && complaint.status !== 'closed' && (
          <Card>
            <Heading>Update treatment status</Heading>
            <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginBottom: space.md }}>
              Strict status progression: Open → Assigned → In Progress → Resolved → Closed
            </Text>

            {complaint.status === 'open' && (
              <Button
                label="Accept Assignment"
                onPress={() => handleStatusChange('assigned')}
                loading={actionBusy}
              />
            )}

            {complaint.status === 'assigned' && (
              <Button
                label="Start Treatment (In Progress)"
                onPress={() => handleStatusChange('in_progress')}
                loading={actionBusy}
              />
            )}

            {complaint.status === 'in_progress' && (
              <View>
                <Field
                  label="Treatment & Resolution Summary (Required)"
                  value={resolutionNotes}
                  onChangeText={setResolutionNotes}
                  placeholder="e.g. Diagnosed early subclinical mastitis in RF quarter. Administered intramammary antibiotics and anti-inflammatory."
                  multiline
                  numberOfLines={3}
                />
                <Button
                  label="Mark as Resolved"
                  onPress={() => handleStatusChange('resolved', resolutionNotes)}
                  loading={actionBusy}
                />
              </View>
            )}

            {complaint.status === 'resolved' && (
              <Button
                label="Close Complaint"
                onPress={() => handleStatusChange('closed')}
                loading={actionBusy}
                variant="secondary"
              />
            )}
          </Card>
        )}

        {/* Authority Reassign Action */}
        {isAuthority && staffList.length > 0 && (
          <Card>
            <Heading>Reassign officer</Heading>
            <Text style={{ fontFamily: font.body, fontSize: size.sm, color: colors.muted, marginBottom: space.md }}>
              Override current auto-assignment with a specific doctor or inspector.
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingBottom: space.md }}>
              {staffList.map((s) => {
                const isSelected = reassignTarget === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setReassignTarget(s.id)}
                    style={{
                      paddingVertical: space.sm,
                      paddingHorizontal: space.md,
                      borderRadius: radius.md,
                      backgroundColor: isSelected ? colors.pasture : colors.surface,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.pasture : colors.line,
                    }}
                  >
                    <Text style={{ fontFamily: font.bodySemi, fontSize: size.sm, color: isSelected ? colors.milk : colors.ink }}>
                      {s.name}
                    </Text>
                    <Text style={{ fontFamily: font.body, fontSize: size.xs, color: isSelected ? '#dcfce7' : colors.muted }}>
                      {s.role}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Button
              label="Confirm Reassignment"
              onPress={handleReassign}
              loading={actionBusy}
              disabled={!reassignTarget || reassignTarget === complaint.assigned_to}
            />
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
