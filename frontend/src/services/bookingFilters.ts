export type BookingFiltersValue = Partial<Record<'history' | 'category' | 'language' | 'mode' | 'state' | 'district' | 'city'
  | 'attendeeState' | 'eventFrom' | 'eventTo' | 'bookedFrom' | 'bookedTo' | 'paymentStatus' | 'status' | 'registrationType'
  | 'responseKey' | 'responseValue' | 'search' | 'eventSearch', string>>;
export interface BookingFilterOptions {
  categories?: string[]; languages?: string[]; states?: string[]; cities?: string[]; attendeeStates?: string[];
  districts?: { state: string; name: string }[]; questions?: { key: string; label: string }[];
}
