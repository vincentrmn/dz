#!/usr/bin/env python3
"""
Archives — génère les rapports MENSUELS (one-shot).

Pour chaque mois de la période (par défaut janvier→juillet 2026) et chaque
chantier non supprimé, déclenche une génération sur le mois entier, sans email.
Les mois sans donnée sont écartés du dossier final au moment du packaging
(`GET /api/archives.zip`, seuil de 92 000 octets sur le PDF).

⚠️ Deux règles à ne pas perdre de vue, apprises à l'usage :

1. **Une génération à la fois.** Le script attend la fin de chaque rapport avant
   de lancer le suivant. Microsoft Graph plafonne le téléchargement des photos
   Teams à ~18 requêtes par ~20 s **par application** : deux générations en
   parallèle se volent le quota et perdent des photos, en silence. C'est
   exactement ce que ce batch est censé réparer.

2. **Le cockpit est fermé depuis le 21/08.** Les routes `/api/*` exigent une
   session Microsoft ou le jeton de service. Le jeton se passe par la variable
   d'environnement COCKPIT_TOKEN, jamais en dur dans ce fichier.

Usage :
  export COCKPIT_TOKEN='…'
  python3 archives.py                  # simulation (dry-run)
  python3 archives.py --go             # lance la génération, une à la fois
  python3 archives.py --go --reprendre # reprend où le batch s'était arrêté
  python3 archives.py --bilan          # ce que contiendrait le ZIP aujourd'hui
"""
import argparse
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

BASE = os.environ.get("COCKPIT_URL", "https://cockpit-production-c3dc.up.railway.app")
TOKEN = os.environ.get("COCKPIT_TOKEN", "")
ANNEE = 2026
MOIS = list(range(1, 8))          # janvier..juillet
PAUSE = 5                          # secondes entre deux générations
ATTENTE_MAX = 30 * 60              # abandon d'un rapport au-delà de 30 min
SONDAGE = 15                       # secondes entre deux relevés d'état
SEUIL_VIDE = 92000                 # même seuil que /api/archives.zip
JOURNAL = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".archives-faits.txt")

MOIS_RE = re.compile(r"^(.+)__(\d{4})-(\d{2})-01_\2-\3-(?:28|29|30|31)\.(pdf|docx)$")


def appeler(chemin, methode="GET", corps=None):
    donnees = json.dumps(corps).encode() if corps is not None else None
    entetes = {"Content-Type": "application/json"}
    if TOKEN:
        entetes["X-Cockpit-Token"] = TOKEN
    req = urllib.request.Request(f"{BASE}{chemin}", data=donnees, headers=entetes, method=methode)
    with urllib.request.urlopen(req, timeout=60) as r:
        brut = r.read().decode()
    return json.loads(brut) if brut.strip().startswith(("{", "[")) else brut


def bornes_mois(annee, mois):
    debut = dt.date(annee, mois, 1)
    fin = (dt.date(annee, mois + 1, 1) - dt.timedelta(days=1)) if mois < 12 else dt.date(annee, 12, 31)
    return debut.isoformat(), fin.isoformat()


def get_chantiers():
    d = appeler("/api/chantiers")
    return [c for c in d.get("chantiers", []) if not c.get("supprime")]


def get_runs():
    d = appeler("/api/runs")
    return d if isinstance(d, list) else d.get("runs", [])


def dernier_id():
    runs = get_runs()
    return max((r.get("id", 0) for r in runs), default=0)


def attendre_fin(depuis_id, nom, debut):
    """Attend qu'un run postérieur à depuis_id, pour ce chantier et ce mois, se termine."""
    limite = time.time() + ATTENTE_MAX
    while time.time() < limite:
        time.sleep(SONDAGE)
        try:
            candidats = [
                r for r in get_runs()
                if r.get("id", 0) > depuis_id
                and r.get("chantier") == nom
                and r.get("periode_debut") == debut
            ]
        except Exception:
            continue  # cockpit momentanément indisponible : on repasse
        if candidats:
            r = max(candidats, key=lambda x: x["id"])
            if r.get("etape") == "Terminé":
                return r
    return None


def lus_faits():
    if not os.path.exists(JOURNAL):
        return set()
    with open(JOURNAL, encoding="utf-8") as f:
        return {l.strip() for l in f if l.strip()}


def noter_fait(cle):
    with open(JOURNAL, "a", encoding="utf-8") as f:
        f.write(cle + "\n")


def cmd_bilan():
    """Ce que le ZIP contiendrait aujourd'hui : mêmes règles que /api/archives.zip."""
    rapports = appeler("/api/reports")
    mensuels = [r for r in rapports if MOIS_RE.match(r["fichier"])]
    pdf = [r for r in mensuels if r["type"] == "pdf"]
    pleins = sorted([r for r in pdf if r["taille"] >= SEUIL_VIDE],
                    key=lambda x: (x["chantier"], x["periode"]))
    vides = [r for r in pdf if r["taille"] < SEUIL_VIDE]
    print(f"Rapports mensuels : {len(pdf)} — avec données : {len(pleins)} — vides (écartés) : {len(vides)}")
    total = 0
    for r in pleins:
        total += r["taille"]
        print(f"  ✓ {r['chantier']:32} {r['periode'][:7]}  {r['taille']/1048576:6.2f} Mo")
    print(f"\nPoids des PDF retenus : {total/1048576:.0f} Mo (le ZIP contient aussi les Word)")
    return pleins


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--go", action="store_true")
    ap.add_argument("--bilan", action="store_true")
    ap.add_argument("--reprendre", action="store_true", help="sauter ce qui est déjà fait")
    ap.add_argument("--pause", type=float, default=PAUSE)
    args = ap.parse_args()

    if not TOKEN:
        print("COCKPIT_TOKEN absent : les routes /api/* du cockpit sont fermées depuis le 21/08.")
        sys.exit(1)

    if args.bilan:
        cmd_bilan()
        return

    chantiers = get_chantiers()
    taches = [(c["nom"], *bornes_mois(ANNEE, m)) for m in MOIS for c in chantiers]
    faits = lus_faits() if args.reprendre else set()
    restantes = [t for t in taches if f"{t[0]}|{t[1]}" not in faits]

    print(f"{len(chantiers)} chantiers × {len(MOIS)} mois = {len(taches)} générations "
          f"(≈ autant de crédits PDFShift)")
    if faits:
        print(f"déjà faites : {len(taches) - len(restantes)} — restantes : {len(restantes)}")
    if not args.go:
        print("(simulation — --go pour lancer)")
        for c in chantiers:
            print(" -", c["nom"])
        return

    debut_batch = time.time()
    partiels, echecs = [], []
    for n, (nom, d, f) in enumerate(restantes, 1):
        avant = dernier_id()
        try:
            appeler("/api/generer", "POST", {
                "chantier": nom, "date_debut": d, "date_fin": f,
                "envoyer": False, "declenchement": "archives",
            })
        except Exception as e:
            print(f"[{n}/{len(restantes)}] {nom} {d[:7]} — lancement en ÉCHEC : {e}", flush=True)
            echecs.append((nom, d, str(e)))
            continue

        r = attendre_fin(avant, nom, d)
        ecoule = time.time() - debut_batch
        if r is None:
            print(f"[{n}/{len(restantes)}] {nom} {d[:7]} — pas terminé après {ATTENTE_MAX//60} min", flush=True)
            echecs.append((nom, d, "délai dépassé"))
            continue

        statut = r.get("statut", "?")
        marque = "!" if statut != "Succès" else " "
        print(f"[{n}/{len(restantes)}]{marque}{nom} {d[:7]} — {statut} — {r.get('stats','')} "
              f"[{ecoule/60:.0f} min écoulées]", flush=True)
        if statut != "Succès":
            partiels.append((nom, d, statut, r.get("message", "")))
        noter_fait(f"{nom}|{d}")
        time.sleep(args.pause)

    print(f"\nTerminé en {(time.time()-debut_batch)/60:.0f} min.")
    if partiels:
        print(f"\n{len(partiels)} rapport(s) non parfaits — à regarder :")
        for nom, d, s, m in partiels:
            print(f"  {nom} {d[:7]} — {s} — {m}")
    if echecs:
        print(f"\n{len(echecs)} échec(s) de lancement :")
        for nom, d, e in echecs:
            print(f"  {nom} {d[:7]} — {e}")
    print("\nEnsuite : python3 archives.py --bilan, puis GET /api/archives.zip")


if __name__ == "__main__":
    main()
