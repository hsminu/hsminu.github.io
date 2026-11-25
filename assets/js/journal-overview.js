const lockscreen = document.querySelector('[data-overview-lockscreen]');
const date = lockscreen.querySelector('[data-overview-date]');
const clock = lockscreen.querySelector('[data-overview-clock]');
const dateFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
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

const root = document.documentElement;
const theme = () => root.dataset.bsTheme === 'light' ? 'light' : 'dark';
const wallpapers = { dark: lockscreen.dataset.wallpaperDark, light: lockscreen.dataset.wallpaperLight };
const decoded = new Map();

function loadWallpaper(mode) {
  if (!decoded.has(mode)) {
    const image = new Image();
    image.src = wallpapers[mode];
    decoded.set(mode, image.decode().then(() => image, () => {
      decoded.delete(mode);
      return null;
    }));
  }
  return decoded.get(mode);
}

lockscreen.dataset.wallpaperTheme = theme();
new MutationObserver(async () => {
  const mode = theme();
  if (mode === lockscreen.dataset.wallpaperTheme) return;
  const image = await loadWallpaper(mode);
  if (image && theme() === mode) lockscreen.dataset.wallpaperTheme = mode;
}).observe(root, { attributeFilter: ['data-bs-theme'] });

function warmOtherWallpaper() {
  loadWallpaper(theme() === 'light' ? 'dark' : 'light');
}

if (document.readyState === 'complete') warmOtherWallpaper();
else window.addEventListener('load', warmOtherWallpaper, { once: true });
