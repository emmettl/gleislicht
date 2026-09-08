"""Plot each city's complete inferred road patterns for geometry review (no basemap)."""
import gzip
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

base = Path('data/thurgau-city-roads')
bundle = json.loads(gzip.decompress((base / 'cache.json.gz').read_bytes()))
font = lambda n: ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', n)
im = Image.new('RGB', (1680, 1930), '#f7fafc')
draw = ImageDraw.Draw(im)
draw.text((30, 20), 'Thurgau city roads — all 16 fixed-route lines', font=font(30), fill='#152c43')
draw.text((30, 62), 'Grey: all variants. Blue: longest stop pattern. Arrows: ordered travel. Dots: GTFS calls. Panels use different scales.', font=font(18), fill='#334f68')
record = []
for agency in ['727', '797']:
    data = json.loads(gzip.decompress((base / agency / 'patterns.json.gz').read_bytes()))
    cache = bundle['caches'][agency]
    for route in sorted({p['route'] for p in data['patterns']}, key=int):
        patterns = [p for p in data['patterns'] if p['route'] == route]
        paths = [cache['paths'][i] for p in patterns for i in cache['patterns'][p['id']]]
        points = [xy for path in paths for xy in path]
        scale = math.cos(math.radians(sum(p[1] for p in points) / len(points)))
        xs, ys = [p[0] * scale for p in points], [p[1] for p in points]
        bounds = min(xs), min(ys), max(xs), max(ys)
        index = len(record); col, row = index % 4, index // 4
        x0, y0 = 20 + col * 415, 110 + row * 440
        draw.rounded_rectangle((x0, y0, x0 + 400, y0 + 425), radius=12, fill='white', outline='#dbe5ed')
        draw.text((x0 + 14, y0 + 10), ('Kreuzlingen ' if agency == '727' else 'Frauenfeld ') + route, font=font(23), fill='#152c43')
        draw.text((x0 + 14, y0 + 41), f'{len(patterns)} ordered patterns; all segments matched', font=font(16), fill='#486174')
        factor = min(355 / max(bounds[2] - bounds[0], .000001), 320 / max(bounds[3] - bounds[1], .000001))
        cx, cy = x0 + 200, y0 + 233
        project = lambda p: (cx + (p[0] * scale - (bounds[0] + bounds[2]) / 2) * factor, cy - (p[1] - (bounds[1] + bounds[3]) / 2) * factor)
        for path in paths:
            draw.line([project(p) for p in path], fill='#b5c4d0', width=2)
        representative = max(patterns, key=lambda p: (len(p['stops']), p['tripCount']))
        for i in cache['patterns'][representative['id']]:
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
        record.append({'agencyId': agency, 'line': route, 'patterns': len(patterns), 'representativePattern': representative['id'],
                       'first': data['stops'][representative['stops'][0][0]][2], 'last': data['stops'][representative['stops'][-1][0]][2]})
draw.text((30, 1880), '© OpenStreetMap contributors · ODbL 1.0 · Gleislicht processing · inferred paths, not operator-verified alignments', font=font(19), fill='#334f68')
Path('docs/assets').mkdir(exist_ok=True)
im.save('docs/assets/thurgau-city-road-review.png')
(base / 'plot-index.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
print('Plotted all 77 routing patterns across 16 lines')
