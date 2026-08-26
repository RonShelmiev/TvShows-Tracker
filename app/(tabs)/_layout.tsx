import { Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';

import { Icon, type IconName } from '../../src/components/Icon';
import { colors, type as typeTokens } from '../../src/theme';

const tab = (name: IconName) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={name} size={22} color={String(color)} />;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        sceneStyle: { backgroundColor: colors.bg },
        // No fixed height and no top padding: React Navigation sizes the bar
        // around the bottom safe-area inset, and pushing the content down from
        // here clips the labels off the bottom.
        tabBarStyle: {
          backgroundColor: colors.bgTabBar,
          borderTopColor: colors.borderSoft,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          ...typeTokens.mono,
          fontSize: 10,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Shows', tabBarIcon: tab('tv') }} />
      <Tabs.Screen name="browse" options={{ title: 'Browse', tabBarIcon: tab('compass') }} />
      <Tabs.Screen name="airing" options={{ title: 'Airing', tabBarIcon: tab('calendar') }} />
      <Tabs.Screen name="you" options={{ title: 'You', tabBarIcon: tab('user') }} />
    </Tabs>
  );
}
