import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, Platform } from 'react-native';
import 'react-native-reanimated';

// Polyfill Alert.alert for React Native Web
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title: string, message?: string, buttons?: any[]) => {
    const text = message ? `${title}\n\n${message}` : title;
    if (!buttons || buttons.length === 0) {
      window.alert(text);
    } else if (buttons.length === 1) {
      window.alert(text);
      buttons[0]?.onPress?.();
    } else {
      const confirmed = window.confirm(text);
      if (confirmed) {
        const actionBtn = buttons.find((b: any) => b.style !== 'cancel') || buttons[buttons.length - 1];
        actionBtn?.onPress?.();
      } else {
        const cancelBtn = buttons.find((b: any) => b.style === 'cancel');
        cancelBtn?.onPress?.();
      }
    }
  };
}

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
