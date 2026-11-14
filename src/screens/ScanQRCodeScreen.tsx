import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { checkInBooking } from '../services/bookingService';
import { useAppTheme } from '../presentation/theme/useAppTheme';

const ScanQRCodeScreen: React.FC = () => {
  const { colors } = useAppTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const scanLocked = useRef(false);

  const handleBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (scanLocked.current) return;
      scanLocked.current = true;
      setProcessing(true);

      try {
        if (!data.trim()) {
          throw new Error('Mã QR không hợp lệ.');
        }
        await checkInBooking(data.trim());
        setResult('Check-in thành công. Mã đặt phòng đã được sử dụng.');
      } catch (error: unknown) {
        setResult(
          error instanceof Error
            ? error.message
            : 'Không thể check-in. Vui lòng thử lại.',
        );
      } finally {
        setProcessing(false);
      }
    },
    [],
  );

  const scanAgain = () => {
    scanLocked.current = false;
    setResult(null);
    setProcessing(false);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Quét mã QR</Text>
        <Text style={[styles.subtitle, { color: colors.mutedText }]}>
          Quét mã đặt phòng để xác nhận check-in.
        </Text>
      </View>

      {!permission ? (
        <View style={styles.messageContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={[styles.message, { color: colors.mutedText }]}>Đang kiểm tra quyền camera...</Text>
        </View>
      ) : !permission.granted ? (
        <View style={styles.messageContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="camera-outline" size={34} color="#2563EB" />
          </View>
          <Text style={[styles.messageTitle, { color: colors.text }]}>Cần quyền truy cập camera</Text>
          <Text style={[styles.message, { color: colors.mutedText }]}>
            Cho phép camera để quét mã QR trên booking.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              if (permission.canAskAgain) {
                void requestPermission();
              } else {
                void Linking.openSettings();
              }
            }}
          >
            <Text style={styles.primaryButtonText}>
              {permission.canAskAgain ? 'Cho phép camera' : 'Mở cài đặt'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : result ? (
        <View style={styles.messageContainer}>
          <View
            style={[
              styles.iconCircle,
              result.startsWith('Check-in thành công') && styles.successCircle,
            ]}
          >
            <Ionicons
              name={
                result.startsWith('Check-in thành công')
                  ? 'checkmark-circle-outline'
                  : 'alert-circle-outline'
              }
              size={38}
              color={
                result.startsWith('Check-in thành công') ? '#16A34A' : '#DC2626'
              }
            />
          </View>
          <Text style={[styles.messageTitle, { color: colors.text }]}>
            {result.startsWith('Check-in thành công')
              ? 'Đã check-in'
              : 'Không thể check-in'}
          </Text>
          <Text style={[styles.message, { color: colors.mutedText }]}>{result}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={scanAgain}>
            <Text style={styles.primaryButtonText}>Quét mã khác</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.scannerContent}>
          <View style={styles.cameraFrame}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={processing ? undefined : handleBarcodeScanned}
            />
            <View pointerEvents="none" style={styles.scanOverlay}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            {processing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.processingText}>Đang xác nhận...</Text>
              </View>
            )}
          </View>
          <Text style={[styles.scanHint, { color: colors.mutedText }]}>
            Đưa mã QR vào giữa khung hình để quét.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  title: { color: '#111827', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#6B7280', fontSize: 14, marginTop: 6 },
  scannerContent: { flex: 1, alignItems: 'center', paddingHorizontal: 20 },
  cameraFrame: {
    width: '100%',
    maxWidth: 420,
    aspectRatio: 0.82,
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#111827',
  },
  scanOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderColor: '#FFFFFF',
  },
  topLeft: {
    top: '25%',
    left: '12%',
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: '25%',
    right: '12%',
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: '25%',
    left: '12%',
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    right: '12%',
    bottom: '25%',
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderBottomRightRadius: 12,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
  },
  processingText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  scanHint: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 18,
  },
  messageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 38,
    backgroundColor: '#DBEAFE',
    marginBottom: 18,
  },
  successCircle: { backgroundColor: '#DCFCE7' },
  messageTitle: {
    color: '#111827',
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    marginTop: 22,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

export default ScanQRCodeScreen;
