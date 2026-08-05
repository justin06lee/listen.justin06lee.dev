#!/usr/bin/env python3
"""Generate the listen icon: an ascii-shaded record, arm down, on a black disc.

A sibling to the donut on justin06lee.dev and chrome.justin06lee.dev, the cup on
coffee.justin06lee.dev and the hourglass on hours.justin06lee.dev — same
pipeline, same ramp, same disc. A real form is raymarched, lit, sampled onto a
character grid, and each cell is drawn as the rect skeleton of the glyph its
luminance lands on.

Glyphs are rects rather than <text>, for the reason coffee gives: a favicon is
rendered where font availability isn't guaranteed, and a missing monospace face
would leave an empty disc. Rect geometry always draws.

WHAT THIS ONE DOES DIFFERENTLY

The obvious problem: a record is a disc, and it is being drawn inside a disc.
Face-on it is a bright circle in a black circle, which is no mark at all. Pitch
is most of the answer — at 40 degrees the record opens into an ellipse, and an
ellipse inside a circle reads instantly as an object lying in space. Hours needed
pitch to open its plates; here it is the premise.

Roll is the rest of it, and is the thing no sibling needed. A record pitched
alone is a horizontal ellipse: it leaves the top and bottom of the disc empty and
at 16px reads as a letterbox band rather than an object. Rolling the camera 21
degrees runs the major axis diagonally, so the mark reaches the frame it sits in
and lands with the same weight as the cup and the hourglass.

Yaw stays absent, as it does for the hourglass: the record is a solid of
revolution and every yaw gives the same outline. The arm is not, so it is placed
in world coordinates and swings with the roll — which is the point, it comes in
across the corner.

Three materials, where hours had two:

  VINYL is bright, which is a lie about a black record and the only way this
  works. The first pass shaded it honestly — dark, rim-lit, mostly outline — and
  beside the cup and the hourglass it was a black hole with a white dot in it:
  no ink left to average at 16px. Hours reached the identical conclusion about
  its glass. So the plate spends the upper half of the ramp and the *contrast*
  is carried by banding instead: a groove term modulating luminance with radius,
  and the smooth lead-in and lead-out rings left brighter than the grooved band
  between them. The grooves are shading, not geometry; at this cell count real
  groove walls would alias into noise.

  LABEL is bright, flat, barely shaded, no rim — hours' sand, doing the same job.
  It is the one feature guaranteed to survive to 16px, and a bright centre inside
  a darker ellipse is what separates this from the torus on the other two sites:
  a donut has a hole, a record has a label.

  ARM is mid-bright and unshaded, a straight line across a field of curves. It
  is the difference between a record and a record *playing*, which is what the
  site is about. Like hours' stream it is gone by 16px and kept anyway, because
  it costs nothing there and carries the mark at the size it is actually
  designed at.

TUNING is for 16px, not for the 136px artboard, exactly as coffee argues: at a
tab's real size a 30x30 grid averages to well under one cell per pixel, so only
the silhouette and the coarse light-to-dark structure survive.

    python3 design/favicon/generate.py > app/icon.svg
"""
import math
import sys

N = 30                  # cells across
VIEW = 136.0            # viewBox units
CELL = VIEW / N
DISC = 0.97             # black disc radius, normalised
LEVELS = 11             # 1..11; 0 is empty, mirroring the ramp's leading space
# World units across the disc radius; lower zooms in. Tuned by eye against the
# cup and the hourglass so all three carry the same weight in a tab. The record
# is the widest form of the three, so it needs more room than hours' 0.94 or the
# mark crowds its own disc.
SCALE = 0.84

RECORD_R = 0.78         # outer radius of the disc
RECORD_H = 0.020        # half-thickness of the plate
RIDGE_W = 0.055         # width of the raised lip at the edge
RIDGE_H = 0.034         # half-thickness through the lip — proud of the plate
LABEL_R = 0.24          # centre label
LABEL_H = 0.030         # also proud, so it catches light the plate doesn't
HOLE_R = 0.065          # spindle hole, punched through everything

# Grooves are luminance, not geometry — see the module docstring. They only
# occupy the band a real pressing cuts them into; the smooth lead-in at the edge
# and lead-out by the label are left glossy, and being smooth they read brighter.
# That banding is the structure that survives to 16px, where the grooves
# themselves average into flat grey.
GROOVE_INNER = 0.36     # grooves start out here, past the lead-out
GROOVE_OUTER = 0.68     # and stop here, inside the lead-in
GROOVE_FREQ = 26.0      # radians per world unit — about three rings in the band
GROOVE_GAIN = 0.14      # how far they swing the vinyl's brightness

# The arm, in world coordinates: pivot far enough out that the disc mask clips
# it, so it reads as reaching in from off-frame rather than as a speck floating
# in the black. The needle sits in the grooved band and not against the label —
# they are both the brightest things here, and touching they fuse into one blob
# at 16px instead of reading as a record and an arm.
ARM_A = (1.06, 0.125, 0.86)
ARM_B = (0.42, 0.050, 0.19)
ARM_R = 0.046
HEAD_R = 0.075          # the headshell, a fatter cap at the needle end

PITCH = math.radians(40)   # see the module docstring — this is the whole mark
# Roll is the other thing a flat form needs and the hourglass didn't. A record
# pitched alone is a horizontal ellipse, which leaves the top and bottom of the
# disc empty and reads at 16px as a letterbox band rather than an object. Tilting
# the camera runs the major axis diagonally, so the mark reaches the frame it
# sits in. Yaw is still absent, and for the same reason hours gives: the record
# is a solid of revolution and every yaw draws the same outline. The arm is not,
# so roll swings it too — which is the point, it lands across the corner.
ROLL = math.radians(-21)
# Off-axis on purpose: a light straight down the view direction leaves a
# surface of revolution almost unshaded, which is what makes these marks read
# flat. Coffee and hours hit the same wall.
LIGHT = (-0.46, 0.62, -0.64)

RIM = 0.62              # how much the silhouette edge is lifted
RIM_FALLOFF = 2.0       # higher confines the lift to a thinner outline

# The ascii ramp these levels stand for. Only used by --preview, but it is the
# alphabet glyph() draws, so it lives next to the level count it indexes.
RAMP = " ,-~:;=!*#$@"


def norm(v):
    m = math.sqrt(sum(c * c for c in v)) or 1.0
    return (v[0] / m, v[1] / m, v[2] / m)


LIGHT = norm(LIGHT)


def sd_capped_cylinder(p, h, r):
    dx = math.hypot(p[0], p[2]) - r
    dy = abs(p[1]) - h
    outside = math.hypot(max(dx, 0.0), max(dy, 0.0))
    return min(max(dx, dy), 0.0) + outside


def sd_capsule(p, a, b, r):
    """Distance to a segment thickened by r — the arm and its headshell."""
    pa = (p[0] - a[0], p[1] - a[1], p[2] - a[2])
    ba = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
    denom = sum(c * c for c in ba) or 1.0
    t = max(0.0, min(1.0, sum(pa[i] * ba[i] for i in range(3)) / denom))
    d = (pa[0] - ba[0] * t, pa[1] - ba[1] * t, pa[2] - ba[2] * t)
    return math.sqrt(sum(c * c for c in d)) - r


# Surface ids, so each material can be shaded on its own terms.
VINYL, LABEL, ARM = 0, 1, 2


def scene(p):
    """Signed distance to the record and arm, and which material was nearest."""
    plate = sd_capped_cylinder(p, RECORD_H, RECORD_R)

    # The raised lip: the same cylinder, thicker, with everything inside the
    # ridge width carved back out. Real pressings have it, and it is what draws
    # a bright ring around the outside once the grooves have averaged away.
    ridge = sd_capped_cylinder(p, RIDGE_H, RECORD_R)
    ridge = max(ridge, -sd_capped_cylinder(p, RIDGE_H * 3, RECORD_R - RIDGE_W))
    vinyl = min(plate, ridge)

    label = sd_capped_cylinder(p, LABEL_H, LABEL_R)

    # One hole through the lot, so it is visible against both materials.
    hole = sd_capped_cylinder(p, LABEL_H * 4, HOLE_R)
    vinyl = max(vinyl, -hole)
    label = max(label, -hole)

    arm = sd_capsule(p, ARM_A, ARM_B, ARM_R)
    arm = min(arm, sd_capsule(p, ARM_B, (ARM_B[0] + 0.06, ARM_B[1], ARM_B[2] + 0.05), HEAD_R))

    nearest, material = vinyl, VINYL
    if label < nearest:
        nearest, material = label, LABEL
    if arm < nearest:
        nearest, material = arm, ARM
    return nearest, material


def normal_at(p):
    e = 0.0015
    dx = scene((p[0] + e, p[1], p[2]))[0] - scene((p[0] - e, p[1], p[2]))[0]
    dy = scene((p[0], p[1] + e, p[2]))[0] - scene((p[0], p[1] - e, p[2]))[0]
    dz = scene((p[0], p[1], p[2] + e))[0] - scene((p[0], p[1], p[2] - e))[0]
    return norm((dx, dy, dz))


def rotate(v):
    """Camera space to world space: roll, then pitch. See the module docstring."""
    x, y, z = v
    cr, sr = math.cos(ROLL), math.sin(ROLL)
    x, y = x * cr - y * sr, x * sr + y * cr
    cp, sp = math.cos(PITCH), math.sin(PITCH)
    y, z = y * cp - z * sp, y * sp + z * cp
    return (x, y, z)


def trace(u, v):
    """Luminance in 0..1 for a ray through screen point (u, v), 0 for a miss."""
    origin = rotate((u, v, -3.0))
    direction = rotate((0.0, 0.0, 1.0))

    t = 0.0
    for _ in range(120):
        p = (origin[0] + direction[0] * t,
             origin[1] + direction[1] * t,
             origin[2] + direction[2] * t)
        d, material = scene(p)
        if d < 0.002:
            n = normal_at(p)
            lambert = max(0.0, sum(n[i] * LIGHT[i] for i in range(3)))
            # Cells whose normal has turned away from the camera sit on the
            # silhouette. Lifting them draws the outline in bright glyphs, and
            # the outline is the one feature that reads once the texture has
            # averaged itself away at tab size.
            facing = abs(sum(n[i] * direction[i] for i in range(3)))
            edge = (1.0 - min(1.0, facing)) ** RIM_FALLOFF
            # ...but a flat plate seen at a shallow angle has *every* cell
            # turned partly away from the camera, so the term above lifts the
            # whole top face uniformly and the mark goes evenly grey — the
            # first pass did exactly that. Weighting by how far the normal has
            # left the up axis confines the lift to the walls, which is where a
            # silhouette actually is on a form this flat.
            edge *= 1.0 - min(1.0, abs(n[1]))

            if material == LABEL:
                # Top of the ramp, flat, no rim: a solid mass rather than a lit
                # surface, so the centre stays a filled block after the texture
                # averages away. Hours' sand does exactly this job.
                return min(1.0, 0.86 + 0.14 * lambert)
            if material == ARM:
                # Unshaded on purpose. It is a line, and a line that changes
                # tone along its length stops reading as one.
                return min(1.0, 0.80 + 0.18 * lambert)
            # Vinyl. The flat top face has a constant normal, so lambert alone
            # would paint the whole plate one level. Radius in the record's own
            # frame — which is why it survives the pitch — splits it into the
            # bands a pressing actually has.
            radius = math.hypot(p[0], p[2])
            if GROOVE_INNER < radius < GROOVE_OUTER:
                groove = 0.5 + 0.5 * math.sin(radius * GROOVE_FREQ)
                return min(1.0, 0.34 + 0.30 * lambert + RIM * edge + GROOVE_GAIN * groove)
            # Smooth vinyl: no texture to break up, so it holds a brighter,
            # even tone. These two rings are what the mark reduces to in a tab.
            return min(1.0, 0.58 + 0.34 * lambert + RIM * edge)
        if t > 6.0:
            break
        # The carved ridge and the punched hole both make this an inexact field
        # near their cuts, so the step is shortened rather than trusted.
        t += max(d * 0.70, 0.004)
    return 0.0


def glyph(level, cx, cy):
    """Rects for one cell, shaped to evoke the ascii ramp it stands in for.

    Kept identical to coffee's and hours' so every mark in the family is
    visibly the same alphabet drawn at the same weights.
    """
    s = CELL
    unit = s / 5.0
    px, py = cx - s / 2.0, cy - s / 2.0

    def rect(gx, gy, gw, gh):
        # Emitted as path data rather than a <rect> element: the icon is a few
        # hundred marks, and "M.. h.. v.. h.. z" is less than half the bytes of
        # the equivalent element once they are all concatenated into one path.
        return (f"M{px + gx * unit:.1f} {py + gy * unit:.1f}"
                f"h{gw * unit:.1f}v{gh * unit:.1f}h{-gw * unit:.1f}z")

    if level <= 1:                      # ,
        return [rect(2, 3, 1.1, 1.1)]
    if level <= 3:                      # - ~
        return [rect(1, 2.1, 3, 1)]
    if level <= 5:                      # : ;
        return [rect(2, 0.6, 1.1, 1.3), rect(2, 3.2, 1.1, 1.3)]
    if level <= 7:                      # = !
        return [rect(0.6, 1.1, 3.8, 1), rect(0.6, 3.0, 3.8, 1)]
    if level <= 9:                      # * #
        return [rect(0.5, 1.1, 4, 0.9), rect(0.5, 3.1, 4, 0.9),
                rect(1.4, 0.3, 0.9, 4.4), rect(2.8, 0.3, 0.9, 4.4)]
    return [rect(0.35, 0.35, 4.3, 4.3)]  # $ @


def sample():
    """The level grid: one 0..LEVELS value per cell, None outside the disc."""
    grid = []
    for row in range(N):
        line = []
        for col in range(N):
            cx, cy = (col + 0.5) * CELL, (row + 0.5) * CELL
            u = (cx - VIEW / 2) / (VIEW / 2) * SCALE
            v = -(cy - VIEW / 2) / (VIEW / 2) * SCALE
            if math.hypot(u / SCALE, v / SCALE) > DISC - 0.02:
                line.append(None)
            else:
                line.append(int(round(trace(u, v) * LEVELS)))
        grid.append(line)
    return grid


def preview(grid):
    """Print the grid as the ascii it stands for. Tuning is done by eye, and
    reading the ramp directly is faster than rendering a png to find out that
    the whole mark landed in two adjacent levels."""
    hist = {}
    for line in grid:
        row = ""
        for level in line:
            if level is None:
                row += " "
            else:
                row += RAMP[max(0, min(len(RAMP) - 1, level))]
                hist[level] = hist.get(level, 0) + 1
        sys.stdout.write(row.rstrip() + "\n")
    total = sum(hist.values()) or 1
    sys.stdout.write("\nlevel histogram (inked cells: %d)\n" % total)
    for level in sorted(hist):
        bar = "#" * max(1, round(hist[level] / total * 60))
        sys.stdout.write(f"  {level:>2} {RAMP[level]}  {hist[level]:>4}  {bar}\n")


def main():
    grid = sample()

    if "--preview" in sys.argv:
        preview(grid)
        return

    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VIEW:.0f} {VIEW:.0f}"'
        f' width="{VIEW:.0f}" height="{VIEW:.0f}">',
        "<title>listen</title>",
        # The disc is the whole background; outside it stays transparent, the
        # way the donut icons on the other sites do it.
        f'<circle cx="{VIEW / 2:.0f}" cy="{VIEW / 2:.0f}"'
        f' r="{DISC * VIEW / 2:.2f}" fill="#000000"/>',
    ]

    buckets = {}
    for row in range(N):
        for col in range(N):
            level = grid[row][col]
            if not level or level <= 0:
                continue
            cx, cy = (col + 0.5) * CELL, (row + 0.5) * CELL
            buckets.setdefault(level, []).extend(glyph(level, cx, cy))

    for level in sorted(buckets):
        # The floor is low on purpose: the faintest glyphs have to actually
        # recede, or every cell contributes ink and the disc fills in.
        opacity = 0.13 + 0.87 * (level / LEVELS)
        out.append(
            f'<path fill="#ffffff" fill-opacity="{opacity:.2f}"'
            f' d="{"".join(buckets[level])}"/>'
        )

    out.append("</svg>")
    sys.stdout.write("\n".join(out) + "\n")


if __name__ == "__main__":
    main()
