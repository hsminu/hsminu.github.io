const lockscreen = document.querySelector('[data-overview-lockscreen]');
const date = lockscreen.querySelector('[data-overview-date]');
const clock = lockscreen.querySelector('[data-overview-clock]');
const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' });
const clockFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const minute = 60_000;
let minuteTimer;

function updateClock() {
  clearTimeout(minuteTimer);
  const now = new Date();
  const localMonth = String(now.getMonth() + 1).padStart(2, '0');
  const localDay = String(now.getDate()).padStart(2, '0');
  date.dateTime = `${now.getFullYear()}-${localMonth}-${localDay}`;
  date.textContent = dateFormat.format(now);
  clock.dateTime = clockFormat.format(now);
  clock.textContent = clock.dateTime;

  if (!document.hidden) minuteTimer = setTimeout(updateClock, minute - (Date.now() % minute));
}

updateClock();
window.addEventListener('pageshow', updateClock);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(minuteTimer);
  else updateClock();
});
