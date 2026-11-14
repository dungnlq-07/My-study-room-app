import type { Booking } from '../Entities/Booking';

export interface CreateBookingInput {
  room: {
    id: string;
    name: string;
    building: string;
  };
  date: string;
  slot: string;
  userId: string;
}

export interface BookingRepository {
  create(input: CreateBookingInput): Promise<Booking>;
  findByUserId(userId: string): Promise<Booking[]>;
}
