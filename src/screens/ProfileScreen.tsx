import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut, updateProfile as updateFirebaseProfile } from 'firebase/auth';

import { useAppState, UserProfile } from '../context/AppStateContext';
import { auth } from '../config/firebase';
import {
  ThemeMode,
  useAppTheme,
} from '../presentation/theme/useAppTheme';

const ProfileScreen: React.FC = () => {
  const { colors, themeMode, setThemeMode } = useAppTheme();
  const { profile, updateProfile, scanIdCardUseCase } = useAppState();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (editing) setDraft(profile);
  }, [editing, profile]);

  const saveProfile = () => {
    const name = draft.name.trim();
    const phone = draft.phone.trim();
    if (!name) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Could not update profile', 'Please sign in again and try once more.');
      return;
    }

    void updateFirebaseProfile(currentUser, { displayName: name })
      .then(() => {
        updateProfile({
          ...draft,
          name,
          email: currentUser.email ?? '',
          phone,
          idNumber: draft.idNumber.trim(),
          dateOfBirth: draft.dateOfBirth.trim(),
          major: draft.major.trim(),
          subInfo: draft.subInfo.trim(),
        });
        setEditing(false);
      })
      .catch(() => {
        Alert.alert('Could not update profile', 'Please check your connection and try again.');
      });
  };

  const scanIdCard = async (source: 'camera' | 'library') => {
    setScanning(true);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Camera permission required',
            'Allow camera access to take a photo of your ID card.',
          );
          return;
        }
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 1,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 1,
            });
      if (result.canceled || !result.assets[0]) return;

      const info = await scanIdCardUseCase.execute(result.assets[0].uri);
      setDraft((current) => ({
        ...current,
        name: info.fullName || current.name,
        idNumber: info.idNumber || current.idNumber,
        dateOfBirth: info.dateOfBirth || current.dateOfBirth,
        major: info.major || current.major,
        subInfo: info.subInfo || current.subInfo,
      }));
      Alert.alert(
        'Scan complete',
        'Review the detected details and correct anything that needs editing before saving.',
      );
    } catch (scanError: unknown) {
      Alert.alert(
        'Could not scan ID',
        scanError instanceof Error
          ? scanError.message
          : 'Please try another image or enter the details manually.',
      );
    } finally {
      setScanning(false);
    }
  };

  const chooseIdCardImage = () => {
    if (Platform.OS === 'web') {
      void scanIdCard('library');
      return;
    }
    Alert.alert('Scan ID card', 'Choose how to provide the card image.', [
      { text: 'Take a photo', onPress: () => void scanIdCard('camera') },
      { text: 'Choose from photos', onPress: () => void scanIdCard('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSignOut = () => {
    void signOut(auth).catch(() => {
      Alert.alert('Could not sign out', 'Please try again.');
    });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Profile</Text>
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={38} color="#2563EB" />
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{auth.currentUser?.displayName || profile.name}</Text>
          <Text style={[styles.email, { color: colors.mutedText }]}>{auth.currentUser?.email || profile.email}</Text>
          <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}>
            <Ionicons name="create-outline" size={17} color="#FFFFFF" />
            <Text style={styles.editButtonText}>Edit profile</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Appearance
        </Text>
        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.themeOptions}>
            {(
              [
                ['system', 'Theo thiết bị', 'phone-portrait-outline'],
                ['light', 'Sáng', 'sunny-outline'],
                ['dark', 'Tối', 'moon-outline'],
              ] as [ThemeMode, string, keyof typeof Ionicons.glyphMap][]
            ).map(([mode, label, icon]) => {
              const selected = themeMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.themeOption,
                    selected && {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setThemeMode(mode)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                >
                  <Ionicons
                    name={icon}
                    size={19}
                    color={selected ? colors.primary : colors.mutedText}
                  />
                  <Text
                    style={[
                      styles.themeOptionText,
                      { color: selected ? colors.text : colors.secondaryText },
                    ]}
                  >
                    {label}
                  </Text>
                  {selected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact information</Text>
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ProfileRow
            icon="mail-outline"
            label="Email"
            value={auth.currentUser?.email || profile.email}
          />
          <View style={styles.divider} />
          <ProfileRow
            icon="call-outline"
            label="Phone"
            value={profile.phone || 'Not provided'}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Identity information</Text>
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ProfileRow
            icon="card-outline"
            label="Student / ID number"
            value={profile.idNumber || 'Not provided'}
          />
          <View style={styles.divider} />
          <ProfileRow
            icon="calendar-outline"
            label="Date of birth"
            value={profile.dateOfBirth || 'Not provided'}
          />
          <View style={styles.divider} />
          <ProfileRow
            icon="school-outline"
            label="Faculty / Major"
            value={profile.major || 'Not provided'}
          />
          {profile.subInfo ? (
            <>
              <View style={styles.divider} />
              <ProfileRow icon="reader-outline" label="Additional information" value={profile.subInfo} />
            </>
          ) : null}
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={19} color="#DC2626" />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={19} color="#2563EB" />
          <Text style={[styles.noticeText, { color: colors.mutedText }]}>
            Your account is managed by Firebase. Phone number is stored for this app session only.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={editing}
        transparent
        animationType="slide"
        onRequestClose={() => setEditing(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditing(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Edit profile</Text>
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>Full name</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.input }]}
                value={draft.name}
                onChangeText={(name) => setDraft((current) => ({ ...current, name }))}
                placeholder="Your name"
                autoCapitalize="words"
              />
              <TouchableOpacity
                style={[styles.scanButton, scanning && styles.disabledButton]}
                onPress={chooseIdCardImage}
                disabled={scanning}
                accessibilityRole="button"
              >
                {scanning ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="scan-outline" size={19} color="#FFFFFF" />
                )}
                <Text style={styles.scanButtonText}>
                  {scanning ? 'Scanning card…' : 'Quét CCCD / Thẻ sinh viên'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.scanHint}>
                Scanning runs on-device in an installed native build. Check the detected information before saving.
              </Text>
              <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>Student / ID number</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.input }]}
                value={draft.idNumber}
                onChangeText={(idNumber) => setDraft((current) => ({ ...current, idNumber }))}
                placeholder="ID or student number"
                autoCapitalize="characters"
              />
              <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>Date of birth</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.input }]}
                value={draft.dateOfBirth}
                onChangeText={(dateOfBirth) => setDraft((current) => ({ ...current, dateOfBirth }))}
                placeholder="DD/MM/YYYY"
              />
              <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>Faculty / Major</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.input }]}
                value={draft.major}
                onChangeText={(major) => setDraft((current) => ({ ...current, major }))}
                placeholder="Faculty or major"
              />
              <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>Additional information (optional)</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.input }]}
                value={draft.subInfo}
                onChangeText={(subInfo) => setDraft((current) => ({ ...current, subInfo }))}
                placeholder="Class or other information"
              />
              <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>Phone (optional)</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.input }]}
                value={draft.phone}
                onChangeText={(phone) => setDraft((current) => ({ ...current, phone }))}
                placeholder="Phone number"
                keyboardType="phone-pad"
              />
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setEditing(false)}
                  disabled={scanning}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, scanning && styles.disabledButton]}
                  onPress={saveProfile}
                  disabled={scanning}
                >
                  <Text style={styles.saveText}>Save changes</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

interface ProfileRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

const ProfileRow: React.FC<ProfileRowProps> = ({ icon, label, value }) => {
  const { colors } = useAppTheme();
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={19} color="#2563EB" />
      </View>
      <View style={styles.infoTextWrap}>
        <Text style={[styles.infoLabel, { color: colors.mutedText }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.secondaryText }]}>{value}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 20, paddingBottom: 30 },
  pageTitle: { fontSize: 26, fontWeight: '700', color: '#111827', marginBottom: 20 },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DBEAFE',
    marginBottom: 14,
  },
  name: { fontSize: 20, fontWeight: '700', color: '#111827' },
  email: { fontSize: 14, color: '#6B7280', marginTop: 5 },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 18,
  },
  editButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginLeft: 7 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 24, marginBottom: 10 },
  infoCard: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 15, borderWidth: 1, borderColor: '#E5E7EB' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  infoIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#EFF6FF',
    marginRight: 12,
  },
  infoTextWrap: { flex: 1 },
  infoLabel: { fontSize: 12, color: '#9CA3AF' },
  infoValue: { fontSize: 14, color: '#374151', fontWeight: '600', marginTop: 3 },
  themeOptions: { gap: 8, padding: 10 },
  themeOption: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  themeOptionText: { flex: 1, fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#F3F4F6' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 18, gap: 8 },
  noticeText: { flex: 1, color: '#6B7280', fontSize: 13, lineHeight: 18 },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 22,
  },
  signOutText: { color: '#DC2626', fontWeight: '700', fontSize: 14 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' },
  sheet: { maxHeight: '90%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30 },
  formScroll: { flexShrink: 1 },
  formContent: { paddingBottom: 8 },
  sheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', marginBottom: 18 },
  sheetTitle: { fontSize: 21, fontWeight: '700', color: '#111827', marginBottom: 18 },
  fieldLabel: { color: '#374151', fontSize: 13, fontWeight: '600', marginBottom: 7 },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#111827',
    marginBottom: 15,
    fontSize: 15,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  scanButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    backgroundColor: '#2563EB',
  },
  scanButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  scanHint: { color: '#6B7280', fontSize: 12, lineHeight: 17, marginBottom: 15 },
  disabledButton: { opacity: 0.6 },
  cancelButton: { paddingHorizontal: 14, paddingVertical: 13 },
  cancelText: { color: '#4B5563', fontWeight: '700' },
  saveButton: { flex: 1, alignItems: 'center', borderRadius: 11, paddingVertical: 14, backgroundColor: '#2563EB' },
  saveText: { color: '#FFFFFF', fontWeight: '700' },
});

export default ProfileScreen;
