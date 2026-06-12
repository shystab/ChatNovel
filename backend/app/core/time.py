from datetime import UTC, datetime


def utc_now_naive() -> datetime:
    """Return UTC using the database's existing naive-datetime convention."""
    return datetime.now(UTC).replace(tzinfo=None)
