"""Plot the three unresolved boat-terminal coordinate conflicts from pinned data."""
import gzip
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

review = json.loads(Path('data/thurgau-audit/boat-exclusions.json').read_text())
response = json.loads(gzip.decompress(Path('data/thurgau-boat-exclusion-sources/osm.json.gz').read_bytes()))
elements = {(e['type'], e['id']): e for e in response['elements']}
lakes = json.loads(gzip.decompress(Path('data/thurgau-boat-sources/lakes.json.gz').read_bytes()))['results']
polygons = [p for f in lakes if f['id'] in [124, 171] for p in f['geometry']['coordinates']]
font = lambda size: ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', size)
image = Image.new('RGB', (1680, 790), '#f7fafc')
draw = ImageDraw.Draw(image)
draw.text((25, 18), 'Thurgau · three unresolved boat dock coordinates', font=font(31), fill='#17324a')
draw.text((25, 65), 'Red = original GTFS call · green = mapped ferry terminal · blue = candidate ferry way · brown = mapped pier', font=font(21), fill='#354f64')
for i, dock in enumerate(review['dockIdentities']):
    x0, y0 = 20 + i * 553, 110
    draw.rounded_rectangle((x0, y0, x0 + 533, y0 + 555), radius=12, fill='white', outline='#cdd8e0')
    stop, node = dock['stop'], dock['node']
    title = stop[2].replace(' (Bodensee)', '').replace(' (See)', '')
    draw.text((x0 + 18, y0 + 13), title, font=font(24), fill='#17324a')
    center = (x0 + 266, y0 + 290)
    scale = .72
    def xy(p):
        return (center[0] + (p[0] - stop[0]) * math.cos(math.radians(stop[1])) * 111320 * scale,
                center[1] - (p[1] - stop[1]) * 111320 * scale)
    layer = Image.new('RGBA', image.size)
    d = ImageDraw.Draw(layer)
    for polygon in polygons:
        d.polygon([xy(p) for p in polygon[0]], fill='#e5f1f6', outline='#94b9c9')
        for ring in polygon[1:]:
            d.polygon([xy(p) for p in ring], fill='white', outline='#94b9c9')
    for e in elements.values():
        if e['type'] == 'way' and e.get('tags', {}).get('man_made') == 'pier':
            points = [[elements['node', n]['lon'], elements['node', n]['lat']] for n in e['nodes']]
            d.line([xy(p) for p in points], fill='#9f733f', width=5)
    for pair in review['pairs']:
        if stop[4] in [pair['from'][4], pair['to'][4]]:
            for feature in pair['candidateGeometry']:
                d.line([xy(p) for p in feature['geometry']['coordinates']], fill='#087fad', width=3)
    x, y = center
    radius = 150 * scale
    d.ellipse((x - radius, y - radius, x + radius, y + radius), outline='#aa9eb4', width=2)
    d.line((x - 7, y - 7, x + 7, y + 7), fill='#c43c38', width=4)
    d.line((x - 7, y + 7, x + 7, y - 7), fill='#c43c38', width=4)
    nx, ny = xy([node['lon'], node['lat']])
    d.ellipse((nx - 6, ny - 6, nx + 6, ny + 6), fill='#14875d', outline='white', width=1)
    box = (x0 + 7, y0 + 50, x0 + 526, y0 + 485)
    crop = layer.crop(box)
    image.paste(crop, box[:2], crop)
    draw = ImageDraw.Draw(image)
    draw.text((x0 + 18, y0 + 495), f"Terminal separation: {dock['distanceMetres']:.2f} m", font=font(20), fill='#17324a')
    draw.text((x0 + 18, y0 + 525), f"OSM node {node['id']} · circle = 150 m", font=font(18), fill='#354f64')
draw.text((25, 693), 'Diagnostic source comparison only. Original stop coordinates and all boat admission limits remain unchanged.', font=font(21), fill='#354f64')
draw.text((25, 729), '© OpenStreetMap contributors (ODbL) · shoreline © FOEN / swisstopo (2007) · historical OSM state 2 September 2026', font=font(19), fill='#354f64')
image.save('docs/assets/thurgau-boat-exclusion-docks.png')
