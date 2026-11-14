import type { Booking, BookingStatus } from '../../domain/Entities/Booking';
import type {
  BookingFirestoreDTO,
  BookingLocalDTO,
  BookingSyncState,
} from '../DTOs/BookingLocalDTO';

const isBookingStatus = (value: unknown): value is BookingStatus =>
  value === 'CONFIRMED' ||
  value === 'IN_USE' ||
  value === 'COMPLETED' ||
  value === 'NO_SHOW';

const requireString = (
  value: unknown,
  field: string,
  bookingId: string,
): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Booking "${bookingId}" has invalid ${field}.`);
  }
  return value;
};

export const toBookingEntity = (dto: BookingLocalDTO): Booking => {
  const status = dto.status === 'active' ? 'CONFIRMED' : dto.status;
  if (!isBookingStatus(status)) {
    throw new Error(`Booking "${dto.id}" has invalid status.`);
  }
  if (
    dto.seat_number !== null &&
    (typeof dto.seat_number !== 'number' || !Number.isFinite(dto.seat_number))
  ) {
    throw new Error(`Booking "${dto.id}" has an invalid seat number.`);
  }

  return {
    id: requireString(dto.id, 'id', dto.id),
    roomId: requireString(dto.room_id, 'roomId', dto.id),
    roomName: requireString(dto.room_name, 'roomName', dto.id),
    building: requireString(dto.building, 'building', dto.id),
    date: requireString(dto.date, 'date', dto.id),
    slot: requireString(dto.slot, 'slot', dto.id),
    userId: requireString(dto.user_id, 'userId', dto.id),
    startTime: requireString(dto.start_time, 'startTime', dto.id),
    endTime: requireString(dto.end_time, 'endTime', dto.id),
    status,
    ...(dto.seat_number !== null ? { seatNumber: dto.seat_number } : {}),
  };
};

export const toBookingLocalDTO = (
  booking: Booking,
  syncState: BookingSyncState = 'pending',
): BookingLocalDTO => ({
  id: booking.id,
  room_id: booking.roomId,
  room_name: booking.roomName,
  building: booking.building,
  date: booking.date,
  slot: booking.slot,
  user_id: booking.userId,
  start_time: booking.startTime,
  end_time: booking.endTime,
  status: booking.status,
  seat_number: booking.seatNumber ?? null,
  sync_state: syncState,
  sync_error: null,
});

export const toBookingFirestoreDTO = (
  booking: Booking,
): BookingFirestoreDTO => ({
  roomId: booking.roomId,
  roomName: booking.roomName,
  building: booking.building,
  date: booking.date,
  slot: booking.slot,
  userId: booking.userId,
  startTime: booking.startTime,
  endTime: booking.endTime,
  status: booking.status,
  ...(booking.seatNumber !== undefined
    ? { seatNumber: booking.seatNumber }
    : {}),
});

export const fromBookingFirestoreDTO = (
  id: string,
  dto: Record<string, unknown>,
): Booking => {
  const status = dto.status === 'active' ? 'CONFIRMED' : dto.status;
  if (!isBookingStatus(status)) {
    throw new Error(`Booking "${id}" has invalid status.`);
  }
  const seatNumber = dto.seatNumber;
  if (
    seatNumber !== undefined &&
    (typeof seatNumber !== 'number' || !Number.isFinite(seatNumber))
  ) {
    throw new Error(`Booking "${id}" has an invalid seat number.`);
  }

  return {
    id,
    roomId: requireString(dto.roomId, 'roomId', id),
    roomName: requireString(dto.roomName, 'roomName', id),
    building: requireString(dto.building, 'building', id),
    date: requireString(dto.date, 'date', id),
    slot: requireString(dto.slot, 'slot', id),
    userId: requireString(dto.userId, 'userId', id),
    startTime: requireString(dto.startTime, 'startTime', id),
    endTime: requireString(dto.endTime, 'endTime', id),
    status,
    ...(seatNumber !== undefined ? { seatNumber } : {}),
  };
};
