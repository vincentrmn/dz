#!/usr/bin/env python3
"""
Archives — génère les rapports MENSUELS (un one-shot au démarrage).

Pour chaque mois de la période (par défaut janvier→juillet 2026) et chaque
chantier détecté (non supprimé), déclenche une génération sur le mois entier.
Aucun email (envoyer=false). Les mois/chantiers sans aucune donnée sont écartés
du dossier final au moment du packaging (voir --bilan).

Usage :
  python3 archives.py                       # simulation (dry-run)
  python3 archives.py --go                  # lance la génération
  python3 archives.py --go --lot 4          # lance par lots de 4 (pause entre lots)
  python3 archives.py --bilan               # après coup : liste les rapports NON vides (pour le ZIP)
"""
import argparse
import datetime as dt
import json
import sys
import time
import urllib.request

BASE = "https://cockpit-production-c3dc.up.railway.app"
PAUSE = 6            # secondes entre deux générations
PAUSE_LOT = 25      # secondes entre deux lots
ANNEE = 2026
MOIS = list(range(1, 8))   # janvier..juillet


def bornes_mois(annee, mois):
    debut = dt.date(annee, mois, 1)
    fin = (dt.date(annee, mois + 1, 1) - dt.timedelta(days=1)) if mois < 12 else dt.date(annee, 12, 31)
    return debut.isoformat(), fin.isoformat()


def get_chantiers():
    with urllib.request.urlopen(f"{BASE}/api/chantiers", timeout=30) as r:
        return [c for c in json.load(r).get("chantiers", []) if not c.get("supprime")]


def get_runs():
    with urllib.request.urlopen(f"{BASE}/api/runs", timeout=30) as r:
        return json.load(r).get("runs", [])


def generer(nom, debut, fin):
    body = json.dumps({"chantier": nom, "date_debut": debut, "date_fin": fin,
                       "envoyer": False, "declenchement": "archives"}).encode()
    req = urllib.request.Request(f"{BASE}/api/generer", data=body,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status


def est_vide(stats):
    """Un run est vide si Traxxeo 0 ET RT 0 ET BLL 0 (ou source inactive partout)."""
    s = stats or ""
    import re
    nums = [int(x) for x in re.findall(r"(\d+)\s*(?:ligne|message|photo)", s)]
    return sum(nums) == 0


def cmd_bilan():
    runs = [r for r in get_runs() if r.get("declenchement") == "archives"]
    pleins = [r for r in runs if not est_vide(r.get("stats"))]
    vides = [r for r in runs if est_vide(r.get("stats"))]
    print(f"Runs archives : {len(runs)} — avec données : {len(pleins)} — vides (écartés) : {len(vides)}")
    for r in sorted(pleins, key=lambda x: (x.get("chantier"), x.get("periode_debut"))):
        print(f"  ✓ {r.get('chantier')}  {r.get('periode_debut')}→{r.get('periode_fin')}  | {r.get('stats')}")
    return pleins


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--go", action="store_true")
    ap.add_argument("--bilan", action="store_true")
    ap.add_argument("--lot", type=int, default=0, help="taille de lot (0 = flux continu)")
    ap.add_argument("--pause", type=float, default=PAUSE)
    args = ap.parse_args()

    if args.bilan:
        cmd_bilan()
        return

    chantiers = get_chantiers()
    taches = [(c["nom"], *bornes_mois(ANNEE, m)) for m in MOIS for c in chantiers]
    print(f"{len(chantiers)} chantiers × {len(MOIS)} mois = {len(taches)} générations (≈ crédits PDFShift)")
    if not args.go:
        print("(dry-run — --go pour lancer)")
        for c in chantiers:
            print(" -", c["nom"])
        return

    n = 0
    for nom, d, f in taches:
        n += 1
        try:
            generer(nom, d, f)
            print(f"[{n}/{len(taches)}] {nom} {d[:7]}  ok", flush=True)
        except Exception as e:
            print(f"[{n}/{len(taches)}] {nom} {d[:7]}  ÉCHEC : {e}", flush=True)
        time.sleep(args.pause)
        if args.lot and n % args.lot == 0 and n < len(taches):
            print(f"  …pause de lot ({PAUSE_LOT}s)…", flush=True)
            time.sleep(PAUSE_LOT)
    print("Terminé. Lance `python3 archives.py --bilan` puis le packaging ZIP.")


if __name__ == "__main__":
    main()
