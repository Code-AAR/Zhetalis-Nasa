"""5. A regional dust storm sweeps over the outpost (kept to real Mars, like the game's 'Real Mars' cards):
winds of 17-30 m/s feel like a breeze in air ~1% as thick as Earth's, so nothing blows over. The danger is darkness:
the sunlight reaching the panels drops to about a third. The haze is three huge, faint dust shells sliding in from
the east; the grains stream past at about 25 m/s. The empty 'sun_factor' carries the sunlight fraction in its
scale.x (1.0 -> 0.35) so the game can dim its own sun in step."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from mars_kit import *
from mathutils import Vector

NAME = 'dust_storm'
opts = args()
sc = reset(NAME, 18)
END = sc.frame_end
F_HIT, F_DARK = 190, 300          # the front reaches the site / full storm

g, rk, _ = mars_ground(size=3000, flat_r=110, seed=4, rocks_n=160)
base = finished_outpost()

# ---------- the storm: three faint dust shells, each a 2.5 km sphere sliding in from +X
R = 2500.0
shells = []
for i, (alpha, lag) in enumerate(((0.16, 0), (0.16, 40), (0.2, 80))):
    m = soften(mat(f'storm_haze_{i}', (0.62, 0.42, 0.28), rough=1.0, alpha=alpha), power=0.6)
    s = uvsphere(f'storm_shell_{i}', R, m=m, seg=40, rings=20)
    s.visible_shadow = False
    start = R + 1500 + lag * 6
    # leading edge (centre.x - R) crosses the site (x=0) at frame F_HIT + lag
    A.key(s, 0, loc=(start, 0, -R * 0.15), interp='LINEAR')
    v = (start - R) / (F_HIT + lag)
    A.key(s, F_HIT + lag, loc=(R, 0, -R * 0.15), interp='LINEAR')
    A.key(s, END, loc=(R - v * 0.35 * (END - F_HIT - lag), 0, -R * 0.15), interp='LINEAR')
    shells.append(s)

# blowing dust, from the moment the front arrives
grit = Puffs('blowing_dust', 80, (0.6, 0.42, 0.3), alpha=0.35)
rnd = random.Random(3)
f = F_HIT - 30
while f < END - 4:
    for _ in range(2):
        y = rnd.uniform(-90, 110); z = rnd.uniform(0.5, 22)
        grit.emit(f, (rnd.uniform(60, 160), y, z), (-1.05, rnd.uniform(-0.1, 0.1), rnd.uniform(-0.02, 0.04)),
                  int(rnd.uniform(110, 160)), rnd.uniform(2, 4), rnd.uniform(5, 10), drag=0.0)
    f += 3

# ---------- the crew heads in: rover parks by habitat 2, an astronaut walks to the pod
sev = rover('sev', (-40, -14, 0), rot_z=200)
rover_path(sev, [(40, (-40, -14)), (150, (-5, 8)), (230, (30, 24))])
astro = astronaut('astronaut_0', (-30, -20, 0), rot_z=60)
A.key(astro, 20, loc=(-30, -20, 0), rot=(0, 0, 60), scale=(1, 1, 1))
A.key(astro, 160, loc=(-3, -2, 0), rot=(0, 0, 40), scale=(1, 1, 1))
A.key(astro, 168, loc=(-1.2, -0.8, 0), scale=(1, 1, 1))
A.key(astro, 169, scale=(0.001,) * 3, interp='CONSTANT')       # through the hatch

# ---------- sunlight factor for the game (scale.x), and the preview's own light
sf = empty('sun_factor')
A.key(sf, 0, scale=(1, 1, 1), interp='LINEAR'); A.key(sf, F_HIT - 60, scale=(1, 1, 1))
A.key(sf, F_DARK, scale=(0.35, 1, 1)); A.key(sf, END, scale=(0.35, 1, 1))
lamp, (sky_strength, ramp) = mars_world()
for f, e, w in ((0, 2.6, 0.9), (F_HIT - 60, 2.6, 0.9), (F_DARK, 0.9, 0.5), (END, 0.9, 0.5)):
    lamp.data.energy = e; lamp.data.keyframe_insert('energy', frame=f)
    key_value(sky_strength, f, w)

# ---------- camera
cam = camera(lens=28)
look(cam, 0, (-95, -60, 14), (200, 20, 60))                   # from behind the base, looking at the storm coming
look(cam, 140, (-88, -52, 13), (150, 10, 40), interp='CONSTANT')
look(cam, 141, (-170, -230, 120), (40, 10, 10))                # high and wide: the front reaches the base
look(cam, 290, (-150, -205, 100), (20, 10, 5), interp='CONSTANT')
look(cam, 291, (-30, -36, 3.5), (8, 20, 6))                   # on the ground inside the storm
look(cam, END, (-24, -30, 3.5), (8, 22, 6))

caption(cam, 'A dust storm is coming. Its winds reach 17-30 m/s...', 0, 100)
caption(cam, '...but Mars air is so thin they push no harder than a breeze', 100, F_HIT)
caption(cam, 'The real danger is darkness: dust blocks the sunlight', F_HIT, F_DARK)
caption(cam, 'Solar power drops to about a third. The fission reactors keep the lights on', F_DARK, 370)
caption(cam, 'A storm can last for weeks. The crew waits inside', 370, END + 1)

run([('dust_storm', 0, END)], opts, NAME)
