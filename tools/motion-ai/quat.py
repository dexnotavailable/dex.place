"""Small numpy quaternion kit for the retime tool (no scipy).

Quaternions are (..., 4) arrays in (w, x, y, z) order. Rotation matrices are (..., 3, 3) and act
on column vectors. Every function is vectorised over leading axes.
"""
import numpy as np


def normalize(q):
    return q / np.linalg.norm(q, axis=-1, keepdims=True)


def positive(q):
    """same rotation, w >= 0 (the short way round)"""
    return np.where(q[..., :1] < 0, -q, q)


def mul(a, b):
    aw, ax, ay, az = np.moveaxis(a, -1, 0)
    bw, bx, by, bz = np.moveaxis(b, -1, 0)
    return np.stack([aw * bw - ax * bx - ay * by - az * bz,
                     aw * bx + ax * bw + ay * bz - az * by,
                     aw * by - ax * bz + ay * bw + az * bx,
                     aw * bz + ax * by - ay * bx + az * bw], -1)


def inv(q):
    return q * np.array([1.0, -1.0, -1.0, -1.0])


def log(q):
    """unit quaternion -> rotation vector (axis * angle), short way round"""
    q = positive(normalize(q))
    v = q[..., 1:]
    s = np.linalg.norm(v, axis=-1, keepdims=True)
    ang = 2.0 * np.arctan2(s, q[..., :1])
    k = np.where(s > 1e-9, ang / np.maximum(s, 1e-12), 2.0)
    return v * k


def exp(r):
    """rotation vector -> unit quaternion"""
    ang = np.linalg.norm(r, axis=-1, keepdims=True)
    half = ang / 2.0
    k = np.where(ang > 1e-9, np.sin(half) / np.maximum(ang, 1e-12), 0.5)
    return np.concatenate([np.cos(half), r * k], -1)


def power(q, t):
    """q ** t (scale the rotation angle by t); t broadcasts against q[..., 0]"""
    t = np.asarray(t, float)[..., None]
    return exp(log(q) * t)


def slerp(a, b, t):
    """shortest-path slerp from a to b; t broadcasts against a[..., 0]"""
    return normalize(mul(a, power(mul(inv(a), b), t)))


def from_axis_angle(axis, deg):
    axis = np.asarray(axis, float)
    axis = axis / np.linalg.norm(axis, axis=-1, keepdims=True)
    return exp(axis * np.radians(np.asarray(deg, float))[..., None])


def to_mat(q):
    q = normalize(q)
    w, x, y, z = np.moveaxis(q, -1, 0)
    return np.stack([
        np.stack([1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)], -1),
        np.stack([2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)], -1),
        np.stack([2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)], -1)], -2)


def from_mat(m):
    """rotation matrix -> unit quaternion (Shepperd's method, vectorised)"""
    m = np.asarray(m, float)
    shp = m.shape[:-2]
    m = m.reshape(-1, 3, 3)
    tr = m[:, 0, 0] + m[:, 1, 1] + m[:, 2, 2]
    cand = np.stack([tr, m[:, 0, 0], m[:, 1, 1], m[:, 2, 2]], -1)
    i = np.argmax(cand, -1)
    q = np.empty((m.shape[0], 4))
    # case w largest
    s = np.sqrt(np.maximum(1.0 + tr, 1e-12)) * 2
    qw = np.stack([0.25 * s, (m[:, 2, 1] - m[:, 1, 2]) / s, (m[:, 0, 2] - m[:, 2, 0]) / s,
                   (m[:, 1, 0] - m[:, 0, 1]) / s], -1)
    s = np.sqrt(np.maximum(1.0 + m[:, 0, 0] - m[:, 1, 1] - m[:, 2, 2], 1e-12)) * 2
    qx = np.stack([(m[:, 2, 1] - m[:, 1, 2]) / s, 0.25 * s, (m[:, 0, 1] + m[:, 1, 0]) / s,
                   (m[:, 0, 2] + m[:, 2, 0]) / s], -1)
    s = np.sqrt(np.maximum(1.0 + m[:, 1, 1] - m[:, 0, 0] - m[:, 2, 2], 1e-12)) * 2
    qy = np.stack([(m[:, 0, 2] - m[:, 2, 0]) / s, (m[:, 0, 1] + m[:, 1, 0]) / s, 0.25 * s,
                   (m[:, 1, 2] + m[:, 2, 1]) / s], -1)
    s = np.sqrt(np.maximum(1.0 + m[:, 2, 2] - m[:, 0, 0] - m[:, 1, 1], 1e-12)) * 2
    qz = np.stack([(m[:, 1, 0] - m[:, 0, 1]) / s, (m[:, 0, 2] + m[:, 2, 0]) / s,
                   (m[:, 1, 2] + m[:, 2, 1]) / s, 0.25 * s], -1)
    q[i == 0] = qw[i == 0]
    q[i == 1] = qx[i == 1]
    q[i == 2] = qy[i == 2]
    q[i == 3] = qz[i == 3]
    return positive(normalize(q)).reshape(shp + (4,))


def rotate(q, v):
    """rotate vectors v (..., 3) by q (..., 4)"""
    return np.einsum("...ij,...j->...i", to_mat(q), v)


def yaw_of(q):
    """heading about +Y (Y-up frame) of the rotated +Z axis, radians"""
    f = rotate(q, np.array([0.0, 0.0, 1.0]))
    return np.arctan2(f[..., 0], f[..., 2])


def split_yaw(q):
    """q = yaw(psi about +Y) * tilt. Returns (psi, tilt)."""
    psi = yaw_of(q)
    ry = from_axis_angle(np.array([0.0, 1.0, 0.0]), np.degrees(psi))
    return psi, normalize(mul(inv(ry), q))


def join_yaw(psi, tilt):
    ry = from_axis_angle(np.array([0.0, 1.0, 0.0]), np.degrees(psi))
    return normalize(mul(ry, tilt))
