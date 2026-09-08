"""Plot regional buses' complete inferred road patterns for geometry review (no basemap)."""
import gzip
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

base = Path('data/thurgau-regional-roads')
bundle = json.loads(gzip.decompress((base / 'cache.json.gz').read_bytes()))
font = lambda n: ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', n)
def canvas(page):
    im = Image.new('RGB', (1680, 1930), '#f7fafc')
    draw = ImageDraw.Draw(im)
    draw.text((30, 20), f'Thurgau regional bus roads — page {page}', font=font(30), fill='#152c43')
    draw.text((30, 62), 'Grey: all matched variants. Blue: longest complete pattern. Arrows: travel. Dots: calls. Scales differ.', font=font(18), fill='#334f68')
    draw.text((30, 1880), '© OpenStreetMap contributors · ODbL 1.0 · Gleislicht · inferred paths; no basemap or street certification', font=font(19), fill='#334f68')
    return im, draw
Path('docs/assets').mkdir(exist_ok=True)
record = []
for agency in ['138', '744', '801', '896']:
    data = json.loads(gzip.decompress((base / agency / 'patterns.json.gz').read_bytes()))
    cache = bundle['caches'][agency]
    for route_id in sorted({p['routeId'] for p in data['patterns']}):
        patterns = [p for p in data['patterns'] if p['routeId'] == route_id]
        route = patterns[0]['route']
        paths = [cache['paths'][i] for p in patterns for i in cache['patterns'][p['id']] if i is not None]
        points = [xy for path in paths for xy in path]
        scale = math.cos(math.radians(sum(p[1] for p in points) / len(points)))
        xs, ys = [p[0] * scale for p in points], [p[1] for p in points]
        bounds = min(xs), min(ys), max(xs), max(ys)
        index = len(record) % 16; col, row = index % 4, index // 4
        if index == 0: im, draw = canvas(len(record) // 16 + 1)
        x0, y0 = 20 + col * 415, 110 + row * 440
        draw.rounded_rectangle((x0, y0, x0 + 400, y0 + 425), radius=12, fill='white', outline='#dbe5ed')
        draw.text((x0 + 14, y0 + 10), {'138': 'Bus Ostschweiz', '744': 'AB bus', '801': 'PostAuto', '896': 'Regiobus'}[agency] + ' ' + route, font=font(21), fill='#152c43')
        draw.text((x0 + 14, y0 + 41), f'{len(patterns)} patterns; {sum(None in cache["patterns"][p["id"]] for p in patterns)} incomplete', font=font(16), fill='#486174')
        factor = min(355 / max(bounds[2] - bounds[0], .000001), 320 / max(bounds[3] - bounds[1], .000001))
        cx, cy = x0 + 200, y0 + 233
        project = lambda p: (cx + (p[0] * scale - (bounds[0] + bounds[2]) / 2) * factor, cy - (p[1] - (bounds[1] + bounds[3]) / 2) * factor)
        for path in paths:
            draw.line([project(p) for p in path], fill='#b5c4d0', width=2)
        complete = [p for p in patterns if None not in cache['patterns'][p['id']]]
        representative = max(complete or patterns, key=lambda p: (len(p['stops']), p['tripCount']))
        for i in cache['patterns'][representative['id']]:
            if i is None: continue
            line = [project(p) for p in cache['paths'][i]]
            draw.line(line, fill='#007ea8', width=3)
            a, b = max(zip(line, line[1:]), key=lambda ab: math.dist(*ab))
            if math.dist(a, b) > 8:
                mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
                angle = math.atan2(b[1] - a[1], b[0] - a[0])
                draw.polygon([(mx + 5 * math.cos(angle), my + 5 * math.sin(angle)),
                              (mx - 5 * math.cos(angle) + 3 * math.sin(angle), my - 5 * math.sin(angle) - 3 * math.cos(angle)),
                              (mx - 5 * math.cos(angle) - 3 * math.sin(angle), my - 5 * math.sin(angle) + 3 * math.cos(angle))], fill='#005575')
        for stop in representative['stops']:
            x, y = project(data['stops'][stop[0]])
            draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill='#112d42')
        record.append({'agencyId': agency, 'line': route, 'routeId': route_id, 'page': len(record) // 16 + 1, 'patterns': len(patterns), 'representativePattern': representative['id'],
                       'first': data['stops'][representative['stops'][0][0]][2], 'last': data['stops'][representative['stops'][-1][0]][2]})
        if len(record) % 16 == 0:
            im.save(f'docs/assets/thurgau-regional-road-review-{(len(record) - 1) // 16 + 1}.png')
if len(record) % 16:
    im.save(f'docs/assets/thurgau-regional-road-review-{(len(record) - 1) // 16 + 1}.png')
(base / 'plot-index.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
print(f'Plotted {len(record)} route records')
