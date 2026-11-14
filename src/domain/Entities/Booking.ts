export type BookingStatus =
  | 'CONFIRMED'
  | 'IN_USE'
  | 'COMPLETED'
  | 'NO_SHOW';

export interface Booking {
  id: string;
  roomId: string;
  roomName: string;
  building: string;
  date: string;
  slot: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  seatNumber?: number;
}
