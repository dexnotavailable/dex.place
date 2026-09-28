"""Register an immutable generation/copy without modifying its pixels."""
import argparse, hashlib, json, shutil
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--id', required=True)
parser.add_argument('--source', required=True)
parser.add_argument('--destination', required=True)
parser.add_argument('--role', default='reference')
args = parser.parse_args()
source = Path(args.source).resolve()
target = (root / args.destination).resolve()
if not target.is_relative_to(root):
    raise ValueError('Destination must remain in this production directory')
target.parent.mkdir(parents=True, exist_ok=True)
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
if target.exists() and digest(target) != digest(source):
    raise ValueError('Use a new versioned destination; immutable output already exists')
if source != target:
    shutil.copy2(source, target)
with Image.open(target) as im:
    record = dict(id=args.id, source=str(source), path=str(target), role=args.role,
                  size=list(im.size), mode=im.mode, bytes=target.stat().st_size,
                  sha256=digest(target), status='generated-reference-review')
manifest_path = root / 'inventory.json'
manifest = json.loads(manifest_path.read_text('utf-8')) if manifest_path.exists() else {'version':'registry-production-1','assets':{}}
manifest['assets'][args.id] = record
manifest_path.write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
print(json.dumps(record))
