// Rapports du jour : rattachement de chaque jour à sa semaine (GET /api/reports)
// et archives mensuelles qui les ignorent. Lancés par `npm test`, sans réseau.
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = path.join(os.tmpdir(), 'dz-tests-rapports-' + process.pid);
const { rattacherJours, MOIS_RE } = require('../server');

// Un fichier tel que le rend GET /api/reports avant le rattachement.
const f = (chantier, periode, type = 'pdf') => ({ fichier: `${chantier}__${periode}.${type}`, chantier, periode, type });
const semaineDe = (liste, chantier, periode) =>
  liste.filter((x) => x.chantier === chantier && x.periode === periode).map((x) => x.semaine);

test('Rapports du jour : chaque jour est rattaché à sa semaine lundi → dimanche, pour tous ses formats', () => {
  const entree = [
    f('22.06A Gaichel', '2026-11-16_2026-11-22', 'pdf'),
    f('22.06A Gaichel', '2026-11-16_2026-11-22', 'docx'),
    ...['16', '17', '18', '19', '20', '21'].flatMap((j) =>
      ['pdf', 'docx', 'html'].map((t) => f('22.06A Gaichel', `2026-11-${j}_2026-11-${j}`, t))),
  ];
  const sortie = rattacherJours(entree);
  assert.equal(sortie.length, entree.length, 'aucun fichier perdu ni ajouté');
  for (const j of ['16', '17', '18', '19', '20', '21']) {
    assert.deepEqual(semaineDe(sortie, '22.06A Gaichel', `2026-11-${j}_2026-11-${j}`),
      ['2026-11-16_2026-11-22', '2026-11-16_2026-11-22', '2026-11-16_2026-11-22']);
  }
  assert.deepEqual(semaineDe(sortie, '22.06A Gaichel', '2026-11-16_2026-11-22'), [undefined, undefined],
    'la semaine elle-même n’a pas de champ semaine');
});

test('Rapports du jour : un jour isolé reste seul (pas de semaine, autre chantier, mois)', () => {
  const sortie = rattacherJours([
    f('22.06A Gaichel', '2026-11-25_2026-11-25'),
    f('22.06A Gaichel', '2026-11-01_2026-11-30'),
    f('22.06A Gaichel', '2026-11-12_2026-11-12'),
    f('26.07 MaisonFluhe', '2026-11-09_2026-11-15'),
  ]);
  assert.equal(sortie[0].semaine, undefined, 'aucune période ne contient le 25/11');
  assert.equal(sortie[2].semaine, undefined, 'un mois (plus de 7 jours) n’est pas une semaine, la semaine d’un autre chantier non plus');
  assert.ok(!('semaine' in sortie[1]) && !('semaine' in sortie[3]));
});

test('Rapports du jour : la semaine lundi → dimanche passe avant une période libre qui contient aussi le jour', () => {
  const sortie = rattacherJours([
    f('22.06A Gaichel', '2026-11-18_2026-11-20'),
    f('22.06A Gaichel', '2026-11-17_2026-11-23'),
    f('22.06A Gaichel', '2026-11-16_2026-11-22'),
    f('22.06A Gaichel', '2026-11-19_2026-11-19'),
    f('22.06A Gaichel', '2026-11-23_2026-11-23'),
    f('22.06A Gaichel', '2026-11-24_2026-11-24'),
  ]);
  assert.equal(sortie[3].semaine, '2026-11-16_2026-11-22');
  assert.equal(sortie[4].semaine, '2026-11-17_2026-11-23', 'à défaut de lundi → dimanche, la période libre qui le contient');
  assert.equal(sortie[5].semaine, undefined);
});

test('Archives : le ZIP ignore les rapports du jour, y compris le 1er et le dernier du mois', () => {
  assert.ok(!MOIS_RE.test('22.06A_Gaichel-Maisons__2026-11-18_2026-11-18.pdf'));
  assert.ok(!MOIS_RE.test('22.06A_Gaichel-Maisons__2026-11-01_2026-11-01.pdf'));
  assert.ok(!MOIS_RE.test('22.06A_Gaichel-Maisons__2026-11-30_2026-11-30.docx'));
  assert.ok(MOIS_RE.test('22.06A_Gaichel-Maisons__2026-11-01_2026-11-30.pdf'), 'le mois, lui, reste dans le ZIP');
});
