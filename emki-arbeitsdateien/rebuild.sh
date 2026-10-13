set -e
cd "$(dirname "$0")"
rm -rf site && mkdir site && cd site && unzip -q /mnt/user-data/uploads/Downloads/emki-website-v3.zip
python3 - <<'PY'
from PIL import Image
src=Image.open('favicon.png').convert('RGBA')
src.save('favicon.ico', sizes=[(16,16),(32,32),(48,48)])
bg=Image.new('RGBA',src.size,(20,27,43,255)); bg.alpha_composite(src)
bg.convert('RGB').resize((180,180), Image.LANCZOS).save('apple-touch-icon.png', optimize=True)
bg.convert('RGB').resize((512,512), Image.LANCZOS).save('logo.png', optimize=True)
src.resize((512,512), Image.LANCZOS).save('favicon.png', optimize=True)
PY
cd .. && python3 edit_site.py
python3 -c "
import json,re
t=open('site/index.html').read()
m=re.search(r'<script type=\"application/ld\+json\">(.*?)</script>',t,re.S); json.loads(m.group(1)); print('JSON-LD ok')"
