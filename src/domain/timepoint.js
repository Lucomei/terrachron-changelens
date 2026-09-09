function validDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}

export function normalizeTimePoint({ year, month = '', day = '' }) {
  if (!/^\d{4}$/.test(String(year || ''))) throw new Error('请选择年份');
  if (day && !month) throw new Error('选择日期前请先选择月份');
  if (month && !/^(0[1-9]|1[0-2])$/.test(String(month))) throw new Error('请选择有效月份');
  if (day && !/^(0[1-9]|[12]\d|3[01])$/.test(String(day))) throw new Error('请选择有效日期');
  const precision = day ? 'day' : month ? 'month' : 'year';
  const date = `${year}-${month || '07'}-${day || (month ? '15' : '01')}`;
  if (!validDate(date)) throw new Error('请选择有效日期');
  return { precision, date };
}

export function findClosestObservation(observations, input) {
  const target = normalizeTimePoint(input);
  const targetTime = Date.parse(`${target.date}T00:00:00Z`);
  const candidates = observations.flatMap((observation) =>
    (observation.capturedDates || []).map((capturedAt) => ({ observation, capturedAt })),
  );
  if (!candidates.length) return { observation: null, capturedAt: null, target };
  candidates.sort((a, b) => {
    const delta = Math.abs(Date.parse(`${a.capturedAt}T00:00:00Z`) - targetTime);
    const otherDelta = Math.abs(Date.parse(`${b.capturedAt}T00:00:00Z`) - targetTime);
    return delta - otherDelta || b.capturedAt.localeCompare(a.capturedAt);
  });
  return { ...candidates[0], target };
}
