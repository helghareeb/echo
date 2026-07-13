export function secondsToHHMMSS(seconds) {
  const s = Number.isFinite(seconds) ? seconds : 0;
  return new Date(s * 1000).toISOString().substring(11, 19);
}
