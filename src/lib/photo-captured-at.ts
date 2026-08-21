export function formatPhotoCapturedAt(capturedAt: string): string {
  const [date, timeWithOffset] = capturedAt.split("T");
  const [year, month, day] = date.split("-");
  const time = timeWithOffset.slice(0, 5);
  return `${year}年${Number(month)}月${Number(day)}日 ${time}`;
}
