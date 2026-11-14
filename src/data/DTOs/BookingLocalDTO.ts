export type BookingSyncState = 'pending' | 'synced';

export interface BookingLocalDTO {
  id: string;
  room_id: string;
  room_name: string;
  building: string;
  date: string;
  slot: string;
  user_id: string;
  start_time: string;
  end_time: string;
  status: string;
  seat_number: number | null;
  sync_state: BookingSyncState;
  sync_error: string | null;
}

export interface BookingFirestoreDTO {
  roomId: string;
  roomName: string;
  building: string;
  date: string;
  slot: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: string;
  seatNumber?: number;
}
