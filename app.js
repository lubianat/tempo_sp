const API_BASE = 'https://apiprevmet3.inmet.gov.br/meteograma/3550308';
const SAO_PAULO_TZ = 'America/Sao_Paulo';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SAO_PAULO_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

function parseLocalParts(now = new Date()) {
  const parts = formatter.formatToParts(now);
  const map = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
  };
}

function dateStringFromParts({ year, month, day }) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function shiftDate(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function buildApiTarget(now = new Date()) {
  const local = parseLocalParts(now);
  const today = dateStringFromParts(local);

  let date = today;
  let cycle = '00';

  if (local.hour >= 13) {
    cycle = '12';
  } else if (local.hour < 1) {
    date = shiftDate(today, -1);
    cycle = '12';
  }

  return {
    date,
    cycle,
    url: `${API_BASE}/${date}/${cycle}`,
  };
}

export function buildPreviousTarget(target) {
  if (target.cycle === '12') {
    return {
      date: target.date,
      cycle: '00',
      url: `${API_BASE}/${target.date}/00`,
    };
  }

  const previousDate = shiftDate(target.date, -1);
  return {
    date: previousDate,
    cycle: '12',
    url: `${API_BASE}/${previousDate}/12`,
  };
}

async function loadMeteogramForTarget(target) {
  const response = await fetch(target.url);
  if (!response.ok) {
    throw new Error(`Falha na API (${response.status}).`);
  }

  const payload = await response.json();
  if (!payload?.base64 || typeof payload.base64 !== 'string') {
    throw new Error('Resposta da API inválida.');
  }

  return {
    target,
    imageSrc: payload.base64,
    fromCache: response.headers.get('X-Served-From-Cache') === 'true',
  };
}

export async function loadMeteogram(now = new Date()) {
  const target = buildApiTarget(now);
  return loadMeteogramForTarget(target);
}

async function main() {
  const img = document.querySelector('#meteograma');
  const status = document.querySelector('#status');
  const latestTarget = buildApiTarget();
  const previousTarget = buildPreviousTarget(latestTarget);
  let showingPrevious = false;
  let loading = false;
  let touchStartX = null;
  let touchStartY = null;

  const showTarget = async (target) => {
    if (loading) return;
    loading = true;
    try {
      const { imageSrc, fromCache } = await loadMeteogramForTarget(target);
      img.src = imageSrc;
      status.textContent = fromCache ? 'Offline – exibindo último meteograma salvo' : '';
      showingPrevious = target.date === previousTarget.date && target.cycle === previousTarget.cycle;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Erro inesperado.';
    } finally {
      loading = false;
    }
  };

  await showTarget(latestTarget);

  img.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    },
    { passive: true }
  );

  img.addEventListener(
    'touchend',
    async (event) => {
      if (touchStartX === null || touchStartY === null || event.changedTouches.length !== 1) return;

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      touchStartX = null;
      touchStartY = null;

      if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

      const nextTarget = showingPrevious ? latestTarget : previousTarget;
      await showTarget(nextTarget);
    },
    { passive: true }
  );

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  main();
}
