"""Synthetic native PNG encoding/sample guards; no actual pixels edited."""
import struct
import tempfile
import zlib
from pathlib import Path
import binding as B
import post


def chunk(kind,data):
    return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)


def png(width,height,depth,color,samples,level=6,metadata=b''):
    header=struct.pack('>IIBBBBB',width,height,depth,color,0,0,0)
    stride=len(samples)//height
    rows=b''.join(b'\x00'+samples[i*stride:(i+1)*stride] for i in range(height))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',header)+(chunk(b'PLTE',b'\x00\x00\x00') if color==3 else b'')+(chunk(b'tEXt',metadata) if metadata else b'')+chunk(b'IDAT',zlib.compress(rows,level))+chunk(b'IEND',b'')


def run():
    cases=0
    with tempfile.TemporaryDirectory(prefix='png-samples-',dir=B.HERE) as directory:
        root=Path(directory); a=root/'a.png'; b=root/'b.png'
        samples=bytes(range(24)) #3x2 native RGBA8
        original=png(3,2,8,6,samples,0)
        a.write_bytes(original)
        b.write_bytes(png(3,2,8,6,samples,9,b'proof\x00same pixels different compression/metadata'))
        result=post.exact_file(a,b)
        assert not result['fileBytesEqual'] and result['left']['decodedSampleSha256']==result['right']['decodedSampleSha256']
        cases+=1
        # Every channel, including alpha, differs by exactly one sample unit.
        for channel in range(4):
            altered=bytearray(samples); altered[channel]+=1
            b.write_bytes(png(3,2,8,6,bytes(altered)))
            try:
                post.exact_file(a,b)
            except AssertionError:
                pass
            else:
                raise AssertionError('single native channel change accepted')
            cases+=1
        for width,height,depth,color,payload in ((2,3,8,6,samples),(3,2,16,6,bytes(48)),
                                               (3,2,8,2,bytes(18)),(3,2,8,0,bytes(6)),
                                               (3,2,8,3,bytes(6))):
            b.write_bytes(png(width,height,depth,color,payload))
            try:
                post.exact_file(a,b)
            except (ValueError,AssertionError):
                pass
            else:
                raise AssertionError('dimension/mode/depth change accepted')
            cases+=1
        malformed=bytearray(original); malformed[29]^=1
        b.write_bytes(malformed)
        try:
            post.exact_file(a,b)
        except ValueError:
            pass
        else:
            raise AssertionError('corrupt IHDR CRC accepted')
        cases+=1
    actual_finished=0
    for px in (80,144):
        for name in ('still.png','still_ground.png'):
            post.rgba8_png(B.PARENT/f'reconstruction-raw/idle/px{px}/R2'/name)
            actual_finished+=1
    return {'cases':cases,'actualPreserved545FinishedRgba8PngsValidated':actual_finished,
            'encodingMetadataOnlyAcceptedExactSamples':True,
            'singleChannelDimensionDepthModeAndIhdrCorruptionRejected':True,
            'nativePixelsEdited':False,'sampleTolerance':0}
