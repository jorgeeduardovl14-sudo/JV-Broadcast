import { createRealtime } from './realtime.js';

const q = (selector) => document.querySelector(selector);
const qa = (selector) => [...document.querySelectorAll(selector)];
const params = new URLSearchParams(location.search);
const match = params.get('session') || params.get('match') || 'DEMO';
const rt = createRealtime(match, 'control');
const LIBRARY_KEY = 'jv:sponsorLibrary:v9';
const MATCH_LIBRARY_KEY = `jv:preSponsors:${match}`;
q('#matchLabel').textContent = match;

function readArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function sponsorIdentity(sponsor) {
  return sponsor?.id || `${sponsor?.name || ''}|${sponsor?.logo || ''}|${sponsor?.text || ''}`;
}

function mergeSponsors(...collections) {
  const merged = [];
  const seen = new Set();
  collections.flat().forEach((sponsor) => {
    if (!sponsor || !sponsor.name || String(sponsor.id || '').startsWith('demo-')) return;
    const key = sponsorIdentity(sponsor);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({
      id: sponsor.id || `sp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: sponsor.name,
      text: sponsor.text || '',
      logo: sponsor.logo || '',
      weight: Number(sponsor.weight) || 1
    });
  });
  return merged;
}

const globalSponsors = readArray(LIBRARY_KEY);
const matchSponsors = readArray(MATCH_LIBRARY_KEY);
const preparedSponsors = mergeSponsors(matchSponsors, globalSponsors);

const defaultState = {
  homeName: 'Santa Bárbara',
  awayName: 'Visitante',
  homeScore: 0,
  awayScore: 0,
  setNumber: 1,
  setResults: [],
  serve: 'home',
  scoreVisible: true,
  scorePosition: 'top-left',
  scoreSize: 'medium',
  sponsors: preparedSponsors,
  sponsorIndex: preparedSponsors.length ? 0 : -1,
  sponsorVisible: false,
  sponsorFullscreen: false,
  sponsorPosition: 'top-right',
  sponsorSize: 'medium',
  activeSponsor: null,
  lowerVisible: false,
  sceneVisible: false,
  scenePresets: {
    upcoming: { title: 'Próximamente', subtitle: 'La transmisión comenzará en breve' },
    live: { title: 'Partido en vivo', subtitle: 'Voleibol nacional' },
    timeout: { title: 'Tiempo técnico', subtitle: 'Volvemos en breve' },
    between: { title: 'Entre sets', subtitle: 'Preparando el siguiente set' },
    final: { title: 'Final del partido', subtitle: 'Gracias por acompañarnos' }
  },
  accent: '#20d3a6',
  template: localStorage.getItem(`jv:template:${match}`) || 'primera',
  homeColor: '#20d3a6',
  awayColor: '#2563eb',
  homeLogo: '',
  awayLogo: ''
};

let state = { ...defaultState };
let history = [];
let rotation = null;
let lowerTimer = null;
let sponsorsSent = false;
let selectedSponsorLogo = '';
let selectedHomeLogo = '';
let selectedAwayLogo = '';

const DEFAULT_SCENES = {
  upcoming: { title: 'Próximamente', subtitle: 'La transmisión comenzará en breve' },
  live: { title: 'Partido en vivo', subtitle: 'Voleibol nacional' },
  timeout: { title: 'Tiempo técnico', subtitle: 'Volvemos en breve' },
  between: { title: 'Entre sets', subtitle: 'Preparando el siguiente set' },
  final: { title: 'Final del partido', subtitle: 'Gracias por acompañarnos' }
};
const SCENE_FIELDS = {
  upcoming: ['sceneUpcomingTitle', 'sceneUpcomingSubtitle'],
  live: ['sceneLiveTitle', 'sceneLiveSubtitle'],
  timeout: ['sceneTimeoutTitle', 'sceneTimeoutSubtitle'],
  between: ['sceneBetweenTitle', 'sceneBetweenSubtitle'],
  final: ['sceneFinalTitle', 'sceneFinalSubtitle']
};

function normalizedSetResults(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    setNumber: Number(item?.setNumber) || 1,
    homeScore: Math.max(0, Number(item?.homeScore) || 0),
    awayScore: Math.max(0, Number(item?.awayScore) || 0)
  })).sort((a, b) => a.setNumber - b.setNumber);
}

function scenePresets() {
  const incoming = state.scenePresets && typeof state.scenePresets === 'object' ? state.scenePresets : {};
  return Object.fromEntries(Object.entries(DEFAULT_SCENES).map(([key, fallback]) => [key, { ...fallback, ...(incoming[key] || {}) }]));
}

function readSceneEditors() {
  const presets = {};
  Object.entries(SCENE_FIELDS).forEach(([key, [titleId, subtitleId]]) => {
    presets[key] = {
      title: q(`#${titleId}`).value.trim() || DEFAULT_SCENES[key].title,
      subtitle: q(`#${subtitleId}`).value.trim() || DEFAULT_SCENES[key].subtitle
    };
  });
  return presets;
}

function finishCurrentSet() {
  const setNumber = Math.max(1, Number(state.setNumber) || 1);
  const results = normalizedSetResults(state.setResults).filter((item) => item.setNumber !== setNumber);
  results.push({ setNumber, homeScore: state.homeScore, awayScore: state.awayScore });
  results.sort((a, b) => a.setNumber - b.setNumber);
  patch({
    setResults: results,
    setNumber: setNumber + 1,
    homeScore: 0,
    awayScore: 0,
    serve: 'home'
  });
}

function restoreLastSet() {
  const results = normalizedSetResults(state.setResults);
  if (!results.length) return alert('Todavía no hay un set finalizado para corregir.');
  const last = results[results.length - 1];
  patch({
    setResults: results.slice(0, -1),
    setNumber: last.setNumber,
    homeScore: last.homeScore,
    awayScore: last.awayScore
  });
}

function persistSponsors(sponsors) {
  const clean = mergeSponsors(sponsors);
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(clean));
    localStorage.setItem(MATCH_LIBRARY_KEY, JSON.stringify(clean));
  } catch (error) {
    console.warn('No se pudo guardar la biblioteca de patrocinadores.', error);
  }
}

function syncStatus(text = 'Buscando teléfono…', connected = false) {
  q('#syncStatus').textContent = text;
  q('#syncStatus').className = `status ${connected ? 'online' : 'offline'}`;
}

rt.onStatus(({ text, connected }) => syncStatus(text, connected));
rt.onMetadata((metadata) => {
  const ended = metadata.streamStatus === 'ended';
  q('#streamEndedNotice').classList.toggle('hidden', !ended);
});

rt.subscribe((data) => {
  const incoming = { ...(data || {}) };
  incoming.setResults = normalizedSetResults(incoming.setResults);
  incoming.scenePresets = { ...DEFAULT_SCENES, ...(incoming.scenePresets || {}) };
  const incomingSponsors = Array.isArray(incoming.sponsors) ? incoming.sponsors : [];
  const combinedSponsors = mergeSponsors(incomingSponsors, state.sponsors, preparedSponsors);
  incoming.sponsors = combinedSponsors;

  if (combinedSponsors.length && (!Number.isInteger(incoming.sponsorIndex) || incoming.sponsorIndex < 0)) {
    incoming.sponsorIndex = 0;
  }

  state = { ...state, ...incoming, sponsors: combinedSponsors };
  persistSponsors(combinedSponsors);
  render();

  if (!sponsorsSent && combinedSponsors.length) {
    sponsorsSent = true;
    setTimeout(() => {
      rt.patch({
        sponsors: combinedSponsors,
        sponsorIndex: state.sponsorIndex >= 0 ? state.sponsorIndex : 0
      });
    }, 180);
  }
});

function patch(changes, remember = true) {
  if (remember) history.push({ ...state, sponsors: [...(state.sponsors || [])] });
  state = { ...state, ...changes };
  if (Array.isArray(changes.sponsors)) persistSponsors(changes.sponsors);
  render();
  rt.patch(changes);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function renderLogoPreview() {
  q('#sponsorLogoPreview').innerHTML = selectedSponsorLogo
    ? `<img src="${selectedSponsorLogo}" alt="Vista previa">`
    : '<span>Vista previa del logo</span>';
}

function render() {
  q('#homeName').value = state.homeName;
  q('#awayName').value = state.awayName;
  q('#homeScore').textContent = state.homeScore;
  q('#awayScore').textContent = state.awayScore;
  q('#setNumber').textContent = state.setNumber;
  const results = normalizedSetResults(state.setResults);
  q('#setHistoryList').innerHTML = results.length
    ? results.map((item) => `<div class="set-history-chip"><span>SET ${item.setNumber}</span><b>${item.homeScore}–${item.awayScore}</b></div>`).join('')
    : '<span class="hint">Aún no hay sets finalizados.</span>';
  const presets = scenePresets();
  Object.entries(SCENE_FIELDS).forEach(([key, [titleId, subtitleId]]) => {
    const title = q(`#${titleId}`), subtitle = q(`#${subtitleId}`);
    if (title && document.activeElement !== title) title.value = presets[key].title;
    if (subtitle && document.activeElement !== subtitle) subtitle.value = presets[key].subtitle;
  });
  q('#scoreVisible').checked = state.scoreVisible;
  q('#sponsorPosition').value = state.sponsorPosition || 'top-right';
  q('#sponsorSize').value = state.sponsorSize || 'medium';
  q('#scorePosition').value = state.scorePosition || 'top-left';
  q('#scoreSize').value = state.scoreSize || 'medium';
  q('#accent').value = state.accent || '#20d3a6';
  q('#template').value = state.template || 'primera';
  q('#homeColor').value = state.homeColor || '#20d3a6';
  q('#awayColor').value = state.awayColor || '#2563eb';
  q('#homeLogoPreview').innerHTML = state.homeLogo ? `<img src="${state.homeLogo}" alt="Logo local">` : '<span>Logo local</span>';
  q('#awayLogoPreview').innerHTML = state.awayLogo ? `<img src="${state.awayLogo}" alt="Logo visitante">` : '<span>Logo visitante</span>';
  document.documentElement.style.setProperty('--accent', state.accent || '#20d3a6');

  const sponsors = Array.isArray(state.sponsors) ? state.sponsors : [];
  q('#sponsorList').innerHTML = sponsors.length
    ? sponsors.map((sponsor, index) => `
      <div class="list-item sponsor-control-item">
        <div class="sponsor-control-logo">
          ${sponsor.logo ? `<img src="${sponsor.logo}" alt="">` : '<span>LOGO</span>'}
        </div>
        <div class="sponsor-control-copy">
          <b>${escapeHtml(sponsor.name)}</b><br>
          <small>${escapeHtml(sponsor.text || '')} · x${sponsor.weight || 1}</small>
        </div>
        <div>
          <button data-show="${index}" class="small">Ver</button>
          <button data-del="${index}" class="small danger">×</button>
        </div>
      </div>`).join('')
    : '<p class="hint">Aún no hay patrocinadores. Agrégalos aquí o desde la pantalla principal.</p>';

  qa('[data-show]').forEach((button) => {
    button.onclick = () => {
      const index = Number(button.dataset.show);
      const selected = (state.sponsors || [])[index];
      if (!selected) return alert('No se encontró el patrocinador seleccionado.');
      const changes = sponsorDisplayChanges(index, false, true);
      if (changes) patch(changes);
    };
  });

  qa('[data-del]').forEach((button) => {
    button.onclick = () => {
      const nextSponsors = [...sponsors];
      nextSponsors.splice(Number(button.dataset.del), 1);
      patch({
        sponsors: nextSponsors,
        activeSponsor: null,
        activeSponsorId: null,
        sponsorVisible: false,
        sponsorIndex: nextSponsors.length ? 0 : -1
      });
    };
  });
}

qa('.tabs button').forEach((button) => {
  button.onclick = () => {
    qa('.tabs button').forEach((item) => item.classList.remove('active'));
    qa('.tab').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    q(`#${button.dataset.tab}`).classList.add('active');
  };
});

qa('[data-act]').forEach((button) => {
  button.onclick = () => {
    const action = button.dataset.act;
    const changes = {};
    if (action === 'homePlus') { changes.homeScore = state.homeScore + 1; changes.serve = 'home'; }
    if (action === 'awayPlus') { changes.awayScore = state.awayScore + 1; changes.serve = 'away'; }
    if (action === 'homeMinus') changes.homeScore = Math.max(0, state.homeScore - 1);
    if (action === 'awayMinus') changes.awayScore = Math.max(0, state.awayScore - 1);
    if (action === 'setPlus') { finishCurrentSet(); return; }
    if (action === 'setMinus') { restoreLastSet(); return; }
    patch(changes);
  };
});

qa('[data-serve]').forEach((button) => {
  button.onclick = () => patch({ serve: button.dataset.serve });
});

q('#undo').onclick = () => {
  const previous = history.pop();
  if (!previous) return;
  state = previous;
  persistSponsors(state.sponsors || []);
  render();
  rt.patch(previous);
};
q('#editLastSet').onclick = restoreLastSet;
q('#homeName').onchange = (event) => patch({ homeName: event.target.value });
q('#awayName').onchange = (event) => patch({ awayName: event.target.value });
q('#scoreVisible').onchange = (event) => patch({ scoreVisible: event.target.checked });
q('#sponsorPosition').onchange = (event) => patch({ sponsorPosition: event.target.value }, false);
q('#sponsorSize').onchange = (event) => patch({ sponsorSize: event.target.value }, false);

async function optimizeLogoFile(file) {
  if (!file) return '';
  if (file.size > 5_000_000) throw new Error('El logo debe pesar menos de 5 MB.');
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el logo.'));
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('El archivo no es una imagen válida.'));
    img.src = dataUrl;
  });
  const maxW = 520, maxH = 300;
  const ratio = Math.min(1, maxW / image.naturalWidth, maxH / image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.76);
}

q('#sponsorFile').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    selectedSponsorLogo = await optimizeLogoFile(file);
    q('#sponsorLogo').value = '';
    renderLogoPreview();
  } catch (error) {
    alert(error.message || 'No se pudo cargar el logo.');
    event.target.value = '';
  }
});

q('#sponsorLogo').addEventListener('input', (event) => {
  if (!event.target.value.trim()) return;
  selectedSponsorLogo = event.target.value.trim();
  q('#sponsorFile').value = '';
  renderLogoPreview();
});

q('#addSponsor').onclick = () => {
  const name = q('#sponsorName').value.trim();
  if (!name) return alert('Escribe el nombre del patrocinador.');

  const sponsors = mergeSponsors(state.sponsors || [], [{
    id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    text: q('#sponsorText').value.trim(),
    logo: selectedSponsorLogo || q('#sponsorLogo').value.trim(),
    weight: Number(q('#sponsorWeight').value) || 1
  }]);

  patch({
    sponsors,
    sponsorIndex: state.sponsorIndex >= 0 ? state.sponsorIndex : 0
  });

  q('#sponsorName').value = '';
  q('#sponsorText').value = '';
  q('#sponsorLogo').value = '';
  q('#sponsorFile').value = '';
  selectedSponsorLogo = '';
  renderLogoPreview();
};

function weightedSponsors() {
  return (state.sponsors || []).flatMap((sponsor, index) =>
    Array(Number(sponsor.weight) || 1).fill(index)
  );
}

function sponsorDisplayChanges(index, fullscreen = false, visible = true) {
  const sponsors = state.sponsors || [];
  const sponsor = sponsors[index];
  if (!sponsor) return null;
  return {
    sponsorIndex: index,
    activeSponsorId: sponsor.id,
    sponsorVisible: visible,
    sponsorFullscreen: fullscreen,
    sceneVisible: false
  };
}

q('#showNext').onclick = () => {
  const sponsors = state.sponsors || [];
  if (!sponsors.length) return alert('No hay patrocinadores cargados.');
  const current = Number.isInteger(state.sponsorIndex) ? state.sponsorIndex : -1;
  const index = (current + 1) % sponsors.length;
  const changes = sponsorDisplayChanges(index, false, true);
  if (changes) patch(changes);
};

q('#showRandom').onclick = () => {
  const weighted = weightedSponsors();
  if (!weighted.length) return alert('No hay patrocinadores cargados.');
  const index = weighted[Math.floor(Math.random() * weighted.length)];
  const changes = sponsorDisplayChanges(index, false, true);
  if (changes) patch(changes);
};

q('#toggleSponsor').onclick = () => {
  const sponsors = state.sponsors || [];
  if (!sponsors.length) return alert('No hay patrocinadores cargados.');
  const index = state.sponsorIndex >= 0 ? state.sponsorIndex : 0;
  const changes = sponsorDisplayChanges(index, false, !state.sponsorVisible);
  if (changes) patch(changes);
};

q('#fullscreenSponsor').onclick = () => {
  const sponsors = state.sponsors || [];
  if (!sponsors.length) return alert('No hay patrocinadores cargados.');
  const index = state.sponsorIndex >= 0 ? state.sponsorIndex : 0;
  const changes = sponsorDisplayChanges(index, true, true);
  if (changes) patch(changes);
};

q('#rotationSeconds').onchange = (event) => {
  clearInterval(rotation);
  const seconds = Number(event.target.value);
  if (seconds) rotation = setInterval(() => q('#showRandom').click(), seconds * 1000);
};

qa('[data-profile]').forEach((button) => { button.onclick = () => alert('Crea y guarda tus propios patrocinadores para este perfil.'); });

function showLower(title, subtitle) {
  clearTimeout(lowerTimer);
  const duration = Number(q('#lowerDuration').value);
  patch({
    lowerTitle: title,
    lowerSubtitle: subtitle,
    lowerStyle: q('#lowerStyle').value,
    lowerVisible: true
  });
  if (duration) lowerTimer = setTimeout(() => patch({ lowerVisible: false }, false), duration * 1000);
}

q('#showLower').onclick = () => showLower(q('#lowerTitle').value, q('#lowerSubtitle').value);
q('#hideLower').onclick = () => patch({ lowerVisible: false });
qa('[data-quick]').forEach((button) => {
  button.onclick = () => {
    const [title, subtitle] = button.dataset.quick.split('|');
    q('#lowerTitle').value = title;
    q('#lowerSubtitle').value = subtitle;
    showLower(title, subtitle);
  };
});

q('#saveScenes').onclick = () => {
  const presets = readSceneEditors();
  patch({ scenePresets: presets }, false);
  alert('Textos de escenas guardados para esta sesión.');
};
qa('[data-scene-key]').forEach((button) => {
  button.onclick = () => {
    const key = button.dataset.sceneKey;
    const presets = readSceneEditors();
    const selected = presets[key] || DEFAULT_SCENES[key];
    patch({
      scenePresets: presets,
      sceneTitle: selected.title,
      sceneSubtitle: selected.subtitle,
      sceneVisible: true
    });
  };
});
q('#hideScene').onclick = () => patch({ sceneVisible: false });
q('#homeLogoFile').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    selectedHomeLogo = await optimizeLogoFile(file);
    q('#homeLogoUrl').value = '';
    q('#homeLogoPreview').innerHTML = `<img src="${selectedHomeLogo}" alt="Logo local">`;
  } catch (error) {
    alert(error.message || 'No se pudo cargar el logo local.');
    event.target.value = '';
  }
});

q('#awayLogoFile').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    selectedAwayLogo = await optimizeLogoFile(file);
    q('#awayLogoUrl').value = '';
    q('#awayLogoPreview').innerHTML = `<img src="${selectedAwayLogo}" alt="Logo visitante">`;
  } catch (error) {
    alert(error.message || 'No se pudo cargar el logo visitante.');
    event.target.value = '';
  }
});

q('#homeLogoUrl').addEventListener('input', (event) => {
  const value = event.target.value.trim();
  if (!value) return;
  selectedHomeLogo = value;
  q('#homeLogoFile').value = '';
  q('#homeLogoPreview').innerHTML = `<img src="${value}" alt="Logo local">`;
});

q('#awayLogoUrl').addEventListener('input', (event) => {
  const value = event.target.value.trim();
  if (!value) return;
  selectedAwayLogo = value;
  q('#awayLogoFile').value = '';
  q('#awayLogoPreview').innerHTML = `<img src="${value}" alt="Logo visitante">`;
});

q('#applyScoreLayout').onclick = () => {
  patch({
    scorePosition: q('#scorePosition').value,
    scoreSize: q('#scoreSize').value,
    scoreVisible: true
  });
};

q('#applyTeams').onclick = () => {
  const homeLogo = selectedHomeLogo || q('#homeLogoUrl').value.trim() || state.homeLogo || '';
  const awayLogo = selectedAwayLogo || q('#awayLogoUrl').value.trim() || state.awayLogo || '';
  patch({
    homeColor: q('#homeColor').value,
    awayColor: q('#awayColor').value,
    homeLogo,
    awayLogo
  });
  selectedHomeLogo = homeLogo;
  selectedAwayLogo = awayLogo;
  alert('Colores y logos aplicados al marcador.');
};

q('#applyTemplate').onclick = () => patch({ template: q('#template').value, accent: q('#accent').value });
q('#resetMatch').onclick = () => {
  if (!confirm('¿Reiniciar marcador y gráficos?')) return;
  patch({ ...defaultState, sponsors: state.sponsors, scenePresets: state.scenePresets, activeSponsorId: null });
};
q('#exitBtn').onclick = () => { location.href = './'; };

renderLogoPreview();
render();
syncStatus();
