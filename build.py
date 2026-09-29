"""Build the Asterra site's facts (site/build.json) from the newest finished release. The game itself is not copied.

A release is finished when its folder holds its own Asterra-vX.Y.Z.html at the root. Folders still being worked on
(no html yet) are skipped. The release folders are only read.

    python build.py                                   newest finished release beside this folder
    python build.py ..\\Asterra-v1.41.0-Outpost        that release

Serve the site with:  python -m http.server 8420 --bind 127.0.0.1 --directory site
"""
import datetime, hashlib, json, re, sys
from pathlib import Path

root = Path(__file__).resolve().parent
site = root / 'site'


def release(folder):
    m = re.match(r'Asterra-v(\d+)\.(\d+)\.(\d+)-(.+)$', folder.name)
    if not m or not folder.is_dir():
        return None
    ver = tuple(int(x) for x in m.groups()[:3])
    html = folder / 'Asterra-v{}.{}.{}.html'.format(*ver)
    return {'ver': ver, 'name': m.group(4).replace('-', ' '), 'folder': folder, 'html': html if html.is_file() else None}


def pick(arg):
    if arg:
        r = release(Path(arg).resolve())
        if not r or not r.get('html'):
            sys.exit(f'Not a finished Asterra release: {arg}')
        return r
    found = sorted((r for f in root.parent.iterdir() if (r := release(f))), key=lambda r: r['ver'])
    done = [r for r in found if r['html']]
    if not done:
        sys.exit(f'No finished Asterra release in {root.parent}')
    for r in found:
        if r['ver'] > done[-1]['ver']:
            print('skipped, no build yet:', r['folder'].name)
    return done[-1]


r = pick(sys.argv[1] if len(sys.argv) > 1 else None)
game = r['html']
sha = hashlib.sha256(game.read_bytes()).hexdigest()

# The release's own verification: the suites it passed and the bundle hash it was checked against.
suites, verified = None, None
note = r['folder'] / 'VERIFICATION.txt'
if note.is_file():
    text = note.read_text(encoding='utf-8', errors='replace')
    m = re.search(r'VERIFIED_BUNDLE ([0-9a-f]{64}), (\d+)\s+suites', text)
    if m:
        verified, suites = m.group(1) == sha, int(m.group(2))

info = {
    'version': '{}.{}.{}'.format(*r['ver']),
    'name': r['name'],
    'source': r['folder'].name,
    'bytes': game.stat().st_size,
    'sha256': sha,
    'suites': suites,
    'verified': verified,
    'built': datetime.date.today().isoformat(),
}
out = site / 'build.json'
out.write_text(json.dumps(info, indent=2) + '\n', encoding='utf-8')
print(f"Asterra v{info['version']} {info['name']} ({info['bytes']:,} bytes) -> {out}")
print(f"suites {suites}, matches its verified bundle: {verified}")
