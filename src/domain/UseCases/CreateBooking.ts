import type { Booking } from '../Entities/Booking';
import type {
  BookingRepository,
  CreateBookingInput,
} from '../Repositories/BookingRepository';

export type { CreateBookingInput } from '../Repositories/BookingRepository';

const getSlotEndTime = (date: string, slot: string): number => {
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

  const startTime = Date.parse(
    `${date}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00+07:00`,
  );
  const endTime = Date.parse(
    `${date}T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00+07:00`,
  );
  if (endTime <= startTime) {
    throw new Error(`Invalid booking time range for "${date}" and "${slot}".`);
  }
  return endTime;
};

export class CreateBooking {
  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly now: () => number = Date.now,
  ) {}

  async execute(input: CreateBookingInput): Promise<Booking> {
    if (
      !input.room.id.trim() ||
      !input.room.name.trim() ||
      !input.room.building.trim()
    ) {
      throw new Error('Room id, name, and building are required.');
    }
    if (!input.userId.trim()) {
      throw new Error('A signed-in user is required to create a booking.');
    }
    if (getSlotEndTime(input.date, input.slot) <= this.now()) {
      throw new Error('Booking time slot has already ended.');
    }

    return this.bookingRepository.create(input);
  }
}
