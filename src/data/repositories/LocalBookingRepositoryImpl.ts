import NetInfo from '@react-native-community/netinfo';
import {
  collection,
  doc,
  getDocs,
  increment,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import {
  openDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';

import type { Booking } from '../../domain/Entities/Booking';
import type {
  BookingRepository,
  CreateBookingInput,
} from '../../domain/Repositories/BookingRepository';
import type { BookingLocalDTO } from '../DTOs/BookingLocalDTO';
import {
  fromBookingFirestoreDTO,
  toBookingEntity,
  toBookingFirestoreDTO,
  toBookingLocalDTO,
} from '../Mappers/BookingMapper';
import { auth, db } from '../../config/firebase';

const DATABASE_NAME = 'study-room-booking.db';
const BOOKINGS_COLLECTION = 'bookings';
const ROOMS_COLLECTION = 'rooms';
const CHECK_IN_GRACE_MS = 15 * 60 * 1000;

let databasePromise: Promise<SQLiteDatabase> | undefined;

const getDatabase = (): Promise<SQLiteDatabase> => {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DATABASE_NAME).then(
      async (database) => {
        try {
          await database.execAsync(`
            CREATE TABLE IF NOT EXISTS bookings (
              id TEXT PRIMARY KEY NOT NULL,
              room_id TEXT NOT NULL,
              room_name TEXT NOT NULL,
              building TEXT NOT NULL,
              date TEXT NOT NULL,
              slot TEXT NOT NULL,
              user_id TEXT NOT NULL,
              start_time TEXT NOT NULL,
              end_time TEXT NOT NULL,
              status TEXT NOT NULL,
              seat_number INTEGER,
              sync_state TEXT NOT NULL CHECK (sync_state IN ('pending', 'synced')),
              sync_error TEXT
            );
            CREATE INDEX IF NOT EXISTS bookings_user_date_idx
              ON bookings (user_id, date);
            CREATE INDEX IF NOT EXISTS bookings_sync_state_idx
              ON bookings (sync_state);
          `);
          return database;
        } catch (error: unknown) {
          await database.closeAsync();
          databasePromise = undefined;
          throw error;
        }
      },
    ).catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
};

const isOnline = async (): Promise<boolean> => {
  const network = await NetInfo.fetch();
  return network.isConnected === true && network.isInternetReachable !== false;
};

const getBookingTimeRange = (
  date: string,
  slot: string,
): { startTime: string; endTime: string } => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Booking date must use YYYY-MM-DD format.');
  }
  const parsedDate = Date.parse(`${date}T00:00:00.000Z`);
  if (
    Number.isNaN(parsedDate) ||
    new Date(parsedDate).toISOString().slice(0, 10) !== date
  ) {
    throw new Error('Booking date is invalid.');
  }
  const match = slot.match(/^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/);
  if (!match) {
    throw new Error(`Invalid booking time slot "${slot}".`);
  }

  const [, startHourText, startMinuteText, endHourText, endMinuteText] = match;
  const startHour = Number(startHourText);
  const startMinute = Number(startMinuteText);
  const endHour = Number(endHourText);
  const endMinute = Number(endMinuteText);
  if (
    startHour > 23 ||
    endHour > 23 ||
    startMinute > 59 ||
    endMinute > 59
  ) {
    throw new Error(`Invalid booking time slot "${slot}".`);
  }

  const toIsoString = (hour: number, minute: number): string =>
    new Date(
      `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+07:00`,
    ).toISOString();
  const startTime = toIsoString(startHour, startMinute);
  const endTime = toIsoString(endHour, endMinute);
  if (Date.parse(endTime) <= Date.parse(startTime)) {
    throw new Error(`Invalid booking time range for "${date}" and "${slot}".`);
  }
  return { startTime, endTime };
};

const isBookingOccupyingSlot = (
  booking: Record<string, unknown>,
  now: number,
): boolean => {
  if (booking.status === 'NO_SHOW' || booking.status === 'COMPLETED') {
    return false;
  }
  const { startTime, endTime } = getBookingTimeRange(
    String(booking.date),
    String(booking.slot),
  );
  const end = Date.parse(
    typeof booking.endTime === 'string' ? booking.endTime : endTime,
  );
  const start = Date.parse(
    typeof booking.startTime === 'string' ? booking.startTime : startTime,
  );
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error('A Firestore booking has an invalid time range.');
  }
  if (booking.status === 'CONFIRMED' || booking.status === 'active') {
    return now <= Math.min(end, start + CHECK_IN_GRACE_MS);
  }
  return now <= end;
};

const valuesForLocalWrite = (booking: BookingLocalDTO) => [
  booking.id,
  booking.room_id,
  booking.room_name,
  booking.building,
  booking.date,
  booking.slot,
  booking.user_id,
  booking.start_time,
  booking.end_time,
  booking.status,
  booking.seat_number,
];

export class LocalBookingRepositoryImpl implements BookingRepository {
  private syncInFlight: Promise<void> | undefined;
  private readonly unsubscribeNetwork: () => void;

  constructor() {
    this.unsubscribeNetwork = NetInfo.addEventListener((network) => {
      if (
        network.isConnected === true &&
        network.isInternetReachable !== false
      ) {
        void this.syncPendingBookings().catch((error: unknown) => {
          console.error('Could not sync local bookings to Firestore:', error);
        });
      }
    });
  }

  dispose(): void {
    this.unsubscribeNetwork();
  }

  async create(input: CreateBookingInput): Promise<Booking> {
    if (!auth.currentUser || auth.currentUser.uid !== input.userId) {
      throw new Error('You must be signed in as the booking owner.');
    }
    const { startTime, endTime } = getBookingTimeRange(input.date, input.slot);
    if (Date.parse(endTime) <= Date.now()) {
      throw new Error('Booking time slot has already ended.');
    }
    const booking: Booking = {
      id: doc(collection(db, BOOKINGS_COLLECTION)).id,
      roomId: input.room.id,
      roomName: input.room.name,
      building: input.room.building,
      date: input.date,
      slot: input.slot,
      userId: input.userId,
      startTime,
      endTime,
      status: 'CONFIRMED',
    };
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO bookings (
        id, room_id, room_name, building, date, slot, user_id,
        start_time, end_time, status, seat_number, sync_state, sync_error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL)`,
      ...valuesForLocalWrite(toBookingLocalDTO(booking)),
    );

    if (await isOnline()) {
      try {
        await this.syncPendingBookings();
      } catch (error: unknown) {
        console.error(
          `Booking "${booking.id}" is stored locally and will retry synchronization:`,
          error,
        );
      }
    }
    return booking;
  }

  async findByUserId(userId: string): Promise<Booking[]> {
    if (!userId.trim()) {
      throw new Error('A user id is required to load bookings.');
    }
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
      throw new Error('You can only load bookings for the signed-in user.');
    }
    const database = await getDatabase();
    if (await isOnline()) {
      try {
        await this.pullRemoteBookings(userId, database);
      } catch (error: unknown) {
        console.error(
          'Could not refresh local bookings from Firestore; returning SQLite data:',
          error,
        );
      }
      try {
        await this.syncPendingBookings();
      } catch (error: unknown) {
        console.error(
          'Could not synchronize pending bookings; returning SQLite data:',
          error,
        );
      }
    }
    const rows = await database.getAllAsync<BookingLocalDTO>(
      `SELECT id, room_id, room_name, building, date, slot, user_id,
        start_time, end_time, status, seat_number, sync_state, sync_error
       FROM bookings WHERE user_id = ? ORDER BY date DESC, start_time DESC`,
      userId,
    );
    return rows.map(toBookingEntity);
  }

  async syncPendingBookings(): Promise<void> {
    if (this.syncInFlight) return this.syncInFlight;
    this.syncInFlight = this.performPendingSync().finally(() => {
      this.syncInFlight = undefined;
    });
    return this.syncInFlight;
  }

  private async performPendingSync(): Promise<void> {
    if (!(await isOnline())) return;
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const database = await getDatabase();
    const pendingBookings = await database.getAllAsync<BookingLocalDTO>(
      `SELECT id, room_id, room_name, building, date, slot, user_id,
        start_time, end_time, status, seat_number, sync_state, sync_error
       FROM bookings
       WHERE sync_state = 'pending' AND user_id = ?
       ORDER BY date, start_time`,
      userId,
    );

    for (const dto of pendingBookings) {
      const booking = toBookingEntity(dto);
      try {
        await this.syncBooking(booking);
        await database.runAsync(
          `UPDATE bookings SET sync_state = 'synced', sync_error = NULL
           WHERE id = ?`,
          booking.id,
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown Firestore error.';
        await database.runAsync(
          'UPDATE bookings SET sync_error = ? WHERE id = ?',
          message,
          booking.id,
        );
        throw error;
      }
    }
  }

  private async syncBooking(booking: Booking): Promise<void> {
    const bookingRef = doc(db, BOOKINGS_COLLECTION, booking.id);
    const roomRef = doc(db, ROOMS_COLLECTION, booking.roomId);
    const roomBookingsQuery = query(
      collection(db, BOOKINGS_COLLECTION),
      where('roomId', '==', booking.roomId),
      where('date', '==', booking.date),
    );

    await runTransaction(db, async (transaction) => {
      const [roomSnapshot, existingBookingSnapshot] = await Promise.all([
        transaction.get(roomRef),
        transaction.get(bookingRef),
      ]);
      if (existingBookingSnapshot.exists()) {
        const existing = existingBookingSnapshot.data();
        if (existing.userId === booking.userId) return;
        throw new Error(`Booking id "${booking.id}" is already in use.`);
      }
      if (!roomSnapshot.exists()) {
        throw new Error(`Room "${booking.roomId}" no longer exists.`);
      }
      const roomCapacity = roomSnapshot.data().capacity;
      if (
        typeof roomCapacity !== 'number' ||
        !Number.isFinite(roomCapacity) ||
        roomCapacity < 1
      ) {
        throw new Error(`Room "${booking.roomId}" has invalid capacity.`);
      }

      const snapshot = await getDocs(roomBookingsQuery);
      const now = Date.now();
      const requestedStart = Date.parse(booking.startTime);
      const requestedEnd = Date.parse(booking.endTime);
      const activeBookings = snapshot.docs.filter((bookingDoc) => {
        const current = bookingDoc.data();
        if (!isBookingOccupyingSlot(current, now)) return false;
        const currentRange = getBookingTimeRange(
          String(current.date),
          String(current.slot),
        );
        const currentStart = Date.parse(
          typeof current.startTime === 'string'
            ? current.startTime
            : currentRange.startTime,
        );
        const currentEnd = Date.parse(
          typeof current.endTime === 'string'
            ? current.endTime
            : currentRange.endTime,
        );
        return currentStart < requestedEnd && currentEnd > requestedStart;
      });

      if (
        activeBookings.some(
          (bookingDoc) => bookingDoc.data().userId === booking.userId,
        )
      ) {
        throw new Error('The user already has a booking for this room and time.');
      }
      if (activeBookings.length >= roomCapacity) {
        throw new Error(
          `Room "${booking.roomId}" is at capacity (${activeBookings.length}/${roomCapacity}).`,
        );
      }

      const start = Date.parse(booking.startTime);
      const end = Date.parse(booking.endTime);
      transaction.set(bookingRef, {
        ...toBookingFirestoreDTO(booking),
        startAt: Timestamp.fromMillis(start),
        endAt: Timestamp.fromMillis(end),
        createdAt: serverTimestamp(),
        checkInStartsAt: Timestamp.fromMillis(start - CHECK_IN_GRACE_MS),
        checkInEndsAt: Timestamp.fromMillis(
          Math.min(end, start + CHECK_IN_GRACE_MS),
        ),
      });
      transaction.update(roomRef, { bookingRevision: increment(1) });
    });
  }

  private async pullRemoteBookings(
    userId: string,
    database: SQLiteDatabase,
  ): Promise<void> {
    const remoteBookings = await getDocs(
      query(
        collection(db, BOOKINGS_COLLECTION),
        where('userId', '==', userId),
      ),
    );
    const remoteIds: string[] = [];
    for (const snapshot of remoteBookings.docs) {
      const booking = fromBookingFirestoreDTO(snapshot.id, snapshot.data());
      remoteIds.push(booking.id);
      await database.runAsync(
        `INSERT INTO bookings (
          id, room_id, room_name, building, date, slot, user_id,
          start_time, end_time, status, seat_number, sync_state, sync_error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', NULL)
        ON CONFLICT(id) DO UPDATE SET
          room_id = excluded.room_id,
          room_name = excluded.room_name,
          building = excluded.building,
          date = excluded.date,
          slot = excluded.slot,
          user_id = excluded.user_id,
          start_time = excluded.start_time,
          end_time = excluded.end_time,
          status = excluded.status,
          seat_number = excluded.seat_number,
          sync_state = 'synced',
          sync_error = NULL`,
        ...valuesForLocalWrite(toBookingLocalDTO(booking, 'synced')),
      );
    }

    if (remoteIds.length === 0) {
      await database.runAsync(
        `DELETE FROM bookings WHERE user_id = ? AND sync_state = 'synced'`,
        userId,
      );
      return;
    }
    const placeholders = remoteIds.map(() => '?').join(', ');
    await database.runAsync(
      `DELETE FROM bookings
       WHERE user_id = ? AND sync_state = 'synced'
         AND id NOT IN (${placeholders})`,
      userId,
      ...remoteIds,
    );
  }
}
