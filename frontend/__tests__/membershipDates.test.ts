import { membershipValidityLabel } from '../src/utils/membershipDates';

test('annual cards include the day before the anniversary in Indian time', () => {
  expect(membershipValidityLabel('2027-10-11T18:30:00.000Z')).toBe('11 Oct 2027');
  expect(membershipValidityLabel('2027-10-12T14:00:00.000Z')).toBe('11 Oct 2027');
  expect(membershipValidityLabel('2025-02-28T18:30:00.000Z')).toBe('28 Feb 2025');
  expect(membershipValidityLabel(null)).toBe('');
  expect(membershipValidityLabel('invalid')).toBe('');
});
