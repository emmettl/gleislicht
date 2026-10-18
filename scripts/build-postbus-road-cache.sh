#!/usr/bin/env bash
# Called only when the current day's exact patterns fall below the 95% floor.
set -euo pipefail
work=$(cd "$1" && pwd)
root=$(cd "$(dirname "$0")/.." && pwd)
revision=99f2cd466696ecc6bdb73b2b3bb9008557fcb84a

# Isolated, pinned build tools; no global installs or repository writes.
python3 -m venv "$work/tools"
"$work/tools/bin/pip" install --disable-pip-version-check --retries 2 --timeout 60 \
  cmake==3.31.6 osmium==4.1.1
git init "$work/pfaedle"
git -C "$work/pfaedle" remote add origin https://github.com/ad-freiburg/pfaedle.git
git -C "$work/pfaedle" fetch --depth 1 origin "$revision"
git -C "$work/pfaedle" checkout --detach FETCH_HEAD
test "$(git -C "$work/pfaedle" rev-parse HEAD)" = "$revision"
git -C "$work/pfaedle" submodule update --init --recursive --depth 1
"$work/tools/bin/cmake" -S "$work/pfaedle" -B "$work/pfaedle/build" -DCMAKE_BUILD_TYPE=Release
"$work/tools/bin/cmake" --build "$work/pfaedle/build" --target pfaedle -j 2
binary="$work/pfaedle/build/pfaedle"
config="$work/pfaedle/pfaedle.cfg"

# Geofabrik extracts avoid large recurring requests to public Overpass servers.
# Filter each region to this timetable's bus network and remove the raw PBF
# before downloading the next. Native matching still rejects unsupported hops.
regions=(switzerland alps germany/baden-wuerttemberg france/alsace france/franche-comte france/rhone-alpes)
filtered=()
for region in "${regions[@]}"; do
  name=${region##*/}
  echo "Downloading and filtering $region"
  "$work/tools/bin/python" "$root/scripts/download-postbus-road-source.py" \
    "https://download.geofabrik.de/europe/$region-latest.osm.pbf" "$work/source.osm.pbf" >> "$work/sources.jsonl"
  "$binary" -m bus -c "$config" -i "$work/feed" -x "$work/source.osm.pbf" -X "$work/$name-roads.osm"
  filtered+=("$work/$name-roads.osm")
  rm "$work/source.osm.pbf"
done
"$work/tools/bin/python" "$root/scripts/merge-postbus-osm.py" \
  --switzerland "${filtered[0]}" --border "${filtered[1]}" --supplement "${filtered[@]:2}" --output "$work/roads.osm.pbf"
node "$root/scripts/match-postbus-roads.mjs" --pfaedle "$binary" --config "$config" \
  --osm "$work/roads.osm.pbf" --feed "$work/feed" --output "$work/matched"
node "$root/scripts/enrich-postbus-roads.mjs" --import "$work/matched" --cache "$work/candidate-cache.json" \
  --source "Geofabrik Switzerland, Alps, Baden-Wuerttemberg, Alsace, Franche-Comte and Rhone-Alpes latest extracts retrieved $(date -u +%Y-%m-%d); pfaedle $revision"
