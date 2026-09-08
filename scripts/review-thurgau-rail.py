"""Plot every newly admitted federal rail pattern; no basemap or operational certification."""
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

routes = {}
for date in ['2026-09-04', '2026-09-06']:
    base = Path('public/data/thurgau-region') / date
    manifest = json.loads((base / 'thurgau-region-day-manifest.json').read_text())
    trains = {t['id']: t for c in manifest['chunks'] for t in json.loads((base / c['path']).read_text())['trains']}
    for train in trains.values():
        if train.get('geometrySource') != 'fot-rail-inference':
            continue
        route = routes.setdefault(train['routeId'], {'line': train['route'], 'agencyId': train['agencyId'], 'patterns': {}})
        route['patterns'][train['patternId']] = {'paths': [manifest['paths'][i] for i in train['pathSegments']], 'stops': [manifest['stops'][i] for i, *_ in train['stops']]}
font = lambda n: ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', n)

def canvas(page):
    height = 170 + 440 * min(4, math.ceil((len(routes) - (page - 1) * 16) / 4))
    im = Image.new('RGB', (1680, height), '#f7fafc')
    draw = ImageDraw.Draw(im)
    draw.text((30, 20), f'Thurgau federal rail supplement — page {page}', font=font(30), fill='#152c43')
    draw.text((30, 62), 'Grey: all newly admitted patterns. Blue: longest call chain. Arrows: travel. Dots: original calls. Scales differ.', font=font(17), fill='#334f68')
    draw.text((30, height - 45), '© Federal Office of Transport (FOT) · Gleislicht processing · inferred infrastructure paths; no basemap', font=font(19), fill='#334f68')
    return im, draw

record = []
for route_id, route in sorted(routes.items()):
    patterns = route['patterns']
    paths = [path for p in patterns.values() for path in p['paths']]
    points = [xy for path in paths for xy in path]
    scale = math.cos(math.radians(sum(p[1] for p in points) / len(points)))
    xs, ys = [p[0] * scale for p in points], [p[1] for p in points]
    bounds = min(xs), min(ys), max(xs), max(ys)
    index = len(record) % 16; col, row = index % 4, index // 4
    if index == 0:
        im, draw = canvas(len(record) // 16 + 1)
    x0, y0 = 20 + col * 415, 110 + row * 440
    draw.rounded_rectangle((x0, y0, x0 + 400, y0 + 425), radius=12, fill='white', outline='#dbe5ed')
    draw.text((x0 + 14, y0 + 10), ('SBB ' if route['agencyId'] == '11' else 'THURBO ') + route['line'], font=font(23), fill='#152c43')
    draw.text((x0 + 14, y0 + 41), f'{len(patterns)} complete directed patterns', font=font(16), fill='#486174')
    factor = min(355 / max(bounds[2] - bounds[0], .000001), 320 / max(bounds[3] - bounds[1], .000001))
    cx, cy = x0 + 200, y0 + 233
    project = lambda p: (cx + (p[0] * scale - (bounds[0] + bounds[2]) / 2) * factor, cy - (p[1] - (bounds[1] + bounds[3]) / 2) * factor)
    for path in paths:
        draw.line([project(p) for p in path], fill='#b5c4d0', width=2)
    key, representative = max(patterns.items(), key=lambda p: len(p[1]['stops']))
    for path in representative['paths']:
        line = [project(p) for p in path]
        draw.line(line, fill='#007ea8', width=3)
        a, b = max(zip(line, line[1:]), key=lambda ab: math.dist(*ab))
        if math.dist(a, b) > 8:
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            angle = math.atan2(b[1] - a[1], b[0] - a[0])
            draw.polygon([(mx + 5 * math.cos(angle), my + 5 * math.sin(angle)),
                          (mx - 5 * math.cos(angle) + 3 * math.sin(angle), my - 5 * math.sin(angle) - 3 * math.cos(angle)),
                          (mx - 5 * math.cos(angle) - 3 * math.sin(angle), my - 5 * math.sin(angle) + 3 * math.cos(angle))], fill='#005575')
    for stop in representative['stops']:
        x, y = project(stop)
        draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill='#112d42')
    record.append({'routeId': route_id, 'line': route['line'], 'agencyId': route['agencyId'], 'page': len(record) // 16 + 1,
                   'patterns': len(patterns), 'representativePattern': key, 'first': representative['stops'][0][2], 'last': representative['stops'][-1][2]})
    if len(record) % 16 == 0:
        im.save(f'docs/assets/thurgau-rail-review-{(len(record) - 1) // 16 + 1}.png')
if len(record) % 16:
    im.save(f'docs/assets/thurgau-rail-review-{(len(record) - 1) // 16 + 1}.png')
Path('data/thurgau-rail-sources/plot-index.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
print(f'Plotted {sum(r["patterns"] for r in record)} newly admitted patterns across {len(record)} route records')
