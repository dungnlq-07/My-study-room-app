// src/navigation/AppNavigator.tsx
// Bottom Tab Navigator: Browse Rooms, My Bookings, Scan QR, Profile.

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../presentation/theme/useAppTheme';

import BrowseRoomsScreen from '../screens/BrowseRoomsScreen';
import MyBookingsScreen from '../screens/MyBookingsScreen';
import ScanQRCodeScreen from '../screens/ScanQRCodeScreen';
import ProfileScreen from '../screens/ProfileScreen';

// Định nghĩa danh sách route và tham số của từng route (Type-safe)
export type RootTabParamList = {
  BrowseRooms: undefined;
  MyBookings: undefined;
  ScanQR: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const AppNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // Cấu hình icon cho từng tab dựa trên tên route
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'BrowseRooms':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'MyBookings':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'ScanQR':
              iconName = focused ? 'camera' : 'camera-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'ellipse-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#8B93A1',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: -2 },
        tabBarStyle: {
          height: 58 + insets.bottom,
          paddingTop: 5,
          paddingBottom: Math.max(insets.bottom, 5),
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 8,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="BrowseRooms"
        component={BrowseRoomsScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="MyBookings"
        component={MyBookingsScreen}
        options={{ tabBarLabel: 'My Bookings' }}
      />
      <Tab.Screen
        name="ScanQR"
        component={ScanQRCodeScreen}
        options={{ tabBarLabel: 'Scan QR' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

export default AppNavigator;