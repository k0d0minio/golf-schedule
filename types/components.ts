import type {
  ProgramItem,
  Reservation,
  HotelBooking,
  VenueType,
  PointOfContact,
} from './index';

export type ProgramItemWithRelations = ProgramItem & {
  venue_type: VenueType | null;
  point_of_contact: PointOfContact | null;
};

export type ReservationWithRelations = Reservation & {
  hotel_booking: HotelBooking | null;
  program_item: ProgramItem | null;
};

export type DayEntry = ProgramItemWithRelations | ReservationWithRelations;

export function isProgramItem(entry: DayEntry): entry is ProgramItemWithRelations {
  return 'title' in entry;
}
