import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Booking } from '../domain/Entities/Booking';
import type { Room } from '../types/room';
import { useAppTheme } from '../presentation/theme/useAppTheme';

interface BookingListItemProps {
  booking: Booking;
  room?: Room;
  onSelect: (bookingId: string) => void;
  onCancel: (booking: Booking) => void;
}

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

const BookingListItem: React.FC<BookingListItemProps> = React.memo(
  ({ booking, room, onSelect, onCancel }) => {
    const { colors } = useAppTheme();
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={styles.content}
          onPress={() => onSelect(booking.id)}
          accessibilityRole="button"
          accessibilityLabel={`View booking details for ${room?.name ?? booking.roomName}`}
        >
          <View style={styles.icon}>
            <Ionicons name="business-outline" size={22} color="#2563EB" />
          </View>
          <View style={styles.details}>
            <View style={styles.titleRow}>
              <Text style={[styles.roomName, { color: colors.text }]}>
                {room?.name ?? booking.roomName}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  booking.status === 'IN_USE' && styles.inUseBadge,
                  (booking.status === 'NO_SHOW' || booking.status === 'COMPLETED') &&
                    styles.inactiveBadge,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    booking.status === 'IN_USE' && styles.inUseText,
                    (booking.status === 'NO_SHOW' || booking.status === 'COMPLETED') &&
                      styles.inactiveText,
                  ]}
                >
                  {statusLabel(booking.status)}
                </Text>
              </View>
            </View>
            <Text style={[styles.location, { color: colors.mutedText }]}>
              {room?.building ?? booking.building}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.mutedText} />
              <Text style={[styles.metaText, { color: colors.secondaryText }]}>
                {formatDate(booking.date)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={14} color={colors.mutedText} />
              <Text style={[styles.metaText, { color: colors.secondaryText }]}>
                {formatBookingTime(booking)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        {booking.status === 'CONFIRMED' && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => onCancel(booking)}
            accessibilityLabel={`Cancel booking for ${room?.name ?? booking.roomName}`}
          >
            <Ionicons name="trash-outline" size={18} color="#DC2626" />
          </TouchableOpacity>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  content: { flexDirection: 'row', alignItems: 'flex-start', flex: 1 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    marginRight: 12,
  },
  details: { flex: 1 },
  roomName: { fontSize: 16, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  statusBadge: {
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  inUseBadge: { backgroundColor: '#DCFCE7' },
  inactiveBadge: { backgroundColor: '#F3F4F6' },
  statusText: { color: '#1D4ED8', fontSize: 10, fontWeight: '700' },
  inUseText: { color: '#15803D' },
  inactiveText: { color: '#6B7280' },
  location: { fontSize: 13, marginTop: 3, marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  metaText: { fontSize: 13, marginLeft: 6 },
  cancelButton: { padding: 8, marginLeft: 4 },
});

export default BookingListItem;
