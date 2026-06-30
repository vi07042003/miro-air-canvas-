import urllib.request
import ssl
import uuid
import json

img_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x02\x00\x00\x00\x02\x08\x02\x00\x00\x00\xfd\xd4\x9as\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\x0fIDATx\x9cc`\x60\x00\x00\x00\n\x00\x01\x90\xdfV\xf0\x00\x00\x00\x00IEND\xaeB`\x82'
ctx = ssl._create_unverified_context()

# 1. Try Tmpfiles
try:
    boundary = '----WebKitFormBoundary' + uuid.uuid4().hex
    parts = [
        b'--' + boundary.encode(),
        b'Content-Disposition: form-data; name="file"; filename="sketch.png"',
        b'Content-Type: image/png',
        b'',
        img_bytes,
        b'--' + boundary.encode() + b'--'
    ]
    body = b'\r\n'.join(parts)
    req = urllib.request.Request(
        'https://tmpfiles.org/api/v1/upload',
        data=body,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}', 'User-Agent': 'Mozilla/5.0'},
        method='POST'
    )
    with urllib.request.urlopen(req, context=ctx, timeout=8) as r:
        res = json.loads(r.read().decode())
        url = res['data']['url']
        dl_url = url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/')
        print('Tmpfiles SUCCESS:', dl_url)
except Exception as e:
    print('Tmpfiles FAILED:', e)

# 2. Try Catbox
try:
    boundary = '----WebKitFormBoundary' + uuid.uuid4().hex
    parts = [
        b'--' + boundary.encode(),
        b'Content-Disposition: form-data; name="reqtype"',
        b'',
        b'fileupload',
        b'--' + boundary.encode(),
        b'Content-Disposition: form-data; name="fileToUpload"; filename="sketch.png"',
        b'Content-Type: image/png',
        b'',
        img_bytes,
        b'--' + boundary.encode() + b'--'
    ]
    body = b'\r\n'.join(parts)
    req = urllib.request.Request(
        'https://catbox.moe/user/api.php',
        data=body,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}', 'User-Agent': 'Mozilla/5.0'},
        method='POST'
    )
    with urllib.request.urlopen(req, context=ctx, timeout=8) as r:
        print('Catbox SUCCESS:', r.read().decode().strip())
except Exception as e:
    print('Catbox FAILED:', e)
