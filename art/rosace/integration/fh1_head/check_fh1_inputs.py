"""Native PNG mode/exact samples and distinct depth2 metadata source guards."""
import struct
import tempfile
import zlib
from pathlib import Path
import fh1_inputs as I
import fh1_png as P


def chunk(kind,data): return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
def png(samples,depth=8,color=6,meta=b'',level=6):
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',2,1,depth,color,0,0,0))+(chunk(b'tEXt',meta) if meta else b'')+chunk(b'IDAT',zlib.compress(b'\0'+samples,level))+chunk(b'IEND',b'')


def main():
    checks=0
    with tempfile.TemporaryDirectory(prefix='fc1-png-',dir=Path(__file__).resolve().parent) as directory:
        a,b=Path(directory)/'a.png',Path(directory)/'b.png'; values=bytes(range(8))
        a.write_bytes(png(values,level=0)); b.write_bytes(png(values,meta=b'proof\0codec difference',level=9))
        assert a.read_bytes()!=b.read_bytes(); P.exact(a,b); checks+=1
        for altered in (png(bytes([1])+values[1:]),png(bytes(16),depth=16),png(bytes(6),color=2)):
            b.write_bytes(altered)
            try: P.exact(a,b)
            except (ValueError,AssertionError): pass
            else: raise AssertionError('native sample/depth/mode change accepted')
            checks+=1
    binding=I.verify()
    data=I.collect()
    assert len(data['separateFailedBdDepth2AndMeta'])==12
    count=0
    for shot in ('idle','back'):
        for px in (144,80):
            assert not (I.R2/shot/f'px{px}/depth2.png').exists()
            P.decode(I.FAILED/shot/f'px{px}/depth2.png'); count+=1
    for path in Path(__file__).resolve().parent.glob('*.py'):
        compile(path.read_text(encoding='utf-8'),str(path),'exec')
    import json
    print(json.dumps({'kind':'FC1 exact native PNG plus distinct failedbd depth2 binding source checks',
                     'fixtureCases':checks,'actualFailedBdDepth2Rgba8Validated':count,'binding':binding,
                     'allSourceCompiled':True,'nativeExecuted':False,'postRun':False},indent=2))


if __name__=='__main__': main()
