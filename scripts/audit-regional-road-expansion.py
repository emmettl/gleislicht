#!/usr/bin/env python3
"""Reproduce the bounded Geneva/Luzern/Aargau survey from pinned public sources."""
import csv
import gzip
import hashlib
import io
import json
import zipfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "data/regional-road-expansion-sources/2026-09-08"


def audit():
    manifest = json.loads((SOURCES / "manifest.json").read_text())
    bodies = {}
    for entry in manifest["sources"]:
        body = (SOURCES / entry["storedPath"]).read_bytes()
        if entry["encoding"] == "gzip":
            body = gzip.decompress(body)
        assert len(body) == entry["bytes"], entry["path"]
        assert hashlib.sha256(body).hexdigest() == entry["sha256"], entry["path"]
        assert entry["httpStatus"] == "200" and entry["curlExit"] == 0
        bodies[entry["path"]] = body

    def document(name):
        return json.loads(bodies[name])

    def complete_points(prefix):
        response = document(prefix + "-points.json")
        assert not response.get("exceededTransferLimit"), prefix
        features = response["features"]
        assert len(features) == document(prefix + "-count.json")["count"], prefix
        return [feature["attributes"] for feature in features]

    def distribution(rows, field):
        return dict(sorted(Counter(str(row.get(field)) for row in rows).items()))

    geneva = complete_points("geneva")
    luzern = complete_points("luzern-miv")
    signals = complete_points("luzern-lsa")
    with zipfile.ZipFile(io.BytesIO(bodies["aargau-export.zip"])) as archive:
        csv_names = [name for name in archive.namelist() if name.endswith(".csv")]
        assert len(csv_names) == 1
        rows = list(csv.DictReader(io.StringIO(archive.read(csv_names[0]).decode("utf-8-sig")), delimiter=";"))
    miv = [row for row in rows if row["ZSTART"] == "MIV"]
    city_sample = document("luzern-city-history-sample.json")
    return {
        "checkedDate": manifest["checkedDate"],
        "verifiedResponseBodies": len(bodies),
        "datedHourlyFeedVerified": False,
        "playbackEligible": False,
        "geneva": {
            "semantics": "Counter inventory, annual daily means and peak-hour summaries",
            "points": len(geneva),
            "availability": distribution(geneva, "DISPONIBILITE"),
            "dailyMeanReferenceYears": distribution(geneva, "TJM_ANNEE"),
        },
        "luzern": {
            "semantics": "Counter inventory and separately dated statistical reports",
            "mivPoints": len(luzern),
            "owners": distribution(luzern, "ZUSTAENDIGKET"),
            "signalPoints": len(signals),
            "cityAnnualHistoryCount": document("luzern-city-history-count.json")["count"],
            "cityAnnualHistorySampleRows": len(city_sample["features"]),
            "cityAnnualHistorySampleIsComplete": not city_sample.get("exceededTransferLimit", False),
        },
        "aargau": {
            "semantics": "Survey-period and annualized statistics; report profiles are averages",
            "csvMember": csv_names[0],
            "rows": len(rows),
            "distinctStationIds": len({row["ZSTID"] for row in rows}),
            "mivRows": len(miv),
            "mivStationIds": len({row["ZSTID"] for row in miv}),
            "latestPlausibleMivStationIds": len({row["ZSTID"] for row in miv if row["AKTUELLP"] == "ja"}),
            "surveyTypes": distribution(rows, "ZSTART"),
            "ownerRows": distribution(rows, "EIGNER"),
            "directionRows": distribution(rows, "R"),
            "referenceYearRows": distribution(rows, "JAHR"),
        },
    }


if __name__ == "__main__":
    print(json.dumps(audit(), indent=2, ensure_ascii=False))
