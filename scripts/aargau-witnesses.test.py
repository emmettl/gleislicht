import datetime as dt
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('witnesses', Path(__file__).with_name('inventory-aargau-witnesses.py'))
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)


class WitnessCalendars(unittest.TestCase):
    def test_exceptions_override_weekly_calendar_and_add_calendarless_service(self):
        first, last = dt.date(2026, 9, 4), dt.date(2026, 9, 6)
        calendar = dict(start_date='20260901', end_date='20260930', friday='1', saturday='0', sunday='0')
        exceptions = [dict(date='20260904', exception_type='2'), dict(date='20260906', exception_type='1')]
        self.assertEqual(w.service_dates(calendar, exceptions, first, last), [last])
        self.assertEqual(w.service_dates(None, exceptions, first, last), [last])

    def test_after_midnight_departure_has_only_following_civil_day_witness(self):
        date = dt.date(2026, 9, 4)
        self.assertEqual(w.civil_dates([date], 25*3600, 26*3600, date, date+dt.timedelta(days=1)), [('2026-09-05', '2026-09-04', -86400)])
        self.assertEqual(w.civil_dates([date], 23*3600, 86400, date, date+dt.timedelta(days=1)), [('2026-09-04', '2026-09-04', 0)])
        self.assertEqual(len(w.civil_dates([date], 23*3600, 25*3600, date, date+dt.timedelta(days=1))), 2)

    def test_date_cover_is_deterministic_and_does_not_invent_inactive_witnesses(self):
        result = w.greedy_dates({'a': ['2026-01-02', '2026-01-03'], 'b': ['2026-01-03'], 'c': ['2026-01-01', '2026-01-04'], 'inactive': []})
        self.assertEqual(result, [dict(date='2026-01-03', newlyWitnessedRoutes=['a','b']), dict(date='2026-01-01', newlyWitnessedRoutes=['c'])])


if __name__ == '__main__': unittest.main()
