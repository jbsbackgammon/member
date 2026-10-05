import { deleteMember, getAllMembers, putMember, replaceAllMembers } from './db.js';
import { buildPrintPages } from './print.js';

const $ = (selector, root = document) => root.querySelector(selector);
const listEl = $('#memberList');
const emptyState = $('#emptyState');
const template = $('#memberRowTemplate');
const addMemberBtn = $('#addMemberBtn');
const printBtn = $('#printBtn');
const selectedCount = $('#selectedCount');
const searchInput = $('#searchInput');
const selectVisibleBtn = $('#selectVisibleBtn');
const exportBtn = $('#exportBtn');
const importInput = $('#importInput');
const printRoot = $('#printRoot');

let members = [];
const selectedIds = new Set();

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyMember(sortIndex) {
  return {
    id: newId(),
    sortIndex,
    nameJa: '',
    nameEn: '',
    badgeText: '',
    bandColor: '',
    photos: [],
    mainPhotoId: null,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeMember(raw, index) {
  return {
    id: String(raw.id || newId()),
    sortIndex: Number.isFinite(raw.sortIndex) ? raw.sortIndex : index,
    nameJa: String(raw.nameJa || ''),
    nameEn: String(raw.nameEn || ''),
    badgeText: String(raw.badgeText || ''),
    bandColor: /^#[0-9a-f]{6}$/i.test(raw.bandColor || '') ? raw.bandColor : '',
    photos: Array.isArray(raw.photos) ? raw.photos
      .filter(p => p && typeof p.dataUrl === 'string' && p.dataUrl.startsWith('data:image/'))
      .map(p => ({ id: String(p.id || newId()), filename: String(p.filename || ''), dataUrl: p.dataUrl })) : [],
    mainPhotoId: raw.mainPhotoId ? String(raw.mainPhotoId) : null,
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

function findMember(id) {
  return members.find(m => m.id === id);
}

async function saveMember(member) {
  member.updatedAt = new Date().toISOString();
  await putMember(member);
}

function escapeSearch(member) {
  return `${member.nameJa} ${member.nameEn} ${member.badgeText}`.toLocaleLowerCase('ja');
}

function currentQuery() {
  return searchInput.value.trim().toLocaleLowerCase('ja');
}

function isVisibleMember(member) {
  const q = currentQuery();
  return !q || escapeSearch(member).includes(q);
}

function updateSelectionUi() {
  selectedCount.textContent = String(selectedIds.size);
  printBtn.disabled = selectedIds.size === 0;
  const visible = members.filter(isVisibleMember);
  const allVisibleSelected = visible.length > 0 && visible.every(m => selectedIds.has(m.id));
  selectVisibleBtn.textContent = allVisibleSelected ? '表示中を全解除' : '表示中を全選択';
}

function setBandColor(member, row, color) {
  member.bandColor = color;
  const colorInput = $('.band-color', row);
  if (color) colorInput.value = color;
  $('.color-none', row).classList.toggle('active', !color);
  row.querySelectorAll('.color-presets button').forEach(btn => {
    btn.classList.toggle('active', !!color && btn.dataset.color.toLowerCase() === color.toLowerCase());
  });
  saveMember(member);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('画像の読み込みに失敗しました'));
    reader.readAsDataURL(file);
  });
}

function renderPhotos(member, row) {
  const strip = $('.photo-strip', row);
  strip.replaceChildren();
  $('.photo-count', row).textContent = `${member.photos.length}枚`;

  if (member.photos.length && !member.photos.some(p => p.id === member.mainPhotoId)) {
    member.mainPhotoId = member.photos[0].id;
    saveMember(member);
  }

  const main = member.photos.find(p => p.id === member.mainPhotoId) || member.photos[0];
  const mainImg = $('.main-photo', row);
  const placeholder = $('.photo-placeholder', row);
  if (main) {
    mainImg.src = main.dataUrl;
    mainImg.hidden = false;
    placeholder.hidden = true;
  } else {
    mainImg.removeAttribute('src');
    mainImg.hidden = true;
    placeholder.hidden = false;
  }

  for (const photo of member.photos) {
    const thumb = document.createElement('div');
    thumb.className = `photo-thumb${photo.id === member.mainPhotoId ? ' main' : ''}`;
    thumb.title = photo.filename || '顔写真';

    const img = document.createElement('img');
    img.src = photo.dataUrl;
    img.alt = photo.filename || '顔写真';
    thumb.appendChild(img);

    const mainBtn = document.createElement('button');
    mainBtn.type = 'button';
    mainBtn.className = 'photo-main-btn';
    mainBtn.title = 'メイン画像に設定';
    mainBtn.textContent = photo.id === member.mainPhotoId ? '★' : '☆';
    mainBtn.addEventListener('click', async () => {
      member.mainPhotoId = photo.id;
      await saveMember(member);
      renderPhotos(member, row);
    });
    thumb.appendChild(mainBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'photo-delete-btn';
    deleteBtn.title = 'この画像を削除';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', async () => {
      member.photos = member.photos.filter(p => p.id !== photo.id);
      if (member.mainPhotoId === photo.id) member.mainPhotoId = member.photos[0]?.id || null;
      await saveMember(member);
      renderPhotos(member, row);
    });
    thumb.appendChild(deleteBtn);
    strip.appendChild(thumb);
  }
}

function bindMemberRow(member, row) {
  row.dataset.memberId = member.id;
  const printCheck = $('.print-check', row);
  const nameJa = $('.name-ja', row);
  const nameEn = $('.name-en', row);
  const badgeText = $('.badge-text', row);
  const colorInput = $('.band-color', row);

  printCheck.checked = selectedIds.has(member.id);
  nameJa.value = member.nameJa;
  nameEn.value = member.nameEn;
  badgeText.value = member.badgeText;
  if (member.bandColor) colorInput.value = member.bandColor;
  setBandColorUiOnly(member, row);
  renderPhotos(member, row);

  printCheck.addEventListener('change', () => {
    if (printCheck.checked) selectedIds.add(member.id); else selectedIds.delete(member.id);
    updateSelectionUi();
  });

  for (const [input, key] of [[nameJa, 'nameJa'], [nameEn, 'nameEn'], [badgeText, 'badgeText']]) {
    input.addEventListener('change', async () => {
      member[key] = input.value.trim();
      await saveMember(member);
      applySearch();
    });
  }

  $('.photo-input', row).addEventListener('change', async event => {
    const files = [...event.target.files].filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    try {
      const additions = [];
      for (const file of files) {
        additions.push({ id: newId(), filename: file.name, dataUrl: await fileToDataUrl(file) });
      }
      member.photos.push(...additions);
      if (!member.mainPhotoId) member.mainPhotoId = additions[0]?.id || null;
      await saveMember(member);
      renderPhotos(member, row);
    } catch (error) {
      alert(`画像を追加できませんでした。\n${error.message || error}`);
    } finally {
      event.target.value = '';
    }
  });

  $('.color-none', row).addEventListener('click', () => setBandColor(member, row, ''));
  colorInput.addEventListener('input', () => setBandColor(member, row, colorInput.value));
  row.querySelectorAll('.color-presets button').forEach(btn => {
    btn.addEventListener('click', () => setBandColor(member, row, btn.dataset.color));
  });

  $('.delete-member', row).addEventListener('click', async () => {
    const label = member.nameJa || member.nameEn || 'この会員';
    if (!confirm(`${label}を削除しますか？`)) return;
    await deleteMember(member.id);
    members = members.filter(m => m.id !== member.id);
    selectedIds.delete(member.id);
    renderList();
  });
}

function setBandColorUiOnly(member, row) {
  $('.color-none', row).classList.toggle('active', !member.bandColor);
  row.querySelectorAll('.color-presets button').forEach(btn => {
    btn.classList.toggle('active', !!member.bandColor && btn.dataset.color.toLowerCase() === member.bandColor.toLowerCase());
  });
}

function renderList() {
  listEl.replaceChildren();
  emptyState.hidden = members.length !== 0;
  members.forEach(member => {
    const row = template.content.firstElementChild.cloneNode(true);
    bindMemberRow(member, row);
    listEl.appendChild(row);
  });
  applySearch();
}

function applySearch() {
  for (const row of listEl.children) {
    const member = findMember(row.dataset.memberId);
    row.classList.toggle('is-filtered', !member || !isVisibleMember(member));
  }
  updateSelectionUi();
}

addMemberBtn.addEventListener('click', async () => {
  const nextIndex = members.reduce((max, m) => Math.max(max, Number(m.sortIndex) || 0), -1) + 1;
  const member = emptyMember(nextIndex);
  members.push(member);
  await putMember(member);
  renderList();
  const row = listEl.querySelector(`[data-member-id="${CSS.escape(member.id)}"]`);
  row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('.name-ja', row)?.focus();
});

searchInput.addEventListener('input', applySearch);

selectVisibleBtn.addEventListener('click', () => {
  const visible = members.filter(isVisibleMember);
  const allSelected = visible.length > 0 && visible.every(m => selectedIds.has(m.id));
  visible.forEach(m => allSelected ? selectedIds.delete(m.id) : selectedIds.add(m.id));
  for (const row of listEl.children) {
    const checkbox = $('.print-check', row);
    checkbox.checked = selectedIds.has(row.dataset.memberId);
  }
  updateSelectionUi();
});

printBtn.addEventListener('click', () => {
  const selected = members.filter(m => selectedIds.has(m.id));
  if (!selected.length) return;
  buildPrintPages(printRoot, selected);
  requestAnimationFrame(() => window.print());
});

exportBtn.addEventListener('click', () => {
  const payload = {
    format: 'jbs-member',
    version: 1,
    exportedAt: new Date().toISOString(),
    members,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  a.download = `member-backup-${ymd}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

importInput.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (parsed?.format !== 'jbs-member' || !Array.isArray(parsed.members)) {
      throw new Error('会員情報のバックアップJSONではありません。');
    }
    const incoming = parsed.members.map(normalizeMember);
    if (!confirm(`現在のデータを置き換えて、${incoming.length}名を読み込みますか？`)) return;
    await replaceAllMembers(incoming);
    members = incoming;
    selectedIds.clear();
    renderList();
  } catch (error) {
    alert(`JSONを読み込めませんでした。\n${error.message || error}`);
  } finally {
    event.target.value = '';
  }
});

window.addEventListener('afterprint', () => printRoot.replaceChildren());

try {
  members = (await getAllMembers()).map(normalizeMember);
  renderList();
} catch (error) {
  console.error(error);
  alert('会員データを読み込めませんでした。ブラウザのストレージ設定をご確認ください。');
}
