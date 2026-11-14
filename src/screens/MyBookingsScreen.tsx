import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';

import { Booking, useAppState } from '../context/AppStateContext';
import { Room } from '../types/room';
import BookingListItem from '../components/BookingListItem';
import { useAppTheme } from '../presentation/theme/useAppTheme';

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const formatBookingTime = (booking: Booking) => {
  const formatTime = (value: string) =>
    new Date(value).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  return `${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}`;
};

const MyBookingsScreen: React.FC = () => {
  const {
    rooms,
    bookings,
    cancelBooking,
    extendBooking,
    loading,
    error,
    refreshData,
  } = useAppState();
  const { colors } = useAppTheme();
  const [selectedBookingId, setSelectedBookingId] = React.useState<string | null>(null);
  const [extensionMinutes, setExtensionMinutes] = React.useState('30');
  const [extending, setExtending] = React.useState(false);
  const sortedBookings = [...bookings].sort((a, b) =>
    `${a.date} ${a.slot}`.localeCompare(`${b.date} ${b.slot}`),
  );
  const selectedBooking = bookings.find((item) => item.id === selectedBookingId);
  const handleSelectBooking = useCallback(
    (bookingId: string) => setSelectedBookingId(bookingId),
    [],
  );

  const statusLabel = (status: Booking['status']) => {
    switch (status) {
      case 'CONFIRMED':
        return 'Đã đặt';
      case 'IN_USE':
        return 'Đang sử dụng';
      case 'COMPLETED':
        return 'Đã xong';
      case 'NO_SHOW':
        return 'Đã bị hủy do quá giờ check-in';
    }
  };

  const handleExtend = async () => {
    const minutes = Number(extensionMinutes);
    if (!selectedBooking || !Number.isInteger(minutes) || minutes <= 0) {
      Alert.alert('Thời gian không hợp lệ', 'Vui lòng nhập số phút gia hạn lớn hơn 0.');
      return;
    }
    setExtending(true);
    try {
      await extendBooking(selectedBooking.id, minutes);
      Alert.alert('Gia hạn thành công', `Đã gia hạn thêm ${minutes} phút.`);
    } catch (extendError: unknown) {
      Alert.alert(
        'Không thể gia hạn',
        extendError instanceof Error
          ? extendError.message
          : 'Vui lòng thử lại.',
      );
    } finally {
      setExtending(false);
    }
  };

  const confirmCancel = useCallback(
    (booking: Booking) => {
      const room = rooms.find((item) => item.id === booking.roomId);
      Alert.alert(
        'Cancel booking?',
        `Your booking for ${room?.name ?? 'this room'} will be removed.`,
        [
          { text: 'Keep booking', style: 'cancel' },
          {
            text: 'Cancel booking',
            style: 'destructive',
            onPress: () => {
              void cancelBooking(booking.id).catch((cancelError: unknown) => {
                Alert.alert(
                  'Could not cancel booking',
                  cancelError instanceof Error
                    ? cancelError.message
                    : 'Please try again.',
                );
              });
            },
          },
        ],
      );
    },
    [rooms, cancelBooking],
  );
  const renderBooking = useCallback(
    ({ item }: { item: Booking }) => {
      const room: Room | undefined = rooms.find(
        (entry) => entry.id === item.roomId,
      );
      return (
        <BookingListItem
          booking={item}
          room={room}
          onSelect={handleSelectBooking}
          onCancel={confirmCancel}
        />
      );
    },
    [rooms, handleSelectBooking, confirmCancel],
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>My Bookings</Text>
        <Text style={[styles.subtitle, { color: colors.mutedText }]}>
          {bookings.length} {bookings.length === 1 ? 'reservation' : 'reservations'}
        </Text>
      </View>
      {loading && (
        <View style={styles.statusRow}>
          <ActivityIndicator color="#2563EB" />
          <Text style={styles.statusText}>Loading bookings...</Text>
        </View>
      )}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => void refreshData().catch(() => undefined)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlashList
        data={sortedBookings}
        estimatedItemSize={110}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 24,
          ...(sortedBookings.length === 0 ? { flexGrow: 1 } : {}),
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="calendar-outline" size={30} color="#2563EB" />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {loading
                ? 'Loading bookings'
                : error
                  ? 'Could not load bookings'
                  : 'No bookings yet'}
            </Text>
            {!loading && !error && (
              <Text style={[styles.emptyText, { color: colors.mutedText }]}>
                Browse rooms and reserve an available time slot to see it here.
              </Text>
            )}
          </View>
        }
        renderItem={renderBooking}
      />
      <Modal
        visible={selectedBooking !== undefined}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedBookingId(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSelectedBookingId(null)}
          />
          {selectedBooking && (
            <View style={[styles.detailSheet, { backgroundColor: colors.surface }]}>
              <View style={styles.sheetHandle} />
              <Text style={[styles.detailTitle, { color: colors.text }]}>
                {rooms.find((room) => room.id === selectedBooking.roomId)?.name ??
                  selectedBooking.roomName}
              </Text>
              <Text style={styles.detailSubtitle}>{statusLabel(selectedBooking.status)}</Text>
              <Text style={[styles.detailMeta, { color: colors.mutedText }]}>
                {formatDate(selectedBooking.date)} · {formatBookingTime(selectedBooking)}
              </Text>
              {selectedBooking.status === 'CONFIRMED' && (
                <View style={styles.qrPanel}>
                  <QRCode
                    value={selectedBooking.id}
                    size={210}
                    backgroundColor="#FFFFFF"
                    color="#111827"
                  />
                  <Text style={[styles.qrHint, { color: colors.mutedText }]}>
                    Đưa mã QR này cho máy quét để check-in. Mã chỉ sử dụng được một lần.
                  </Text>
                </View>
              )}
              {selectedBooking.status === 'IN_USE' && (
                <View style={styles.extensionPanel}>
                  <Text style={[styles.extensionTitle, { color: colors.text }]}>Gia hạn thời gian</Text>
                  <Text style={[styles.extensionHint, { color: colors.mutedText }]}>
                    Yêu cầu gia hạn chỉ được duyệt khi khung giờ tiếp theo còn trống.
                  </Text>
                  <View style={styles.extensionRow}>
                    <TextInput
                      style={styles.extensionInput}
                      value={extensionMinutes}
                      onChangeText={setExtensionMinutes}
                      keyboardType="number-pad"
                      accessibilityLabel="Extension duration in minutes"
                    />
                    <Text style={styles.minuteLabel}>phút</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.extendButton, extending && styles.disabledButton]}
                    disabled={extending}
                    onPress={() => void handleExtend()}
                  >
                    <Text style={styles.extendButtonText}>
                      {extending ? 'Đang kiểm tra...' : 'Yêu cầu gia hạn'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {selectedBooking.status === 'NO_SHOW' && (
                <Text style={styles.noShowMessage}>
                  Đã bị hủy do quá giờ check-in. Khung giờ đã được giải phóng.
                </Text>
              )}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setSelectedBookingId(null)}
              >
                <Text style={styles.closeButtonText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 },
  title: { fontSize: 26, fontWeight: '700', color: '#111827' },
  subtitle: { color: '#6B7280', marginTop: 5, fontSize: 14 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyList: { flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { color: '#111827', fontSize: 18, fontWeight: '700' },
  emptyText: { color: '#6B7280', textAlign: 'center', lineHeight: 20, marginTop: 8 },
  separator: { height: 12 },
  bookingCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bookingContent: { flexDirection: 'row', alignItems: 'flex-start', flex: 1 },
  bookingIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    marginRight: 12,
  },
  bookingDetails: { flex: 1 },
  roomName: { fontSize: 16, color: '#111827', fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  statusBadge: { borderRadius: 10, backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 3 },
  inUseBadge: { backgroundColor: '#DCFCE7' },
  inactiveBadge: { backgroundColor: '#F3F4F6' },
  bookingStatusText: { color: '#1D4ED8', fontSize: 10, fontWeight: '700' },
  inUseText: { color: '#15803D' },
  inactiveText: { color: '#6B7280' },
  roomLocation: { color: '#6B7280', fontSize: 13, marginTop: 3, marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  metaText: { color: '#4B5563', fontSize: 13, marginLeft: 6 },
  cancelButton: { padding: 8, marginLeft: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 18, paddingBottom: 10 },
  statusText: { color: '#6B7280', fontSize: 13 },
  errorBox: { marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 10, backgroundColor: '#FEF2F2' },
  errorText: { color: '#B91C1C', fontSize: 13 },
  retryText: { color: '#2563EB', fontWeight: '700', marginTop: 8 },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
  },
  detailSheet: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 30,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 18,
  },
  detailTitle: { color: '#111827', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  detailSubtitle: { color: '#2563EB', fontSize: 14, fontWeight: '700', marginTop: 6 },
  detailMeta: { color: '#6B7280', fontSize: 13, marginTop: 8, marginBottom: 20 },
  qrPanel: {
    alignItems: 'center',
    width: '100%',
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
  },
  qrHint: { color: '#6B7280', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 16 },
  extensionPanel: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
  },
  extensionTitle: { color: '#111827', fontSize: 16, fontWeight: '700' },
  extensionHint: { color: '#6B7280', lineHeight: 19, marginTop: 6 },
  extensionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  extensionInput: {
    width: 110,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    color: '#111827',
    fontSize: 16,
  },
  minuteLabel: { color: '#4B5563', marginLeft: 10 },
  extendButton: {
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#2563EB',
    padding: 13,
    marginTop: 14,
  },
  disabledButton: { opacity: 0.6 },
  extendButtonText: { color: '#FFFFFF', fontWeight: '700' },
  noShowMessage: {
    color: '#B91C1C',
    textAlign: 'center',
    lineHeight: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
  },
  closeButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    padding: 13,
    marginTop: 18,
  },
  closeButtonText: { color: '#374151', fontWeight: '700' },
});

export default MyBookingsScreen;
