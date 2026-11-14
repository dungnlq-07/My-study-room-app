// App.tsx - Root component của ứng dụng

// Bao bọc toàn bộ app trong NavigationContainer và SafeAreaProvider
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { onAuthStateChanged, User } from 'firebase/auth';
import Toast from 'react-native-toast-message';
import AppNavigator from './src/navigation/AppNavigator';
import { AppStateProvider } from './src/context/AppStateContext';
import AuthScreen from './src/screens/AuthScreen';
import { auth } from './src/config/firebase';
import { CreateBooking } from './src/domain/UseCases/CreateBooking';
import { LocalBookingRepositoryImpl } from './src/data/repositories/LocalBookingRepositoryImpl';
import { ScanIdCardUseCase } from './src/domain/UseCases/ScanIdCardUseCase';
import { MlKitOcrRepositoryImpl } from './src/data/repositories/MlKitOcrRepositoryImpl';
import { AppThemeProvider, useAppTheme } from './src/presentation/theme/useAppTheme';

import { updateAllRoomsTimeSlots } from './src/utils/seedTimeSlots';

const bookingRepository = new LocalBookingRepositoryImpl();
const createBookingUseCase = new CreateBooking(bookingRepository);
const scanIdCardUseCase = new ScanIdCardUseCase(new MlKitOcrRepositoryImpl());

export default function App() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <AppContent />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

const AppContent: React.FC = () => {
  const { isDark, colors } = useAppTheme();
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {

    // updateAllRoomsTimeSlots().catch((err) =>
    //   console.error("Lỗi tự động seed timeSlots:", err)
    // );

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setCheckingAuth(false);
    });
    return unsubscribe;
  }, []);


  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {checkingAuth ? (
        <View style={[styles.loading, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : user ? (
        <AppStateProvider
          key={user.uid}
          bookingRepository={bookingRepository}
          createBookingUseCase={createBookingUseCase}
          scanIdCardUseCase={scanIdCardUseCase}
        >
          <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
            <AppNavigator />
          </NavigationContainer>
        </AppStateProvider>
      ) : (
        <AuthScreen />
      )}

      {/* ĐẶT TOAST Ở ĐÂY - DÒNG CUỐI CÙNG TRƯỚC SAFEAREAPROVIDER */}
      <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
});