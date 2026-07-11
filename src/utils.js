import { dateStr } from './repeat';

export const isDone = (t) => t.doneSteps >= t.totalSteps;
export const isStarted = (t) => (t.timeline?.length ?? 0) > 0 || t.doneSteps > 0;

export const fmtReminderShort = (iso) => {
  const d = new Date(iso);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return dateStr(d) === dateStr() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
};
