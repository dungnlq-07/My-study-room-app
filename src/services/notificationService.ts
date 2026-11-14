import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRunningInExpoGo } from 'expo';
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

import type { Booking } from '../context/AppStateContext';
import type { AppNotification, NotificationType } from '../types/notification';

interface StoredNotification extends AppNotification {
  bookingId: string;
  scheduledAt: number;
  scheduledNotificationId?: string;
}

type NotificationListener = (
  notifications: AppNotification[],
) => void;
type NotificationErrorListener = (error: Error) => void;

const STORAGE_PREFIX = 'booking-notifications:';
const UPCOMING_REMINDER_MS = 15 * 60 * 1000;
const EXPIRING_REMINDER_MS = 10 * 60 * 1000;
const listeners = new Map<
  string,
  Set<{ onNotifications: NotificationListener; onError: NotificationErrorListener }>
>();
const refreshTimers = new Map<string, ReturnType<typeof setTimeout>>();
const syncQueues = new Map<string, Promise<boolean>>();
let notificationsModulePromise:
  | Promise<typeof NotificationsModule>
  | undefined;

const getNativeNotifications = async (): Promise<
  typeof NotificationsModule | undefined
> => {
  if (Platform.OS === 'web' || isRunningInExpoGo()) return undefined;
  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications').then(
      (notifications) => {
        notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
        return notifications;
      },
    ).catch((error: unknown) => {
      notificationsModulePromise = undefined;
      throw error;
    });
  }
  return notificationsModulePromise;
};

const storageKey = (userId: string): string => `${STORAGE_PREFIX}${userId}`;

const readNotifications = async (
  userId: string,
): Promise<StoredNotification[]> => {
  const serialized = await AsyncStorage.getItem(storageKey(userId));
  if (serialized === null) return [];
  const parsed: unknown = JSON.parse(serialized);
  if (
    !Array.isArray(parsed) ||
    parsed.some(
      (item) =>
        !item ||
        typeof item.id !== 'string' ||
        typeof item.bookingId !== 'string' ||
        typeof item.userId !== 'string' ||
        typeof item.title !== 'string' ||
        typeof item.message !== 'string' ||
        (item.type !== 'UPCOMING' && item.type !== 'EXPIRING') ||
        typeof item.scheduledAt !== 'number' ||
        typeof item.isRead !== 'boolean',
    )
  ) {
    throw new Error(`Local notifications for user "${userId}" are invalid.`);
  }
  return parsed as StoredNotification[];
};

const writeNotifications = async (
  userId: string,
  notifications: StoredNotification[],
): Promise<void> => {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(notifications));
  await publishNotifications(userId);
};

const toAppNotification = (
  notification: StoredNotification,
): AppNotification => ({
  id: notification.id,
  userId: notification.userId,
  title: notification.title,
  message: notification.message,
  type: notification.type,
  createdAt: new Date(notification.scheduledAt),
  isRead: notification.isRead,
});

const sortNotifications = (notifications: AppNotification[]) =>
  notifications.sort((left, right) => {
    const leftTime =
      left.createdAt instanceof Date
        ? left.createdAt.getTime()
        : left.createdAt?.toMillis() ?? 0;
    const rightTime =
      right.createdAt instanceof Date
        ? right.createdAt.getTime()
        : right.createdAt?.toMillis() ?? 0;
    return rightTime - leftTime;
  });

const publishNotifications = async (userId: string): Promise<void> => {
  const userListeners = listeners.get(userId);
  if (!userListeners?.size) return;

  const notifications = await readNotifications(userId);
  const now = Date.now();
  const dueNotifications = sortNotifications(
    notifications
      .filter((notification) => notification.scheduledAt <= now)
      .map(toAppNotification),
  );
  userListeners.forEach(({ onNotifications }) =>
    onNotifications(dueNotifications),
  );

  const previousTimer = refreshTimers.get(userId);
  if (previousTimer) clearTimeout(previousTimer);
  const nextReminderAt = notifications
    .map((notification) => notification.scheduledAt)
    .filter((scheduledAt) => scheduledAt > now)
    .sort((left, right) => left - right)[0];
  if (nextReminderAt !== undefined) {
    refreshTimers.set(
      userId,
      setTimeout(() => {
        void publishNotifications(userId).catch((error: unknown) => {
          const currentListeners = listeners.get(userId);
          currentListeners?.forEach(({ onError }) =>
            onError(error instanceof Error ? error : new Error(String(error))),
          );
        });
      }, Math.max(1, nextReminderAt - now)),
    );
  } else {
    refreshTimers.delete(userId);
  }
};

const getReminder = (
  booking: Booking,
  type: NotificationType,
  scheduledAt: number,
): StoredNotification => {
  const isUpcoming = type === 'UPCOMING';
  return {
    id: `${booking.id}_${type}`,
    bookingId: booking.id,
    userId: booking.userId,
    title: isUpcoming
      ? 'Sắp đến giờ đặt phòng'
      : 'Sắp hết giờ sử dụng phòng',
    message: isUpcoming
      ? `Phòng ${booking.roomName} sẽ bắt đầu sau 15 phút (${booking.slot}).`
      : `Thời gian sử dụng phòng ${booking.roomName} sẽ kết thúc sau 10 phút.`,
    type,
    createdAt: new Date(scheduledAt),
    scheduledAt,
    isRead: false,
  };
};

const ensureNotificationPermission = async (
  shouldRequestPermission: boolean,
): Promise<boolean> => {
  const notifications = await getNativeNotifications();
  if (!notifications) return false;

  if (Platform.OS === 'android') {
    await notifications.setNotificationChannelAsync('booking-reminders', {
      name: 'Booking reminders',
      importance: notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  let permissions = await notifications.getPermissionsAsync();
  if (!permissions.granted && shouldRequestPermission) {
    permissions = await notifications.requestPermissionsAsync();
  }
  return permissions.granted;
};

const scheduleReminder = async (
  reminder: StoredNotification,
): Promise<string | undefined> => {
  const notifications = await getNativeNotifications();
  if (!notifications) return undefined;
  return notifications.scheduleNotificationAsync({
    content: {
      title: reminder.title,
      body: reminder.message,
      sound: 'default',
      data: {
        userId: reminder.userId,
        bookingId: reminder.bookingId,
        notificationId: reminder.id,
        type: reminder.type,
      },
    },
    trigger: {
      type: notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(reminder.scheduledAt),
      ...(Platform.OS === 'android'
        ? { channelId: 'booking-reminders' }
        : {}),
    },
  });
};

const cancelScheduledReminder = async (
  notificationId: string,
): Promise<void> => {
  const notifications = await getNativeNotifications();
  if (notifications) {
    await notifications.cancelScheduledNotificationAsync(notificationId);
  }
};

const syncBookingNotifications = async (
  userId: string,
  bookings: Booking[],
  shouldRequestPermission: boolean,
): Promise<boolean> => {
  const activeBookings = bookings.filter(
    (booking) =>
      booking.userId === userId &&
      (booking.status === 'CONFIRMED' || booking.status === 'IN_USE'),
  );
  const now = Date.now();
  const proposed = activeBookings.flatMap((booking) => {
    const reminders: StoredNotification[] = [];
    const upcomingAt = Date.parse(booking.startTime) - UPCOMING_REMINDER_MS;
    const expiringAt = Date.parse(booking.endTime) - EXPIRING_REMINDER_MS;
    if (
      booking.status === 'CONFIRMED' &&
      Number.isFinite(upcomingAt) &&
      upcomingAt > now
    ) {
      reminders.push(getReminder(booking, 'UPCOMING', upcomingAt));
    }
    if (Number.isFinite(expiringAt) && expiringAt > now) {
      reminders.push(getReminder(booking, 'EXPIRING', expiringAt));
    }
    return reminders;
  });

  const granted = await ensureNotificationPermission(shouldRequestPermission);

  const existing = await readNotifications(userId);
  const byId = new Map(existing.map((notification) => [notification.id, notification]));
  const proposedById = new Map(proposed.map((notification) => [notification.id, notification]));
  const next: StoredNotification[] = [];

  for (const notification of existing) {
    const replacement = proposedById.get(notification.id);
    if (!replacement) {
      if (notification.scheduledAt > now && notification.scheduledNotificationId) {
        await cancelScheduledReminder(
          notification.scheduledNotificationId,
        );
        continue;
      }
      next.push(notification);
      continue;
    }

    const timingChanged = notification.scheduledAt !== replacement.scheduledAt;
    if (timingChanged && notification.scheduledNotificationId) {
      await cancelScheduledReminder(
        notification.scheduledNotificationId,
      );
    }
    if (!timingChanged && notification.scheduledNotificationId) {
      next.push(notification);
      proposedById.delete(notification.id);
      continue;
    }

    const scheduledNotificationId = granted
      ? await scheduleReminder(replacement)
      : undefined;
    next.push({
      ...replacement,
      isRead: notification.isRead,
      ...(scheduledNotificationId ? { scheduledNotificationId } : {}),
    });
    proposedById.delete(notification.id);
  }

  for (const notification of proposedById.values()) {
    const scheduledNotificationId = granted
      ? await scheduleReminder(notification)
      : undefined;
    const previous = byId.get(notification.id);
    next.push({
      ...notification,
      isRead: previous?.isRead ?? false,
      ...(scheduledNotificationId ? { scheduledNotificationId } : {}),
    });
  }

  await writeNotifications(userId, next);
  return granted;
};

export const reconcileBookingReminders = (
  userId: string,
  bookings: Booking[],
  shouldRequestPermission = false,
): Promise<boolean> => {
  const previous = syncQueues.get(userId) ?? Promise.resolve(true);
  const current = previous
    .catch(() => false)
    .then(() =>
      syncBookingNotifications(userId, bookings, shouldRequestPermission),
    );
  syncQueues.set(userId, current);
  const clearQueue = () => {
    if (syncQueues.get(userId) === current) syncQueues.delete(userId);
  };
  void current.then(clearQueue, clearQueue);
  return current;
};

export const fetchNotifications = async (
  userId: string,
): Promise<AppNotification[]> => {
  const now = Date.now();
  return sortNotifications(
    (await readNotifications(userId))
      .filter((notification) => notification.scheduledAt <= now)
      .map(toAppNotification),
  );
};

export const subscribeToNotifications = (
  userId: string,
  onNotifications: NotificationListener,
  onError: NotificationErrorListener,
): (() => void) => {
  const userListeners = listeners.get(userId) ?? new Set();
  const listener = { onNotifications, onError };
  userListeners.add(listener);
  listeners.set(userId, userListeners);
  void publishNotifications(userId).catch((error: unknown) => {
    onError(error instanceof Error ? error : new Error(String(error)));
  });

  return () => {
    userListeners.delete(listener);
    if (!userListeners.size) {
      listeners.delete(userId);
      const timer = refreshTimers.get(userId);
      if (timer) clearTimeout(timer);
      refreshTimers.delete(userId);
    }
  };
};

export const markAsRead = async (
  userId: string,
  notificationId: string,
): Promise<void> => {
  const notifications = await readNotifications(userId);
  const notification = notifications.find((item) => item.id === notificationId);
  if (!notification) return;
  notification.isRead = true;
  await writeNotifications(userId, notifications);
};

export const deleteNotification = async (
  userId: string,
  notificationId: string,
): Promise<void> => {
  const notifications = await readNotifications(userId);
  const notification = notifications.find((item) => item.id === notificationId);
  if (!notification) return;
  if (notification.scheduledNotificationId) {
    await cancelScheduledReminder(
      notification.scheduledNotificationId,
    );
  }
  await writeNotifications(
    userId,
    notifications.filter((item) => item.id !== notificationId),
  );
};

export const clearAllNotifications = async (userId: string): Promise<void> => {
  const notifications = await readNotifications(userId);
  await Promise.all(
    notifications
      .map((notification) => notification.scheduledNotificationId)
      .filter((id): id is string => Boolean(id))
      .map((id) => cancelScheduledReminder(id)),
  );
  await AsyncStorage.removeItem(storageKey(userId));
  await publishNotifications(userId);
};
