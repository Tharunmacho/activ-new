import { governmentSchemes } from '../src/utils/governmentSchemes';

test('None is a neutral empty answer and never an availed scheme', () => {
  expect(governmentSchemes([' None '])).toEqual({ schemes: [], explicitlyNone: true });
  expect(governmentSchemes(['NA'])).toEqual({ schemes: [], explicitlyNone: true });
  expect(governmentSchemes(undefined)).toEqual({ schemes: [], explicitlyNone: false });
});
test('saved schemes survive a legacy None entry and duplicate selections', () => {
  expect(governmentSchemes(['None', ' PMEGP ', 'PMEGP', 'MUDRA', '', null])).toEqual({ schemes: ['PMEGP', 'MUDRA'], explicitlyNone: false });
});
