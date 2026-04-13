from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.config import Settings


@dataclass(slots=True)
class BusinessHoursState:
    is_open: bool
    label: str


def get_business_hours_state(settings: Settings) -> BusinessHoursState:
    now = datetime.now(ZoneInfo(settings.office_timezone))
    is_working_day = now.weekday() in settings.office_days
    is_working_hour = settings.office_start_hour <= now.hour < settings.office_end_hour
    label = f"{settings.office_start_hour:02d}:00 - {settings.office_end_hour:02d}:00 ({settings.office_timezone})"
    return BusinessHoursState(is_open=is_working_day and is_working_hour, label=label)

