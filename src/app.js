import { buildPrintPages } from './print.js?v=20';
import { createZip } from './zip.js';

const $ = (selector, root = document) => root.querySelector(selector);
const listEl = $('#memberList');
const emptyState = $('#emptyState');
const emptyTitle = $('#emptyTitle');
const emptyMessage = $('#emptyMessage');
const template = $('#memberRowTemplate');
const photoExportBtn = $('#photoExportBtn');
const printBtn = $('#printBtn');
const searchInput = $('#searchInput');
const selectionCount = $('#selectionCount');
const inputSelectBtn = $('#inputSelectBtn');
const selectAllBtn = $('#selectAllBtn');
const clearAllBtn = $('#clearAllBtn');
const jsonImportBtn = $('#jsonImportBtn');
const jsonExportBtn = $('#jsonExportBtn');
const jsonImportInput = $('#jsonImportInput');
const inputSelectDialog = $('#inputSelectDialog');
const inputSelectText = $('#inputSelectText');
const inputSelectResult = $('#inputSelectResult');
const inputSelectApplyBtn = $('#inputSelectApplyBtn');
const inputSelectCancelBtn = $('#inputSelectCancelBtn');
const inputSelectCloseBtn = $('#inputSelectCloseBtn');
const printRoot = $('#printRoot');

let members = [];
const selectedIds = new Set();

function isForeignMember(member) {
  const name = member.nameJa;
  const hasLatin = /[A-Za-z]/.test(name);
  const hasJapanese = /[\u3040-\u30ff\u3400-\u9fff]/.test(name);
  return hasLatin && !hasJapanese;
}

function katakanaToHiragana(value) {
  return String(value || '').replace(/[\u30a1-\u30f6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

const ROMAJI_TO_HIRAGANA = new Map(Object.entries({
  kya:'きゃ', kyu:'きゅ', kyo:'きょ',
  gya:'ぎゃ', gyu:'ぎゅ', gyo:'ぎょ',
  sha:'しゃ', shu:'しゅ', sho:'しょ',
  sya:'しゃ', syu:'しゅ', syo:'しょ',
  ja:'じゃ', ju:'じゅ', jo:'じょ',
  jya:'じゃ', jyu:'じゅ', jyo:'じょ',
  cha:'ちゃ', chu:'ちゅ', cho:'ちょ',
  cya:'ちゃ', cyu:'ちゅ', cyo:'ちょ',
  tya:'ちゃ', tyu:'ちゅ', tyo:'ちょ',
  nya:'にゃ', nyu:'にゅ', nyo:'にょ',
  hya:'ひゃ', hyu:'ひゅ', hyo:'ひょ',
  bya:'びゃ', byu:'びゅ', byo:'びょ',
  pya:'ぴゃ', pyu:'ぴゅ', pyo:'ぴょ',
  mya:'みゃ', myu:'みゅ', myo:'みょ',
  rya:'りゃ', ryu:'りゅ', ryo:'りょ',
  fa:'ふぁ', fi:'ふぃ', fe:'ふぇ', fo:'ふぉ',
  va:'ゔぁ', vi:'ゔぃ', vu:'ゔ', ve:'ゔぇ', vo:'ゔぉ',
  shi:'し', chi:'ち', tsu:'つ',
  si:'し', ti:'ち', tu:'つ', hu:'ふ',
  ji:'じ', zi:'じ',
  a:'あ', i:'い', u:'う', e:'え', o:'お',
  ka:'か', ki:'き', ku:'く', ke:'け', ko:'こ',
  ga:'が', gi:'ぎ', gu:'ぐ', ge:'げ', go:'ご',
  sa:'さ', su:'す', se:'せ', so:'そ',
  za:'ざ', zu:'ず', ze:'ぜ', zo:'ぞ',
  ta:'た', te:'て', to:'と',
  da:'だ', di:'ぢ', du:'づ', de:'で', do:'ど',
  na:'な', ni:'に', nu:'ぬ', ne:'ね', no:'の',
  ha:'は', hi:'ひ', fu:'ふ', he:'へ', ho:'ほ',
  ba:'ば', bi:'び', bu:'ぶ', be:'べ', bo:'ぼ',
  pa:'ぱ', pi:'ぴ', pu:'ぷ', pe:'ぺ', po:'ぽ',
  ma:'ま', mi:'み', mu:'む', me:'め', mo:'も',
  ya:'や', yu:'ゆ', yo:'よ',
  ra:'ら', ri:'り', ru:'る', re:'れ', ro:'ろ',
  wa:'わ', wi:'ゐ', we:'ゑ', wo:'を',
  n:'ん'
}));

function normalizeRomaji(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/[^A-Za-z'-]/g, '')
    .toLowerCase();
}

function romajiToHiragana(value) {
  let source = normalizeRomaji(value);
  if (!source) return '';

  source = source
    .replace(/ō/g, 'o')
    .replace(/ū/g, 'u')
    .replace(/ā/g, 'a')
    .replace(/ī/g, 'i')
    .replace(/ē/g, 'e');

  let result = '';
  let i = 0;

  while (i < source.length) {
    if (source[i] === '-' || source[i] === "'") {
      i += 1;
      continue;
    }

    // Hepburn の長音表記 "oh"（例: Ohno）を「お」と同等に扱う。
    if (i > 0 && source[i] === 'h' && source[i - 1] === 'o') {
      i += 1;
      continue;
    }

    // 促音: Hattori -> はっとり
    if (
      i + 1 < source.length &&
      source[i] === source[i + 1] &&
      /[bcdfghjklmpqrstvwxyz]/.test(source[i]) &&
      source[i] !== 'n'
    ) {
      result += 'っ';
      i += 1;
      continue;
    }

    // 撥音の m 表記: Namba -> なんば
    if (
      source[i] === 'm' &&
      i + 1 < source.length &&
      /[bmp]/.test(source[i + 1])
    ) {
      result += 'ん';
      i += 1;
      continue;
    }

    // n が母音/y以外の前、または語末なら「ん」。
    if (
      source[i] === 'n' &&
      (
        i === source.length - 1 ||
        source[i + 1] === "'" ||
        !/[aiueoy]/.test(source[i + 1])
      )
    ) {
      result += 'ん';
      i += 1;
      if (source[i] === "'") i += 1;
      continue;
    }

    let matched = false;
    for (const length of [3, 2, 1]) {
      const part = source.slice(i, i + length);
      const kana = ROMAJI_TO_HIRAGANA.get(part);
      if (kana) {
        result += kana;
        i += length;
        matched = true;
        break;
      }
    }

    if (!matched) return '';
  }

  return result;
}

function japaneseSurnameText(member) {
  return String(member.nameJa || '').trim().split(/\s+/)[0] || '';
}

function inferJapaneseSurnameRomaji(member) {
  const tokens = String(member.nameEn || '')
    .trim()
    .split(/\s+/)
    .map(token => token.replace(/^[^A-Za-z]+|[^A-Za-z'-]+$/g, ''))
    .filter(Boolean);

  if (!tokens.length) return '';

  // 現行データの「MIZUTANI Sam」のような姓の大文字表記を最優先。
  const uppercaseSurname = tokens.find(token =>
    /[A-Z]/.test(token) &&
    token === token.toUpperCase() &&
    /^[A-Z'-]+$/.test(token)
  );
  if (uppercaseSurname) return uppercaseSurname;

  // "Miho Oka Macleod" のような表記では、
  // ローマ字として日本語読みできる語のうち最後のものを姓とみなす。
  const japaneseLikeTokens = tokens.filter(token => romajiToHiragana(token));
  if (japaneseLikeTokens.length) {
    return japaneseLikeTokens[japaneseLikeTokens.length - 1];
  }

  return tokens[0];
}

function japaneseSurnameSortKey(member) {
  const surnameJa = japaneseSurnameText(member);

  // ひらがな・カタカナの姓は日本語表記そのものを読みとして使う。
  if (surnameJa && /^[\u3040-\u30ffー]+$/.test(surnameJa)) {
    return katakanaToHiragana(surnameJa);
  }

  const surnameRomaji = inferJapaneseSurnameRomaji(member);
  return romajiToHiragana(surnameRomaji) || surnameRomaji.toLocaleLowerCase('en');
}

function foreignFirstNameSortKey(member) {
  return String(member.nameJa || '')
    .trim()
    .split(/\s+/)[0]
    .toLocaleLowerCase('en');
}

function normalizeMatchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('ja');
}

function compactMatchText(value) {
  return normalizeMatchText(value).replace(/[\s/／・,，]+/g, '');
}

function lineMatchesMember(line, member) {
  const normalizedLine = normalizeMatchText(line);
  const compactLine = compactMatchText(line);
  const names = isForeignMember(member)
    ? [member.nameJa]
    : [member.nameJa, member.nameEn];

  return names.some(name => {
    const normalizedName = normalizeMatchText(name);
    const compactName = compactMatchText(name);
    return normalizedName && (
      normalizedLine.includes(normalizedName) ||
      compactLine.includes(compactName)
    );
  });
}

function normalizeColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : '';
}

function normalizePhotoPath(value) {
  return String(value || '').trim();
}

function normalizeMember(raw, index) {
  return {
    id: String(raw?.id || raw?.filename || `member-${index + 1}`),
    nameJa: String(raw?.name ?? raw?.nameJa ?? '').trim(),
    nameEn: String(raw?.nameEn ?? '').trim(),
    photo: normalizePhotoPath(raw?.photo),
    filename: String(raw?.filename ?? '').trim(),
    badgeText: String(raw?.badgeText ?? '').trim(),
    bandColor: normalizeColor(raw?.bandColor),
  };
}

function assetUrl(path) {
  if (!path) return '';
  if (/^(?:https?:|data:|blob:)/i.test(path)) return path;
  if (path.startsWith('/')) return path;
  return new URL(path, document.baseURI).href;
}

function findMember(id) {
  return members.find(member => member.id === id);
}

function selectedMembers() {
  return members.filter(member => selectedIds.has(member.id));
}

function searchText(member) {
  return `${member.nameJa} ${member.nameEn} ${member.badgeText}`.toLocaleLowerCase('ja');
}

function currentQuery() {
  return searchInput.value.trim().toLocaleLowerCase('ja');
}

function isVisibleMember(member) {
  const query = currentQuery();
  return !query || searchText(member).includes(query);
}

function updateSelectionUi() {
  const hasMembers = members.length > 0;
  const hasSelection = selectedIds.size > 0;
  selectionCount.textContent = `選択${selectedIds.size}名`;
  inputSelectBtn.disabled = !hasMembers;
  selectAllBtn.disabled = !hasMembers;
  jsonImportBtn.disabled = !hasMembers;
  jsonExportBtn.disabled = !hasMembers;
  photoExportBtn.disabled = !hasSelection;
  printBtn.disabled = !hasSelection;
  clearAllBtn.disabled = !hasSelection;
}

function setBandColor(member, row, color) {
  member.bandColor = normalizeColor(color);

  row.querySelectorAll('.color-presets button').forEach(button => {
    const buttonColor = normalizeColor(button.dataset.color);
    button.classList.toggle('active', buttonColor === member.bandColor);
  });
}

function renderPhoto(member, row) {
  const image = $('.member-photo', row);
  const placeholder = $('.photo-placeholder', row);

  if (member.photo) {
    image.src = assetUrl(member.photo);
    image.alt = member.filename || `${member.nameJa} 顔写真`;
    image.title = member.filename || '';
    image.hidden = false;
    placeholder.hidden = true;
  } else {
    image.removeAttribute('src');
    image.hidden = true;
    placeholder.hidden = false;
  }
}

function bindMemberRow(member, row) {
  row.dataset.memberId = member.id;

  $('.member-name-ja', row).textContent = member.nameJa;
  $('.member-name-en', row).textContent = member.nameEn;

  const printCheck = $('.print-check', row);
  const badgeText = $('.badge-text', row);

  printCheck.checked = selectedIds.has(member.id);
  badgeText.value = member.badgeText;

  renderPhoto(member, row);
  setBandColor(member, row, member.bandColor);

  printCheck.addEventListener('change', () => {
    if (printCheck.checked) selectedIds.add(member.id);
    else selectedIds.delete(member.id);
    updateSelectionUi();
  });

  badgeText.addEventListener('input', () => {
    member.badgeText = badgeText.value;
    applySearch();
  });

  row.querySelectorAll('.color-presets button').forEach(button => {
    button.addEventListener('click', () => setBandColor(member, row, button.dataset.color));
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

function syncSelectionCheckboxes() {
  listEl.querySelectorAll('.member-row').forEach(row => {
    const check = $('.print-check', row);
    if (check) check.checked = selectedIds.has(row.dataset.memberId);
  });
}

function clearAllSelections() {
  selectedIds.clear();
  syncSelectionCheckboxes();
  updateSelectionUi();
}

function selectAllMembers() {
  members.forEach(member => selectedIds.add(member.id));
  syncSelectionCheckboxes();
  updateSelectionUi();
}

function openInputSelectDialog() {
  inputSelectText.value = '';
  inputSelectResult.hidden = true;
  inputSelectResult.textContent = '';
  inputSelectDialog.showModal();
  requestAnimationFrame(() => inputSelectText.focus());
}

function closeInputSelectDialog() {
  if (inputSelectDialog.open) inputSelectDialog.close();
}

function applyInputSelection() {
  const lines = inputSelectText.value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    inputSelectResult.hidden = false;
    inputSelectResult.textContent = '選手リストを入力してください。';
    return;
  }

  selectedIds.clear();
  const unmatched = [];

  lines.forEach(line => {
    const member = members.find(candidate => lineMatchesMember(line, candidate));
    if (member) selectedIds.add(member.id);
    else unmatched.push(line);
  });

  syncSelectionCheckboxes();
  updateSelectionUi();

  if (unmatched.length) {
    inputSelectResult.hidden = false;
    inputSelectResult.textContent =
      `プリセットにない選手（${unmatched.length}名）\n` +
      unmatched.join('\n');
    return;
  }

  closeInputSelectDialog();
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportJsonSettings() {
  if (!members.length) return;

  const payload = {
    format: 'jbs-player-material-settings',
    version: 1,
    members: members.map(member => ({
      id: member.id,
      filename: member.filename,
      name: member.nameJa,
      nameEn: member.nameEn,
      selected: selectedIds.has(member.id),
      badgeText: member.badgeText,
      bandColor: member.bandColor,
    })),
  };

  const json = JSON.stringify(payload, null, 2) + '\n';
  triggerDownload(
    new Blob([json], { type: 'application/json;charset=utf-8' }),
    '選手素材設定.json'
  );
}

function findMemberForImportedSetting(setting) {
  const importedId = String(setting?.id || '').trim();
  const importedFilename = String(setting?.filename || '').trim();
  const importedName = String(setting?.name ?? setting?.nameJa ?? '').trim();
  const importedNameEn = String(setting?.nameEn ?? '').trim();

  return members.find(member =>
    (importedId && member.id === importedId) ||
    (importedFilename && member.filename === importedFilename) ||
    (
      importedName &&
      importedNameEn &&
      member.nameJa === importedName &&
      member.nameEn === importedNameEn
    )
  );
}

async function importJsonSettings(file) {
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    const importedMembers = Array.isArray(data) ? data : data?.members;

    if (!Array.isArray(importedMembers)) {
      throw new Error('JSONの形式が正しくありません。');
    }

    selectedIds.clear();
    const unmatched = [];

    importedMembers.forEach(setting => {
      const member = findMemberForImportedSetting(setting);
      if (!member) {
        const label =
          String(setting?.name || setting?.nameJa || setting?.filename || setting?.id || '').trim() ||
          '不明な選手';
        unmatched.push(label);
        return;
      }

      if (setting.selected === true) selectedIds.add(member.id);

      if (Object.prototype.hasOwnProperty.call(setting, 'badgeText')) {
        member.badgeText = String(setting.badgeText ?? '').trim();
      }

      if (Object.prototype.hasOwnProperty.call(setting, 'bandColor')) {
        member.bandColor = normalizeColor(setting.bandColor);
      }
    });

    renderList();

    if (unmatched.length) {
      alert(
        `JSONを取り込みました。\n現在の選手素材に見つからない選手（${unmatched.length}名）\n` +
        unmatched.join('\n')
      );
    }
  } catch (error) {
    console.error(error);
    alert(error.message || 'JSONの取込に失敗しました。');
  } finally {
    jsonImportInput.value = '';
  }
}

async function exportSelectedPhotos() {
  const selected = selectedMembers();
  if (!selected.length) return;

  photoExportBtn.disabled = true;
  const originalText = photoExportBtn.textContent;
  photoExportBtn.textContent = '作成中…';

  try {
    if (selected.length === 1) {
      const member = selected[0];
      const response = await fetch(assetUrl(member.photo), { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`${member.filename || member.nameJa} の取得に失敗しました (${response.status})`);
      }

      const filename = member.filename || member.photo.split('/').pop() || `${member.nameJa}.png`;
      triggerDownload(await response.blob(), filename);
      return;
    }

    const files = [];
    for (const member of selected) {
      const response = await fetch(assetUrl(member.photo), { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`${member.filename || member.nameJa} の取得に失敗しました (${response.status})`);
      }
      files.push({
        name: member.filename || member.photo.split('/').pop() || `${member.nameJa}.png`,
        data: new Uint8Array(await response.arrayBuffer()),
      });
    }

    triggerDownload(createZip(files), '顔写真.zip');
  } catch (error) {
    console.error(error);
    alert(error.message || '顔写真の出力に失敗しました。');
  } finally {
    photoExportBtn.textContent = originalText;
    updateSelectionUi();
  }
}

async function loadMembers() {
  const dataUrl = new URL('../data/members.json?v=28', import.meta.url);
  const response = await fetch(dataUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`会員一覧の取得に失敗しました (${response.status})`);
  }

  const data = await response.json();
  const source = Array.isArray(data) ? data : data?.members;
  if (!Array.isArray(source)) {
    throw new Error('自動生成された会員一覧の形式が正しくありません。');
  }

  const jaCollator = new Intl.Collator('ja', { sensitivity: 'base', numeric: true });
  const enCollator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

  members = source
    .map(normalizeMember)
    .filter(member => member.nameJa && member.nameEn && member.photo)
    .sort((a, b) => {
      const aForeign = isForeignMember(a);
      const bForeign = isForeignMember(b);

      // 日本語名の選手を先に、英語名のみの選手を後ろにまとめる。
      if (aForeign !== bForeign) return aForeign ? 1 : -1;

      if (!aForeign) {
        // 日本人: 日本語名で姓を特定し、英語表記から姓のローマ字を推定。
        // その読みをひらがな化して五十音順に並べる。
        const bySurname = jaCollator.compare(
          japaneseSurnameSortKey(a),
          japaneseSurnameSortKey(b)
        );
        if (bySurname !== 0) return bySurname;

        // 同姓の場合は英語名→日本語名で安定ソート。
        const byEnglish = enCollator.compare(a.nameEn, b.nameEn);
        if (byEnglish !== 0) return byEnglish;
        return jaCollator.compare(a.nameJa, b.nameJa);
      }

      // 英語名のみ: ファーストネーム（先頭語）でABC順。
      const byFirstName = enCollator.compare(
        foreignFirstNameSortKey(a),
        foreignFirstNameSortKey(b)
      );
      if (byFirstName !== 0) return byFirstName;
      return enCollator.compare(a.nameJa, b.nameJa);
    });
}

searchInput.addEventListener('input', applySearch);
inputSelectBtn.addEventListener('click', openInputSelectDialog);
selectAllBtn.addEventListener('click', selectAllMembers);
clearAllBtn.addEventListener('click', clearAllSelections);
jsonImportBtn.addEventListener('click', () => jsonImportInput.click());
jsonExportBtn.addEventListener('click', exportJsonSettings);
jsonImportInput.addEventListener('change', () => {
  const [file] = jsonImportInput.files || [];
  importJsonSettings(file);
});
inputSelectApplyBtn.addEventListener('click', applyInputSelection);
inputSelectCancelBtn.addEventListener('click', closeInputSelectDialog);
inputSelectCloseBtn.addEventListener('click', closeInputSelectDialog);
photoExportBtn.addEventListener('click', exportSelectedPhotos);

printBtn.addEventListener('click', () => {
  const selected = selectedMembers();
  if (!selected.length) return;
  buildPrintPages(printRoot, selected);
  requestAnimationFrame(() => window.print());
});

window.addEventListener('afterprint', () => printRoot.replaceChildren());

try {
  await loadMembers();
  renderList();
} catch (error) {
  console.error(error);
  members = [];
  emptyTitle.textContent = '会員情報を読み込めませんでした。';
  emptyMessage.textContent = error.message || 'images/ のファイル名を確認してください。';
  emptyState.hidden = false;
  updateSelectionUi();
}
