"""Bounded streaming download of a regional OSM extract, with a source receipt."""
import argparse
import hashlib
from datetime import datetime
import json
import re
from pathlib import Path
import time
import urllib.request


USER_AGENT = 'Gleislicht-road-refresh/1.0 (+https://github.com/emmettl/gleislicht)'


def dated_source_url(url):
    if not url.endswith('-latest.osm.pbf'):
        return url
    prefix = url[:-len('-latest.osm.pbf')]
    request = urllib.request.Request(prefix + '-updates/state.txt', headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        state = response.read(4097)
    if len(state) > 4096:
        raise ValueError('Oversized road source state')
    match = re.search(rb'^timestamp=(\d{4}-\d{2}-\d{2})T', state, re.MULTILINE)
    if not match:
        raise ValueError('Missing road source timestamp')
    date = datetime.strptime(match[1].decode(), '%Y-%m-%d').strftime('%y%m%d')
    return prefix + '-' + date + '.osm.pbf'


def download(url, output, max_bytes=3 * 1024**3, attempts=3, timeout=600):
    target = Path(output)
    partial = target.with_name(target.name + '.part')
    for attempt in range(attempts):
        started = time.monotonic()
        try:
            request = urllib.request.Request(dated_source_url(url), headers={'User-Agent': USER_AGENT})
            with urllib.request.urlopen(request, timeout=60) as response:
                expected = response.headers.get('Content-Length')
                if expected is not None and int(expected) > max_bytes:
                    raise ValueError('Road extract exceeds byte limit')
                digest = hashlib.sha256()
                size = 0
                with partial.open('wb') as file:
                    while chunk := response.read(1024 * 1024):
                        size += len(chunk)
                        if size > max_bytes:
                            raise ValueError('Road extract exceeds byte limit')
                        if time.monotonic() - started > timeout:
                            raise TimeoutError('Road extract download timed out')
                        digest.update(chunk)
                        file.write(chunk)
                if not size or (expected is not None and size != int(expected)):
                    raise ValueError('Incomplete road extract')
                receipt = {'url': url, 'resolvedUrl': response.geturl(), 'bytes': size,
                           'sha256': digest.hexdigest(), 'lastModified': response.headers.get('Last-Modified')}
            partial.replace(target)
            return receipt
        except Exception:
            partial.unlink(missing_ok=True)
            if attempt == attempts - 1:
                raise
            time.sleep(2 ** attempt)
    raise AssertionError('Unreachable')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('url')
    parser.add_argument('output')
    args = parser.parse_args()
    print(json.dumps(download(args.url, args.output)))
