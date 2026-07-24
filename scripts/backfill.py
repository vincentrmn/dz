#!/usr/bin/env python3
"""
Backfill des rapports techniques DZ — génère l'historique semaine par semaine.

Pour chaque semaine ISO (lundi → dimanche) de la période choisie, et pour chaque
chantier détecté (non supprimé), déclenche une génération via le webhook du cockpit.
L'email n'est JAMAIS envoyé pendant le backfill (envoyer=false).

⚠️ AVANT de lancer :
  1. Vérifier le solde / plan PDFShift : ~1 crédit par PDF. Nb de PDF ≈ semaines × chantiers.
  2. Poser EXECUTIONS_DATA_MAX_AGE=168 sur le service n8n (Railway) pour que les
     exécutions avec photos ne saturent pas le Postgres pendant le lot.
  3. Le script espace les appels (PAUSE) pour ne pas marteler n8n/Traxxeo/Graph.

Usage :
  python3 backfill.py                 # simulation (dry-run) : liste ce qui serait généré
  python3 backfill.py --go            # lance réellement
  python3 backfill.py --go --chantier "22.06-Gaichel-Maisons"   # un seul chantier (pilote)
  python3 backfill.py --go --debut 2026-01-05 --fin 2026-07-13  # bornes personnalisées
"""
import argparse
import datetime as dt
import json
import sys
import time
import urllib.request

BASE = "https://cockpit-production-c3dc.up.railway.app"
PAUSE_SECONDES = 5           # attente entre deux générations
PREMIER_LUNDI = "2026-01-05"  # premier lundi de janvier 2026


def lundi(d: dt.date) -> dt.date:
    return d - dt.timedelta(days=d.weekday())


def semaines(debut: dt.date, fin: dt.date):
    cur = lundi(debut)
    stop = lundi(fin)
    while cur <= stop:
        yield cur, cur + dt.timedelta(days=6)
        cur += dt.timedelta(days=7)


def get_chantiers():
    with urllib.request.urlopen(f"{BASE}/api/chantiers", timeout=30) as r:
        data = json.load(r)
    return [c for c in data.get("chantiers", []) if not c.get("supprime")]


def generer(nom: str, debut: str, fin: str):
    body = json.dumps({
        "chantier": nom, "date_debut": debut, "date_fin": fin,
        "envoyer": False, "declenchement": "backfill",
    }).encode()
    req = urllib.request.Request(f"{BASE}/api/generer", data=body,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--go", action="store_true", help="lancer réellement (sinon dry-run)")
    ap.add_argument("--chantier", help="limiter à un chantier (par son nom exact)")
    ap.add_argument("--debut", default=PREMIER_LUNDI)
    ap.add_argument("--fin", default=dt.date.today().isoformat())
    ap.add_argument("--pause", type=float, default=PAUSE_SECONDES)
    args = ap.parse_args()

    debut = dt.date.fromisoformat(args.debut)
    # dernière semaine COMPLÈTE : le dimanche doit être passé
    fin = dt.date.fromisoformat(args.fin) - dt.timedelta(days=7)

    chantiers = get_chantiers()
    if args.chantier:
        chantiers = [c for c in chantiers if c["nom"] == args.chantier]
        if not chantiers:
            sys.exit(f"Chantier introuvable : {args.chantier}")

    lst = list(semaines(debut, fin))
    total = len(lst) * len(chantiers)
    print(f"{len(chantiers)} chantier(s) × {len(lst)} semaine(s) = {total} génération(s)")
    print(f"Période : {lst[0][0]} → {lst[-1][1]}   PDFShift ≈ {total} crédits")
    if not args.go:
        print("\n(dry-run — relancer avec --go pour lancer réellement)")
        for c in chantiers:
            print(" -", c["nom"])
        return

    n = 0
    for l, d in lst:
        for c in chantiers:
            n += 1
            try:
                generer(c["nom"], l.isoformat(), d.isoformat())
                print(f"[{n}/{total}] {c['nom']} {l} → {d}  ok")
            except Exception as e:
                print(f"[{n}/{total}] {c['nom']} {l} → {d}  ÉCHEC : {e}")
            time.sleep(args.pause)
    print("Terminé. Suivi dans la page Debug du cockpit.")


if __name__ == "__main__":
    main()
