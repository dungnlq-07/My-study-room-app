import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { auth } from '../config/firebase';
import {
  cancelBooking as cancelFirestoreBooking,
  DEFAULT_BOOKING_SLOT,
  getBookingEndTime,
  getDateKey,
  extendBooking as extendFirestoreBooking,
  subscribeToBookings,
} from '../services/bookingService';
import {
  addRoom as addFirestoreRoom,
  deleteRoom as deleteFirestoreRoom,
  getRooms,
  seedRoomsIfEmpty,
  updateRoom as updateFirestoreRoom,
} from '../services/roomService';
import { reconcileBookingReminders } from '../services/notificationService';
import { Room } from '../types/room';
import type {
  Booking as DomainBooking,
  BookingStatus as DomainBookingStatus,
} from '../domain/Entities/Booking';
import type { BookingRepository } from '../domain/Repositories/BookingRepository';
import type { CreateBooking } from '../domain/UseCases/CreateBooking';
import type { ScanIdCardUseCase } from '../domain/UseCases/ScanIdCardUseCase';

export type Booking = DomainBooking;
export type BookingStatus = DomainBookingStatus;

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  idNumber: string;
  dateOfBirth: string;
  major: string;
  subInfo: string;
}

interface AppStateContextValue {
  rooms: Room[];
  bookings: Booking[];
  profile: UserProfile;
  loading: boolean;
  availabilityLoading: boolean;
  error: string | null;
  availabilityDate: string;
  availabilitySlot: string;
  scanIdCardUseCase: ScanIdCardUseCase;
  refreshData: (date?: string, slot?: string) => Promise<void>;
  refreshRooms: (date: string, slot: string) => Promise<void>;
  addRoom: (room: Omit<Room, 'id'>) => Promise<Room>;
  updateRoom: (roomId: string, changes: Partial<Omit<Room, 'id'>>) => Promise<void>;
  deleteRoom: (roomId: string) => Promise<void>;
  createBooking: (room: Room, date: string, slot: string) => Promise<boolean>;
  cancelBooking: (bookingId: string) => Promise<void>;
  extendBooking: (bookingId: string, minutes: number) => Promise<void>;
  updateProfile: (profile: UserProfile) => void;
}

interface AppStateProviderProps {
  children: React.ReactNode;
  bookingRepository: BookingRepository;
  createBookingUseCase: CreateBooking;
  scanIdCardUseCase: ScanIdCardUseCase;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

const getSignedInUserId = (): string => {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('You must be signed in to manage bookings.');
  return userId;
};

export const AppStateProvider: React.FC<AppStateProviderProps> = ({
  children,
  bookingRepository,
  createBookingUseCase,
  scanIdCardUseCase,
}) => {
  const currentUser = auth.currentUser;
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profile, setProfile] = useState<UserProfile>({
    name: currentUser?.displayName ?? 'Study Room User',
    email: currentUser?.email ?? '',
    phone: '',
    idNumber: '',
    dateOfBirth: '',
    major: '',
    subInfo: '',
  });
  const [loading, setLoading] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availabilityDate, setAvailabilityDate] = useState(getDateKey());
  const [availabilitySlot, setAvailabilitySlot] = useState(DEFAULT_BOOKING_SLOT);
  const availabilityRequest = useRef(0);

  const refreshRooms = useCallback(async (date: string, slot: string) => {
    const requestId = ++availabilityRequest.current;
    setAvailabilityLoading(true);
    setError(null);
    try {
      const loadedRooms = await getRooms(date, slot);
      if (requestId !== availabilityRequest.current) return;
      setRooms(loadedRooms);
      setAvailabilityDate(date);
      setAvailabilitySlot(slot);
    } catch (loadError: unknown) {
      if (requestId !== availabilityRequest.current) return;
      const message =
        loadError instanceof Error
          ? loadError.message
          : 'Could not load room availability from Firestore.';
      setError(message);
      throw loadError;
    } finally {
      if (requestId === availabilityRequest.current) {
        setAvailabilityLoading(false);
      }
    }
  }, []);

  const refreshData = useCallback(async (
    date = getDateKey(),
    slot = DEFAULT_BOOKING_SLOT,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const userId = getSignedInUserId();
      const loadedBookings = await bookingRepository.findByUserId(userId);
      setBookings(loadedBookings);
      await seedRoomsIfEmpty();
      const loadedRooms = await getRooms(date, slot);
      setRooms(loadedRooms);
      setAvailabilityDate(date);
      setAvailabilitySlot(slot);
    } catch (loadError: unknown) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : 'Could not load data from Firestore.';
      setError(message);
      throw loadError;
    } finally {
      setLoading(false);
    }
  }, [bookingRepository]);

  useEffect(() => {
    void refreshData().catch(() => {
      // The error is exposed in context for the screen to show a retry action.
    });
  }, [refreshData]);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return undefined;
    return subscribeToBookings(
      userId,
      () => {
        void bookingRepository
          .findByUserId(userId)
          .then(setBookings)
          .catch((loadError: unknown) => {
            setError(
              loadError instanceof Error
                ? loadError.message
                : 'Could not refresh local bookings.',
            );
          });
      },
      (loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not listen for booking updates.',
        );
      },
    );
  }, [bookingRepository]);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId || loading) return;
    void reconcileBookingReminders(userId, bookings).catch((syncError: unknown) => {
      console.error('Could not sync local booking reminders:', syncError);
    });
  }, [bookings, loading]);

  useEffect(() => {
    const now = Date.now();
    const availabilityBoundaries = [
      Date.parse(getBookingEndTime(availabilityDate, availabilitySlot)),
      ...bookings
        .filter(
          (booking) =>
            (booking.status === 'CONFIRMED' || booking.status === 'IN_USE'),
        )
        .map((booking) =>
          booking.status === 'CONFIRMED'
            ? Date.parse(booking.startTime) + 15 * 60 * 1000
            : Date.parse(booking.endTime),
        ),
    ].filter((boundary) => Number.isFinite(boundary) && boundary > now);
    if (availabilityBoundaries.length === 0) return;
    const msUntilExpiry = Math.min(...availabilityBoundaries) - now + 1;

    const timer = setTimeout(() => {
      void refreshData(availabilityDate, availabilitySlot).catch(() => undefined);
    }, msUntilExpiry);
    return () => clearTimeout(timer);
  }, [availabilityDate, availabilitySlot, bookings, refreshData]);

  const addRoom = useCallback(async (room: Omit<Room, 'id'>) => {
    const savedRoom = await addFirestoreRoom(room);
    setRooms((current) => [...current, savedRoom]);
    return savedRoom;
  }, []);

  const updateRoom = useCallback(
    async (roomId: string, changes: Partial<Omit<Room, 'id'>>) => {
      await updateFirestoreRoom(roomId, changes);
      setRooms((current) =>
        current.map((room) => (room.id === roomId ? { ...room, ...changes } : room)),
      );
    },
    [],
  );

  const deleteRoom = useCallback(async (roomId: string) => {
    await deleteFirestoreRoom(roomId);
    setRooms((current) => current.filter((room) => room.id !== roomId));
  }, []);

  const createBooking = useCallback(
    async (room: Room, date: string, slot: string): Promise<boolean> => {
      const booking = await createBookingUseCase.execute({
        room,
        date,
        slot,
        userId: getSignedInUserId(),
      });
      const nextBookings = [...bookings, booking];
      let remindersScheduled = false;
      try {
        remindersScheduled = await reconcileBookingReminders(
          booking.userId,
          nextBookings,
          true,
        );
      } catch (reminderError: unknown) {
        console.error('Booking was saved, but its reminders could not be scheduled:', reminderError);
      }
      setBookings((current) =>
        current.some((item) => item.id === booking.id)
          ? current
          : [...current, booking],
      );
      if (availabilityDate === date && availabilitySlot === slot) {
        void refreshRooms(date, slot).catch(() => undefined);
      }
      return remindersScheduled;
    },
    [
      availabilityDate,
      availabilitySlot,
      bookings,
      createBookingUseCase,
      refreshRooms,
    ],
  );

  const cancelBooking = useCallback(
    async (bookingId: string) => {
      const booking = bookings.find((item) => item.id === bookingId);
      await cancelFirestoreBooking(bookingId, getSignedInUserId());
      setBookings((current) => current.filter((item) => item.id !== bookingId));
      if (
        booking &&
        availabilityDate === booking.date &&
        availabilitySlot === booking.slot
      ) {
        void refreshRooms(booking.date, booking.slot).catch(() => undefined);
      }
    },
    [availabilityDate, availabilitySlot, bookings, refreshRooms],
  );

  const extendBooking = useCallback(
    async (bookingId: string, minutes: number) => {
      const booking = bookings.find((item) => item.id === bookingId);
      await extendFirestoreBooking(bookingId, minutes);
      if (
        booking &&
        availabilityDate === booking.date &&
        availabilitySlot === booking.slot
      ) {
        void refreshRooms(booking.date, booking.slot).catch(() => undefined);
      }
    },
    [availabilityDate, availabilitySlot, bookings, refreshRooms],
  );

  const value = useMemo<AppStateContextValue>(
    () => ({
      rooms,
      bookings,
      profile,
      loading,
      availabilityLoading,
      error,
      availabilityDate,
      availabilitySlot,
      scanIdCardUseCase,
      refreshData,
      refreshRooms,
      addRoom,
      updateRoom,
      deleteRoom,
      createBooking,
      cancelBooking,
      extendBooking,
      updateProfile: setProfile,
    }),
    [
      rooms,
      bookings,
      profile,
      loading,
      availabilityLoading,
      error,
      availabilityDate,
      availabilitySlot,
      scanIdCardUseCase,
      refreshData,
      refreshRooms,
      addRoom,
      updateRoom,
      deleteRoom,
      createBooking,
      cancelBooking,
      extendBooking,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};

export const useAppState = (): AppStateContextValue => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used inside AppStateProvider.');
  }
  return context;
};
