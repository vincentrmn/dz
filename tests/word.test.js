// Tests ciblés du cockpit : ce qui a déjà cassé (voir .claude/rules/cockpit.md).
// Lancés par `npm test` (node --test), sans réseau ni serveur.
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = path.join(os.tmpdir(), 'dz-tests-' + process.pid);
const { htmlPourWord, forcerWordModerne, MOIS_RE, SEUIL_VIDE } = require('../server');

test('Word : un saut de page est inséré devant chaque jour, et le contenu du jour est conservé', () => {
  const html = '<div class="jour"><h2>Lundi</h2><p>A</p></div><div class="jour"><h2>Mardi</h2><p>B</p></div>';
  const out = htmlPourWord(html);
  assert.equal((out.match(/<div class="page-break"><\/div><div class="jour">/g) || []).length, 2);
  assert.ok(out.includes('<h2>Lundi</h2><p>A</p>') && out.includes('<h2>Mardi</h2><p>B</p>'));
  assert.ok(!/page-break-after/.test(out), 'jamais page-break-after sur le div du jour');
});

test('Word : les icônes de chapitre sont inlinées avec une largeur en style, jamais en attribut', () => {
  const html = '<img class="ico" src="https://cockpit/icons/equipes.png" width="96" height="96">';
  const out = htmlPourWord(html);
  assert.ok(out.startsWith('<img src="data:image/png;base64,'));
  assert.ok(out.includes('style="width:14px;height:14px'));
  assert.ok(!/width="96"/.test(out));
});

test('Word : les photos reçoivent une largeur en style (ratio conservé)', () => {
  const out = htmlPourWord('<div class="photos"><img src="a.jpg"><img src="b.jpg"></div>');
  assert.equal((out.match(/<img style="width:330px" /g) || []).length, 2);
});

test('Word : le docx sort en mode moderne (compatibilityMode=15) et un buffer non docx est rendu tel quel', async () => {
  const JSZip = require('jszip');
  const zip = new JSZip();
  zip.file('word/settings.xml', '<w:settings></w:settings>');
  const brut = await zip.generateAsync({ type: 'nodebuffer' });
  const moderne = await JSZip.loadAsync(await forcerWordModerne(brut));
  assert.ok((await moderne.file('word/settings.xml').async('string')).includes('w:val="15"'));
  const autre = Buffer.from('pas un zip');
  assert.equal((await forcerWordModerne(autre)).toString(), 'pas un zip');
});

test('Archives : seuls les rapports mensuels entrent dans le ZIP, pas les hebdomadaires', () => {
  assert.ok(MOIS_RE.test('22.06-Gaichel-Maisons__2026-03-01_2026-03-31.pdf'));
  assert.ok(MOIS_RE.test('25.07_Ecole-Brouch-E_A__2026-02-01_2026-02-28.docx'));
  assert.ok(!MOIS_RE.test('22.06-Gaichel-Maisons__2026-07-06_2026-07-12.pdf'), 'hebdo écarté');
  assert.ok(!MOIS_RE.test('22.06-Gaichel-Maisons__2026-03-01_2026-03-31.html'), 'aperçu HTML écarté');
  assert.equal(SEUIL_VIDE, 92000);
});
