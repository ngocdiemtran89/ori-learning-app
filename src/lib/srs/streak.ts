/**
 * Utility: Convert timestamp to YYYY-MM-DD string in Vietnam timezone (Asia/Ho_Chi_Minh).
 */
export function getVietnamDateKey(timestamp: string | Date | number): string {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Pure function: Calculate consecutive daily study streak in Vietnam timezone.
 *
 * @param activityTimestamps Array of ISO string timestamps or date strings from reviews & quiz attempts.
 * @param referenceDate Current date/time reference (defaults to now).
 * @returns streak number (0, 1, 2, ...)
 */
export function calculateStudyStreak(
  activityTimestamps: string[],
  referenceDate: string | Date | number = new Date()
): number {
  if (!activityTimestamps || activityTimestamps.length === 0) {
    return 0;
  }

  // 1. Convert all activity timestamps into a Set of unique Vietnam date keys (YYYY-MM-DD)
  const uniqueDateKeys = new Set<string>();
  for (const ts of activityTimestamps) {
    const key = getVietnamDateKey(ts);
    if (key) {
      uniqueDateKeys.add(key);
    }
  }

  if (uniqueDateKeys.size === 0) {
    return 0;
  }

  // 2. Determine reference date (Today) & Yesterday in Vietnam timezone
  const refDateObj = new Date(referenceDate);
  const todayKey = getVietnamDateKey(refDateObj);

  const yesterdayObj = new Date(refDateObj.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayKey = getVietnamDateKey(yesterdayObj);

  const hasToday = uniqueDateKeys.has(todayKey);
  const hasYesterday = uniqueDateKeys.has(yesterdayKey);

  // If student studied neither today nor yesterday (VN time), streak is broken (0)
  if (!hasToday && !hasYesterday) {
    return 0;
  }

  // 3. Count backward consecutively
  let streak = 0;
  let cursor = hasToday ? new Date(refDateObj.getTime()) : new Date(yesterdayObj.getTime());

  while (true) {
    const cursorKey = getVietnamDateKey(cursor);
    if (uniqueDateKeys.has(cursorKey)) {
      streak++;
      // Move 1 day backward
      cursor.setTime(cursor.getTime() - 24 * 60 * 60 * 1000);
    } else {
      break;
    }
  }

  return streak;
}
