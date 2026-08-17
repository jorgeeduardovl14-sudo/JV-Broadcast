const q = (selector) => document.querySelector(selector);
const code = q('#matchCode');
const template = q('#template');
const cleanMatch = q('#cleanMatch');
const LIBRARY_KEY = 'jv:sponsorLibrary:v9';
let selectedLogo = '';

function makeCode() {
  return `JV-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn('No se pudo guardar', key, error);
    return false;
  }
}

function readLibrary() {
  try {
    const saved = JSON.parse(localStorage.getItem(LIBRARY_KEY) || 'null');
    return Array.isArray(saved) ? saved.filter(s => !String(s?.id || '').startsWith('demo-')) : [];
  } catch {
    return [];
  }
}

let library = readLibrary();
safeSet(LIBRARY_KEY, JSON.stringify(library));

function saveLibrary() {
  safeSet(LIBRARY_KEY, JSON.stringify(library));
  renderLibrary();
}

function renderLibrary() {
  const list = q('#preSponsorList');
  if (!library.length) {
    list.innerHTML = '<p class="hint">No hay patrocinadores guardados.</p>';
    return;
  }
  list.innerHTML = library.map((s, i) => `
    <article class="pre-sponsor-item">
      <div class="pre-sponsor-logo">${s.logo ? `<img src="${s.logo}" alt="">` : '<span>LOGO</span>'}</div>
      <div><b>${escapeHtml(s.name)}</b><small>${escapeHtml(s.text || '')}</small></div>
      <button class="small danger" data-remove-pre="${i}" aria-label="Eliminar">×</button>
    </article>`).join('');
  document.querySelectorAll('[data-remove-pre]').forEach((button) => {
    button.onclick = () => {
      library.splice(Number(button.dataset.removePre), 1);
      saveLibrary();
    };
  });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

function updatePreview() {
  q('#preLogoPreview').innerHTML = selectedLogo ? `<img src="${selectedLogo}" alt="Vista previa">` : '<span>Vista previa</span>';
}

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
  const ratio = Math.min(1, 520 / image.naturalWidth, 300 / image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.76);
}

q('#preSponsorFile').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    selectedLogo = await optimizeLogoFile(file);
    updatePreview();
  } catch (error) {
    alert(error.message || 'No se pudo cargar el logo.');
    event.target.value = '';
  }
});

q('#preSponsorUrl').addEventListener('input', (event) => {
  if (event.target.value.trim()) {
    selectedLogo = event.target.value.trim();
    updatePreview();
  }
});

q('#savePreSponsor').onclick = () => {
  const name = q('#preSponsorName').value.trim();
  if (!name) return alert('Escribe el nombre del patrocinador.');
  library.push({
    id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    text: q('#preSponsorText').value.trim(),
    logo: selectedLogo || q('#preSponsorUrl').value.trim(),
    weight: 1
  });
  saveLibrary();
  q('#preSponsorName').value = '';
  q('#preSponsorText').value = '';
  q('#preSponsorUrl').value = '';
  q('#preSponsorFile').value = '';
  selectedLogo = '';
  updatePreview();
};

q('#restoreDemo').onclick = () => {
  if (!confirm('¿Borrar todos los patrocinadores guardados en este dispositivo?')) return;
  library = [];
  saveLibrary();
};

q('#newCode').onclick = () => { code.value = makeCode(); };

function cleanCode(value) {
  return value.trim().replace(/[^a-z0-9-]/gi, '-').toUpperCase();
}

function prepareMatch(match) {
  const stateKey = `jv:state:${match}`;
  const baseState = {
    homeName: 'Santa Bárbara', awayName: 'Visitante', homeScore: 0, awayScore: 0,
    setNumber: 1, setResults: [], serve: 'home', scoreVisible: true,
    sponsorIndex: library.length ? 0 : -1,
    sponsorVisible: false, sponsorFullscreen: false,
    lowerVisible: false, sceneVisible: false,
    scenePresets: {
      upcoming: { title: 'Próximamente', subtitle: 'La transmisión comenzará en breve' },
      live: { title: 'Partido en vivo', subtitle: 'Voleibol nacional' },
      timeout: { title: 'Tiempo técnico', subtitle: 'Volvemos en breve' },
      between: { title: 'Entre sets', subtitle: 'Preparando el siguiente set' },
      final: { title: 'Final del partido', subtitle: 'Gracias por acompañarnos' }
    },
    accent: '#20d3a6', template: template.value, updatedAt: Date.now()
  };

  // El estado del partido se guarda sin duplicar imágenes pesadas.
  // La biblioteca se conserva por separado y el control la incorpora al entrar.
  if (cleanMatch.checked) {
    safeSet(stateKey, JSON.stringify(baseState));
  } else {
    let existing = {};
    try { existing = JSON.parse(localStorage.getItem(stateKey) || '{}'); } catch {}
    safeSet(stateKey, JSON.stringify({ ...baseState, ...existing, template: template.value }));
  }
  safeSet(`jv:template:${match}`, template.value);
  safeSet(`jv:preSponsors:${match}`, JSON.stringify(library));
}

function go(role) {
  const match = cleanCode(code.value);
  if (!match) return alert('Escribe un código de partido.');
  prepareMatch(match);
  location.href = `${role}.html?match=${encodeURIComponent(match)}`;
}

q('#cameraBtn').onclick = () => go('studio');
q('#controlBtn').onclick = () => go('control');

code.value = makeCode();
renderLibrary();
updatePreview();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
