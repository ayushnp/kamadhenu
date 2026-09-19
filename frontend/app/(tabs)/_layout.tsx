import React from 'react';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from '../../src/i18n';
import { colors, font, size } from '../../src/theme';

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.pasture,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: font.bodyMid, fontSize: size.xs },
        tabBarStyle: { backgroundColor: colors.milk, borderTopColor: colors.line, height: 62, paddingBottom: 8, paddingTop: 6 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.home'), tabBarIcon: ({ color, size: s }) => <Feather name="home" size={s} color={color} /> }}
      />
      <Tabs.Screen
        name="complaints"
        options={{ title: t('tabs.complaints'), tabBarIcon: ({ color, size: s }) => <Feather name="alert-circle" size={s} color={color} /> }}
      />
      <Tabs.Screen
        name="lookup"
        options={{ title: t('tabs.lookup'), tabBarIcon: ({ color, size: s }) => <Feather name="search" size={s} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: ({ color, size: s }) => <Feather name="user" size={s} color={color} /> }}
      />
    </Tabs>
  );
}
