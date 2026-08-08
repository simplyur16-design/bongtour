import { Stack } from 'expo-router';

import { LOGIN_1B } from '@/src/constants/login-design';

export default function SignInLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: LOGIN_1B.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="email" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
