"""Exact native RGBA8 samples; encoding/metadata bytes stay provenance."""
import hashlib
import io
import struct
import zlib
from pathlib import Path
import numpy as np
from PIL import Image


def decode(path):
    raw=Path(path).read_bytes()
    if len(raw)<33 or raw[:8]!=b'\x89PNG\r\n\x1a\n' or raw[8:12]!=struct.pack('>I',13) or raw[12:16]!=b'IHDR':
        raise ValueError('native PNG signature/IHDR unsupported')
    header=raw[16:29]
    if struct.unpack('>I',raw[29:33])[0]!=(zlib.crc32(b'IHDR'+header)&0xffffffff):
        raise ValueError('native PNG IHDR CRC differs')
    w,h,depth,color,compression,filter_method,interlace=struct.unpack('>IIBBBBB',header)
    if not w or not h or (depth,color,compression,filter_method)!=(8,6,0,0) or interlace not in (0,1):
        raise ValueError('native PNG must be validated8bitRGBA')
    with Image.open(io.BytesIO(raw)) as im:
        if im.format!='PNG' or im.mode!='RGBA' or im.size!=(w,h): raise ValueError('native mode/dimensions differ')
        im.verify()
    with Image.open(io.BytesIO(raw)) as im:
        im.load(); pixels=np.asarray(im).copy()
    if pixels.dtype!=np.uint8 or pixels.shape!=(h,w,4): raise ValueError('native samples must be RGBA8 without conversion')
    return pixels,{'dimensions':[w,h],'mode':'RGBA','bitDepth':8,'fileSha256':hashlib.sha256(raw).hexdigest(),
                   'decodedSha256':hashlib.sha256(pixels.tobytes()).hexdigest()}


def exact(a,b):
    left,la=decode(a); right,rb=decode(b)
    if left.shape!=right.shape or left.tobytes()!=right.tobytes(): raise AssertionError('native RGBA8 dimensions/sample bytes changed')
    return {'equalDecodedSamples':True,'sampleTolerance':0,'left':la,'right':rb}
