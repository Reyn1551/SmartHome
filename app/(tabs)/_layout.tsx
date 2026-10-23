import React, { useCallback } from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { useRouter } from 'expo-router';
import { FloatingNavBar, FLOATING_NAV_ITEMS } from '@/components/FloatingNavBar';

/**
 * Tab bar kustom di bagian bawah. Layar menyisakan ruang sendiri sebesar
 * FLOATING_NAV_HEIGHT, jadi bilah ini dirender absolut.
 */
export default function TabsLayout() {
  const router = useRouter();

  const renderTabBar = useCallback(
    (props: { state: { index: number; routes: { name: string; key: string }[] } }) => {
      const active = props.state.routes[props.state.index];
      return (
        <FloatingNavBar
          activeName={active?.name ?? 'index'}
          onNavigate={(name) => {
            router.navigate(`/${name === 'index' ? '' : name}` as never);
          }}
        />
      );
    },
    [router]
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
        animation: 'shift',
        // Layar yang tidak terlihat berhenti merender; grafik dan timer
        // tidak memakai CPU saat tab lain aktif.
        freezeOnBlur: true,
        // Bilah navigasi digambar sendiri; hilangkan seluruh latar dan garis
        // bawaan navigator agar tidak ada pita atau garis di bawah layar.
        tabBarStyle: {
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
      tabBar={renderTabBar}
    >
      {FLOATING_NAV_ITEMS.map((item) => (
        <Tabs.Screen key={item.name} name={item.name} options={{ title: item.label }} />
      ))}
    </Tabs>
  );
}
