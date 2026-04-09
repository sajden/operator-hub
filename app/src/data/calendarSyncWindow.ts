function startOfLocalDay(date = new Date()) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function plannerSyncWindow(rangeDays = 14) {
  const start = startOfLocalDay(new Date())
  const end = new Date(start)
  end.setDate(end.getDate() + rangeDays)
  end.setHours(23, 59, 59, 999)

  return {
    start,
    end,
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString()
  }
}
