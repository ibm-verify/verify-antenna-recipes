import json, os, re, sys
from pathlib import Path
s=Path(sys.argv[1]).read_text()
def replace(m):
    key=m.group(1)
    if key not in os.environ: raise SystemExit("Missing environment variable: "+key)
    return json.dumps(os.environ[key])
s=re.sub(r'"\$\{([A-Z_][A-Z_0-9]*)\}"', replace, s)
Path(sys.argv[2]).write_text(s)
