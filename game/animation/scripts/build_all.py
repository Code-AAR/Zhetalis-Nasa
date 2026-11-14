"""Build every sequence: .blend + GLB + preview MP4. Usage:  python build_all.py [names...] [--no-video]
Finds Blender at the usual Windows install path, or set BLENDER=path\\to\\blender.exe."""
import glob, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SEQS = ['ares_briefing', 'briefing', 'launch', 'cruise', 'approach', 'edl', 'outpost', 'storm', 'failure', 'rover_stuck', 'leak', 'ascent']


def blender():
    if os.environ.get('BLENDER'):
        return os.environ['BLENDER']
    found = sorted(glob.glob(r'C:\Program Files\Blender Foundation\Blender *\blender.exe'))
    if not found:
        sys.exit('Blender not found: set BLENDER to blender.exe')
    return found[-1]


def main():
    names = [a for a in sys.argv[1:] if not a.startswith('--')] or SEQS
    flags = ['--export'] + ([] if '--no-video' in sys.argv else ['--video'])
    exe = blender()
    for n in names:
        print(f'=== {n}', flush=True)
        r = subprocess.run([exe, '-b', '--factory-startup', '--python-exit-code', '1',
                            '-P', os.path.join(HERE, f'seq_{n}.py'), '--'] + flags,
                           capture_output=True, text=True)
        for line in r.stdout.splitlines():
            if line.startswith('EXPORTED') or 'Traceback' in line or 'Error:' in line and 'Shadow' not in line:
                print('  ', line, flush=True)
        sys.stdout.flush()
        if r.returncode:
            print(r.stdout[-3000:], r.stderr[-3000:])
            sys.exit(f'{n} failed')


if __name__ == '__main__':
    main()
