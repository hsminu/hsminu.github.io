const cover = document.querySelector('[data-journal-cover]');
const month = cover.querySelector('[data-journal-month]');
const date = cover.querySelector('[data-journal-date]');
const timeZone = cover.dataset.timezone || undefined;
const monthFormat = new Intl.DateTimeFormat('en-US', { timeZone, month: 'long' });
const dateFormat = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit' });

function updateEdition() {
  const now = new Date();
  const parts = dateFormat.formatToParts(now);
  const year = parts.find((part) => part.type === 'year').value;
  const number = parts.find((part) => part.type === 'month').value;
  month.textContent = monthFormat.format(now) + '.';
  date.dateTime = year + '-' + number;
  date.textContent = year + '.' + number;
}

updateEdition();
window.addEventListener('pageshow', updateEdition);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateEdition();
});

const figure = cover.querySelector('.journal-figure');
const motion = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
let pending;
let point;

function positionField() {
  pending = undefined;
  if (!point) {
    figure.style.removeProperty('--journal-flow-x');
    figure.style.removeProperty('--journal-flow-y');
    return;
  }
  const bounds = figure.getBoundingClientRect();
  const x = ((point.clientX - bounds.left) / bounds.width - 0.5) * 8;
  const y = ((point.clientY - bounds.top) / bounds.height - 0.5) * 6;
  figure.style.setProperty('--journal-flow-x', x.toFixed(2) + 'px');
  figure.style.setProperty('--journal-flow-y', y.toFixed(2) + 'px');
}

function resetField() {
  point = undefined;
  if (pending !== undefined) cancelAnimationFrame(pending);
  positionField();
}

figure.addEventListener('pointermove', (event) => {
  if (!motion.matches) return;
  point = event;
  if (pending === undefined) pending = requestAnimationFrame(positionField);
}, { passive: true });
figure.addEventListener('pointerleave', resetField);
motion.addEventListener('change', resetField);
