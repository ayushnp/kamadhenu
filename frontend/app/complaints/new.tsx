import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Banner, Button, Caption, Card, Field, Heading, Segmented, Title } from '../../src/components/ui';
import CowLoader from '../../src/components/CowLoader';
import { complaints as complaintsApi, cows as cowsApi, ApiError } from '../../src/api';
import type { Cow, ComplaintPriority } from '../../src/api/types';
import { cowLabel, cowSubtitle } from '../../src/lib/format';
import { colors, font, radius, size, space } from '../../src/theme';

export default function NewComplaintScreen() {
  const router = useRouter();
  const { cowId } = useLocalSearchParams<{ cowId?: string }>();

  const [herd, setHerd] = useState<Cow[]>([]);
  const [selectedCowId, setSelectedCowId] = useState<string>(cowId || '');
  const [priority, setPriority] = useState<ComplaintPriority>('medium');
  const [description, setDescription] = useState('');
  const [symptoms, setSymptoms] = useState('');

  const [loadingHerd, setLoadingHerd] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadHerd() {
      try {
        const cows = await cowsApi.myHerd();
        setHerd(cows);
        if (!selectedCowId && cows.length > 0) {
          setSelectedCowId(cows[0].id);
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not fetch your herd.');
      } finally {
        setLoadingHerd(false);
      }
    }
    loadHerd();
  }, [selectedCowId]);

  async function handleSubmit() {
    if (!selectedCowId) {
      return setError('Please select an animal from your herd.');
    }
    if (!description.trim()) {
      return setError('Please describe the problem or condition.');
    }

    setSubmitting(true);
    setError('');

    try {
      const created = await complaintsApi.create({
        bovine_id: selectedCowId,
        description: description.trim(),
        priority,
        symptoms: symptoms.trim() || null,
      });

      // Navigate to the newly created complaint view
      router.replace(`/complaints/${created.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to submit complaint.');
      setSubmitting(false);
    }
  }

  const selectedCow = herd.find((c) => c.id === selectedCowId);

  if (loadingHerd) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: 'center' }}>
        <CowLoader label="Loading animals…" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.surface }}
        contentContainerStyle={{ padding: space.lg, paddingTop: 56, paddingBottom: 48 }}
      >
        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.lg }}>
          <Feather name="arrow-left" size={19} color={colors.bark} />
          <Text style={{ fontFamily: font.bodyMid, fontSize: size.base, color: colors.bark, marginLeft: 6 }}>Back</Text>
        </Pressable>

        <Caption>Veterinary assistance</Caption>
        <Title>Raise health complaint</Title>
        <Text style={{ fontFamily: font.body, fontSize: size.base, color: colors.muted, marginTop: 4, marginBottom: space.xl }}>
          The nearest active Veterinary Doctor or Field Inspector will be automatically dispatched to your animal's location.
        </Text>

        <Banner message={error} />

        {/* Animal Selection */}
        <Heading>Affected animal</Heading>
        {herd.length === 0 ? (
          <Card>
            <Text style={{ fontFamily: font.body, fontSize: size.base, color: colors.bark }}>
              No animals registered yet. You need to add an animal before filing a health complaint.
            </Text>
            <View style={{ marginTop: space.md }}>
              <Button label="Register an animal" onPress={() => router.push('/cow/new')} variant="secondary" />
            </View>
          </Card>
        ) : (
          <View style={{ marginBottom: space.lg }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: 4 }}>
              {herd.map((c) => {
                const isSelected = c.id === selectedCowId;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setSelectedCowId(c.id)}
                    style={{
                      paddingVertical: space.md,
                      paddingHorizontal: space.lg,
                      borderRadius: radius.md,
                      backgroundColor: isSelected ? colors.pasture : colors.milk,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.pasture : colors.line,
                      minWidth: 140,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: font.bodySemi,
                        fontSize: size.md,
                        color: isSelected ? colors.milk : colors.ink,
                      }}
                    >
                      {cowLabel(c)}
                    </Text>
                    <Text
                      style={{
                        fontFamily: font.body,
                        fontSize: size.xs,
                        color: isSelected ? '#dcfce7' : colors.muted,
                        marginTop: 2,
                      }}
                    >
                      {cowSubtitle(c) || c.species}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {selectedCow && (
              <Text style={{ fontFamily: font.bodyMid, fontSize: size.xs, color: colors.pasture, marginTop: 6 }}>
                Selected: {cowLabel(selectedCow)}
                {selectedCow.latitude != null ? ` · GPS locked` : ' · No GPS tag'}
              </Text>
            )}
          </View>
        )}

        {/* Priority Selection */}
        <Heading>Urgency level</Heading>
        <Segmented
          value={priority}
          onChange={setPriority}
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'critical', label: 'Critical' },
          ]}
        />
        <View style={{ height: space.md }} />

        {/* Complaint Details */}
        <Card>
          <Field
            label="What is wrong with the animal?"
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Swollen left hind quarter, refusing to eat feed since morning"
            multiline
            numberOfLines={3}
          />

          <Field
            label="Observed symptoms (optional)"
            value={symptoms}
            onChangeText={setSymptoms}
            placeholder="e.g. High fever, watery eyes, abnormal milk texture"
            multiline
            numberOfLines={2}
          />

          <Button
            label="Submit complaint"
            onPress={handleSubmit}
            loading={submitting}
            disabled={herd.length === 0}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
