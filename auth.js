/*
 * Authentification Microsoft du Hub Rapport Technique.
 *
 * Flux OpenID Connect « authorization code » avec client confidentiel, sur l'app
 * Entra ID « DZ – Hub Rapport Technique (login) » (single-tenant dzconstruct.lu).
 * Seuls les comptes @dzconstruct.lu du tenant DZ peuvent entrer.
 *
 * Session sans stockage serveur : un cookie signé (HMAC-SHA256) porte l'identité.
 * Le disque du service Railway est éphémère et le service redéploie à chaque push —
 * une session gardée en mémoire serait perdue à chaque déploiement.
 *
 * ⚠️ Filet de sécurité : l'authentification ne s'active QUE si les quatre variables
 * d'environnement sont présentes. Sans elles, le cockpit fonctionne exactement comme
 * avant. C'est ce qui permet de déployer le code d'abord et d'allumer ensuite — et
 * de rouvrir l'accès en retirant une variable si quelque chose se passe mal.
 *
 * Aucune dépendance ajoutée : Node 18+ fournit fetch, crypto et URL.
 */

const crypto = require('crypto');
const express = require('express');

const TENANT = process.env.MS_TENANT_ID || '';
const CLIENT_ID = process.env.MS_CLIENT_ID || '';
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const DOMAINE = (process.env.AUTH_DOMAINE || 'dzconstruct.lu').toLowerCase();
const APP_URL = (process.env.APP_URL || 'https://cockpit-production-c3dc.up.railway.app').replace(/\/+$/, '');

// Les fichiers de rapports sont derrière l'authentification par défaut. Les emails
// hebdomadaires portent le PDF en pièce jointe, les liens ne sont qu'un confort :
// un destinataire DZ se connecte, un destinataire externe reste dehors.
// Passer RAPPORTS_PUBLICS=true pour rouvrir ces liens à tout porteur d'URL.
const RAPPORTS_PUBLICS = process.env.RAPPORTS_PUBLICS === 'true';

// Jeton de service, pour les appels machine qui ne peuvent pas se connecter avec un
// compte Microsoft. Aujourd'hui : le nœud n8n « Télécharger rapport pour email », qui
// récupère le PDF sur /reports/ pour le joindre à l'email hebdomadaire. Sans ce jeton,
// il ramènerait la page de connexion à la place du rapport.
const COCKPIT_TOKEN = process.env.COCKPIT_TOKEN || '';

// Accès de secours par code, pour qui n'a pas de compte dans le tenant DZ — Vincent
// en premier lieu, dont l'adresse korr.lu est extérieure à dzconstruct.lu et serait
// donc refusée par Microsoft en amont, avant même nos contrôles.
// Ne s'affiche et ne fonctionne que si ACCES_SECOURS est posée. Retirer la variable
// referme cette porte.
const ACCES_SECOURS = process.env.ACCES_SECOURS || '';

const actif = Boolean(TENANT && CLIENT_ID && CLIENT_SECRET && SESSION_SECRET);

const AUTORITE = `https://login.microsoftonline.com/${TENANT}`;
const REDIRECT_URI = `${APP_URL}/auth/callback`;
const PORTEE = 'openid profile email User.Read';
const COOKIE_SESSION = 'dz_session';
const COOKIE_TRANSACTION = 'dz_oauth';
const DUREE_SESSION = 8 * 3600; // une journée de travail
const DUREE_TRANSACTION = 10 * 60; // aller-retour chez Microsoft

// ---------------------------------------------------------------------------
// Cookies signés
// ---------------------------------------------------------------------------
const b64u = (v) => Buffer.from(v).toString('base64url');

function signer(charge) {
  const corps = b64u(JSON.stringify(charge));
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(corps).digest('base64url');
  return `${corps}.${sig}`;
}

function verifier(jeton) {
  if (typeof jeton !== 'string') return null;
  const sep = jeton.lastIndexOf('.');
  if (sep <= 0) return null;
  const corps = jeton.slice(0, sep);
  const attendu = crypto.createHmac('sha256', SESSION_SECRET).update(corps).digest('base64url');
  const recu = Buffer.from(jeton.slice(sep + 1));
  const ref = Buffer.from(attendu);
  // Comparaison à temps constant : une comparaison naïve fuiterait la signature
  // octet par octet.
  if (recu.length !== ref.length || !crypto.timingSafeEqual(recu, ref)) return null;
  try {
    const charge = JSON.parse(Buffer.from(corps, 'base64url').toString('utf8'));
    if (!charge || !charge.exp || charge.exp < Math.floor(Date.now() / 1000)) return null;
    return charge;
  } catch {
    return null;
  }
}

function lireCookies(req) {
  const out = {};
  for (const morceau of String(req.headers.cookie || '').split(';')) {
    const i = morceau.indexOf('=');
    if (i > 0) {
      try {
        out[morceau.slice(0, i).trim()] = decodeURIComponent(morceau.slice(i + 1).trim());
      } catch {
        /* cookie illisible : ignoré */
      }
    }
  }
  return out;
}

function poserCookie(res, nom, valeur, dureeSecondes) {
  const parts = [`${nom}=${encodeURIComponent(valeur)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Secure'];
  parts.push(`Max-Age=${dureeSecondes > 0 ? dureeSecondes : 0}`);
  res.append('Set-Cookie', parts.join('; '));
}

// ---------------------------------------------------------------------------
// Jeton d'identité
// ---------------------------------------------------------------------------
// La signature de l'id_token n'est pas revérifiée : il est récupéré directement
// auprès du point de terminaison de Microsoft, en HTTPS, avec le secret client.
// OpenID Connect Core §3.1.3.7 autorise explicitement à s'en passer dans ce cas
// précis (flux code, client confidentiel). On valide en revanche l'émetteur,
// l'audience, le tenant, l'expiration et le nonce — c'est ce qui compte ici.
function chargeIdToken(idToken) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Page de connexion (autonome : elle doit s'afficher même sans session)
// ---------------------------------------------------------------------------
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function pageLogin(message, suite) {
  const dest = suite && suite.startsWith('/') && !suite.startsWith('//') ? suite : '/';
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connexion — Hub Rapport Technique</title>
<link rel="icon" href="/favicon.png">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
         background: #fafaf8; color: #1c1c1a; display: flex; align-items: center;
         justify-content: center; min-height: 100vh; padding: 24px; }
  .carte { background: #fff; border: 1px solid #e8e8e4; border-radius: 10px;
           padding: 40px; max-width: 420px; width: 100%; text-align: center; }
  .carte img { height: 34px; margin-bottom: 28px; }
  h1 { font-size: 19px; margin-bottom: 8px; }
  p { color: #55554f; font-size: 14px; line-height: 1.6; margin-bottom: 26px; }
  .bouton { display: inline-block; background: #ff110b; color: #fff; text-decoration: none;
            padding: 12px 22px; border-radius: 6px; font-size: 15px; font-weight: 600; }
  .bouton:hover { background: #e00e09; }
  .erreur { background: #fdf2f2; border: 1px solid #f3c9c9; color: #c62821; font-size: 13.5px;
            border-radius: 6px; padding: 12px 14px; margin-bottom: 22px; text-align: left; }
  .pied { color: #8a8a81; font-size: 12px; margin: 26px 0 0; }
  .secours { border-top: 1px solid #e8e8e4; margin-top: 28px; padding-top: 20px; }
  .secours summary { color: #8a8a81; font-size: 13px; cursor: pointer; list-style: none; }
  .secours summary::-webkit-details-marker { display: none; }
  .secours summary:hover { color: #55554f; }
  .secours form { display: flex; gap: 8px; margin-top: 14px; }
  .secours input { flex: 1; border: 1px solid #e8e8e4; border-radius: 6px; padding: 10px 12px;
                   font-size: 14px; font-family: inherit; min-width: 0; }
  .secours input:focus { outline: none; border-color: #8a8a81; }
  .secours button { border: 1px solid #e8e8e4; background: #fafaf8; color: #55554f; border-radius: 6px;
                    padding: 10px 16px; font-size: 14px; font-family: inherit; cursor: pointer; }
  .secours button:hover { background: #f0f0ec; color: #1c1c1a; }
</style></head><body>
  <div class="carte">
    <img src="/logo-dz.png" alt="DZ Construct">
    <h1>Hub Rapport Technique</h1>
    ${message ? `<div class="erreur">${message}</div>` : ''}
    <p>L'accès est réservé aux comptes <strong>@${esc(DOMAINE)}</strong>.</p>
    <a class="bouton" href="/auth/login?suite=${encodeURIComponent(dest)}">Se connecter avec Microsoft</a>
    ${ACCES_SECOURS ? `<details class="secours">
      <summary>Vous n'avez pas de compte ${esc(DOMAINE)} ?</summary>
      <form method="post" action="/auth/code">
        <input type="hidden" name="suite" value="${esc(dest)}">
        <input type="password" name="code" placeholder="Code d'accès" autocomplete="off" autofocus>
        <button type="submit">Entrer</button>
      </form>
    </details>` : ''}
    <p class="pied">DZ Construct — 195 Z.A.E. Wolser F, L-4026 Bettembourg</p>
  </div>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Limitation des tentatives sur l'accès de secours
// ---------------------------------------------------------------------------
// En mémoire : remis à zéro à chaque déploiement, ce qui est acceptable pour une
// porte de secours. Le but est d'écarter le forçage automatisé, pas de tenir un
// registre.
const tentatives = new Map();
const MAX_TENTATIVES = 8;
const FENETRE = 15 * 60 * 1000;

function tropDeTentatives(ip) {
  const t = tentatives.get(ip);
  if (!t || Date.now() > t.jusqua) return false;
  return t.n >= MAX_TENTATIVES;
}

function noterEchec(ip) {
  const t = tentatives.get(ip);
  if (!t || Date.now() > t.jusqua) tentatives.set(ip, { n: 1, jusqua: Date.now() + FENETRE });
  else t.n++;
  // Purge opportuniste : la table ne doit pas grossir indéfiniment.
  if (tentatives.size > 500) {
    for (const [cle, v] of tentatives) if (Date.now() > v.jusqua) tentatives.delete(cle);
  }
}

// ---------------------------------------------------------------------------
// Chemins ouverts, même quand l'authentification est active
// ---------------------------------------------------------------------------
// · /icons/ : PDFShift va chercher les icônes de chapitre PAR URL au moment de
//   fabriquer le PDF. Les protéger viderait les rapports de leurs icônes.
// · /api/convert/docx et /api/reports/upload : appelés par n8n, pas par un
//   navigateur. Ils n'exposent aucune donnée (l'un convertit ce qu'on lui donne,
//   l'autre écrit un fichier déjà produit par la chaîne).
// · le reste : ressources de la page de connexion elle-même.
const OUVERT_EXACT = new Set([
  '/login',
  '/api/health',
  '/api/convert/docx',
  '/api/reports/upload',
  '/favicon.png',
  '/styles.css',
  '/logo-dz.png',
]);
const OUVERT_PREFIXE = ['/auth/', '/icons/'];

// Appel machine porteur du jeton de service (en-tête X-Cockpit-Token).
function jetonDeService(req) {
  if (!COCKPIT_TOKEN) return false;
  const recu = Buffer.from(String(req.headers['x-cockpit-token'] || ''));
  const ref = Buffer.from(COCKPIT_TOKEN);
  return recu.length === ref.length && crypto.timingSafeEqual(recu, ref);
}

function estOuvert(chemin) {
  if (OUVERT_EXACT.has(chemin)) return true;
  if (OUVERT_PREFIXE.some((p) => chemin.startsWith(p))) return true;
  if (RAPPORTS_PUBLICS && chemin.startsWith('/reports/')) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Montage
// ---------------------------------------------------------------------------
function monter(app) {
  app.get('/login', (req, res) => res.send(pageLogin('', String(req.query.suite || '/'))));

  // Accès de secours par code. Pose la même session signée que le login Microsoft :
  // tout ce qui est en aval fonctionne à l'identique.
  app.post('/auth/code', express.urlencoded({ extended: false }), (req, res) => {
    const suite = String((req.body && req.body.suite) || '/');
    if (!actif || !ACCES_SECOURS) return res.redirect('/login');

    const ip = req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.ip;
    if (tropDeTentatives(ip)) {
      return res.status(429).send(pageLogin('Trop de tentatives. Réessayez dans un quart d\'heure.', suite));
    }

    const fourni = Buffer.from(String((req.body && req.body.code) || ''));
    const attendu = Buffer.from(ACCES_SECOURS);
    const bon = fourni.length === attendu.length && crypto.timingSafeEqual(fourni, attendu);
    if (!bon) {
      noterEchec(ip);
      return res.status(401).send(pageLogin('Code incorrect.', suite));
    }

    poserCookie(
      res,
      COOKIE_SESSION,
      signer({ email: 'acces-par-code', nom: 'Accès par code', exp: Math.floor(Date.now() / 1000) + DUREE_SESSION }),
      DUREE_SESSION,
    );
    res.redirect(suite.startsWith('/') && !suite.startsWith('//') ? suite : '/');
  });

  // Qui suis-je ? Utilisé par le bandeau du header (public/auth-ui.js).
  app.get('/auth/moi', (req, res) => {
    if (!actif) return res.json({ actif: false });
    const session = verifier(lireCookies(req)[COOKIE_SESSION]);
    res.json({ actif: true, email: session ? session.email : '', nom: session ? session.nom : '' });
  });

  app.get('/auth/login', (req, res) => {
    if (!actif) return res.redirect('/');
    const etat = crypto.randomBytes(16).toString('base64url');
    const nonce = crypto.randomBytes(16).toString('base64url');
    // Anti redirection ouverte : on n'accepte qu'un chemin interne.
    const brut = typeof req.query.suite === 'string' ? req.query.suite : '/';
    const suite = brut.startsWith('/') && !brut.startsWith('//') ? brut : '/';
    poserCookie(
      res,
      COOKIE_TRANSACTION,
      signer({ etat, nonce, suite, exp: Math.floor(Date.now() / 1000) + DUREE_TRANSACTION }),
      DUREE_TRANSACTION,
    );
    const u = new URL(`${AUTORITE}/oauth2/v2.0/authorize`);
    u.searchParams.set('client_id', CLIENT_ID);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('redirect_uri', REDIRECT_URI);
    u.searchParams.set('response_mode', 'query');
    u.searchParams.set('scope', PORTEE);
    u.searchParams.set('state', etat);
    u.searchParams.set('nonce', nonce);
    res.redirect(u.toString());
  });

  app.get('/auth/callback', async (req, res) => {
    if (!actif) return res.redirect('/');
    const transaction = verifier(lireCookies(req)[COOKIE_TRANSACTION]);
    poserCookie(res, COOKIE_TRANSACTION, '', 0);

    if (req.query.error) {
      return res.status(400).send(pageLogin(`Microsoft a refusé la connexion : ${esc(req.query.error_description || req.query.error)}`, transaction && transaction.suite));
    }
    if (!transaction || !req.query.code || req.query.state !== transaction.etat) {
      return res.status(400).send(pageLogin('Session de connexion expirée ou invalide. Réessayez.', transaction && transaction.suite));
    }

    try {
      const corps = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: String(req.query.code),
        redirect_uri: REDIRECT_URI,
        scope: PORTEE,
      });
      const r = await fetch(`${AUTORITE}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: corps,
        signal: AbortSignal.timeout(15000),
      });
      const jetons = await r.json().catch(() => ({}));
      if (!r.ok || !jetons.id_token) {
        throw new Error(jetons.error_description || `échange de jeton refusé (HTTP ${r.status})`);
      }

      const c = chargeIdToken(jetons.id_token);
      const maintenant = Math.floor(Date.now() / 1000);
      if (!c) throw new Error('jeton d\'identité illisible');
      if (c.aud !== CLIENT_ID) throw new Error('audience inattendue');
      if (c.tid !== TENANT) throw new Error('tenant inattendu');
      if (c.iss !== `${AUTORITE}/v2.0`) throw new Error('émetteur inattendu');
      if (!c.exp || c.exp < maintenant) throw new Error('jeton expiré');
      if (c.nonce !== transaction.nonce) throw new Error('nonce inattendu');

      const email = String(c.preferred_username || c.email || c.upn || '').toLowerCase();
      if (!email.endsWith(`@${DOMAINE}`)) {
        return res.status(403).send(pageLogin(
          `Le compte ${esc(email) || 'utilisé'} n'appartient pas à ${esc(DOMAINE)}. L'accès au Hub est réservé aux comptes DZ Construct.`,
          transaction.suite,
        ));
      }

      poserCookie(
        res,
        COOKIE_SESSION,
        signer({ email, nom: String(c.name || ''), exp: maintenant + DUREE_SESSION }),
        DUREE_SESSION,
      );
      res.redirect(transaction.suite || '/');
    } catch (e) {
      res.status(500).send(pageLogin(`La connexion a échoué : ${esc(e.message || e)}`, transaction && transaction.suite));
    }
  });

  // Déconnexion locale : on efface la session du Hub. La session Microsoft du
  // navigateur, elle, reste ouverte (l'URL de déconnexion Microsoft exigerait
  // d'enregistrer une URI de post-déconnexion dans l'app Entra ID).
  app.get('/auth/logout', (req, res) => {
    poserCookie(res, COOKIE_SESSION, '', 0);
    res.redirect('/login');
  });

  // Le garde. Monté avant express.static, sinon les pages HTML seraient servies
  // directement par le middleware de fichiers statiques, sans passer par ici.
  app.use((req, res, next) => {
    if (!actif) return next();
    if (estOuvert(req.path)) return next();
    if (jetonDeService(req)) return next();
    const session = verifier(lireCookies(req)[COOKIE_SESSION]);
    if (session) {
      req.utilisateur = session;
      return next();
    }
    if (req.path.startsWith('/api/')) return res.status(401).json({ erreur: 'non authentifié' });
    // Vers NOTRE page de connexion, pas directement chez Microsoft : sinon le
    // visiteur atterrit sur un écran Microsoft sans comprendre où il est, et
    // l'accès de secours par code devient invisible.
    return res.redirect(`/login?suite=${encodeURIComponent(req.originalUrl || '/')}`);
  });
}

module.exports = { monter, actif };
