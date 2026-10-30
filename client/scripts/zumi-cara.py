"""Sigue la cara de ZUMI cuadro a cuadro en un video (para dibujarle la boca sincronizada con la voz).

Usa como modelo la nariz y los ojos de un cuadro de referencia y los busca en cada cuadro:
  - nariz  -> posición de la cara
  - ojos   -> tamaño (distancia entre ojos) e inclinación de la cabeza
Si un ojo no se encuentra bien (parpadeo), se mantiene el tamaño y la inclinación anteriores.

Uso:
  python3 scripts/zumi-cara.py referencia.png NX NY OIX OIY ODX ODY  video.mp4 salida.json
  (NX, NY = centro de la nariz; OI/OD = centro de cada ojo, en píxeles de la referencia)
Salida: {"fps":24, "w":..., "h":..., "c":[[nx, ny, d, ang], ...]} con nx, ny y d como fracción del ancho.
"""
import json
import math
import sys

import cv2
import numpy as np


def recorte(img, cx, cy, w, h):
    x0, y0 = int(round(cx - w / 2)), int(round(cy - h / 2))
    return img[y0:y0 + h, x0:x0 + w]


def buscar(img, tpl, cx, cy, radio):
    """Busca tpl alrededor de (cx, cy). Devuelve (x, y, puntaje)."""
    h, w = tpl.shape[:2]
    x0 = max(0, int(cx - radio - w / 2))
    y0 = max(0, int(cy - radio - h / 2))
    x1 = min(img.shape[1], int(cx + radio + w / 2))
    y1 = min(img.shape[0], int(cy + radio + h / 2))
    zona = img[y0:y1, x0:x1]
    if zona.shape[0] < h or zona.shape[1] < w:
        return cx, cy, 0.0
    r = cv2.matchTemplate(zona, tpl, cv2.TM_CCOEFF_NORMED)
    _, mx, _, loc = cv2.minMaxLoc(r)
    # refinamiento subpíxel con una parábola
    px, py = loc
    dx = dy = 0.0
    if 0 < px < r.shape[1] - 1:
        a, b, c = r[py, px - 1], r[py, px], r[py, px + 1]
        dx = 0.5 * (a - c) / (a - 2 * b + c + 1e-9)
    if 0 < py < r.shape[0] - 1:
        a, b, c = r[py - 1, px], r[py, px], r[py + 1, px]
        dy = 0.5 * (a - c) / (a - 2 * b + c + 1e-9)
    return x0 + px + dx + w / 2, y0 + py + dy + h / 2, float(mx)


def main():
    ref_ruta, nx, ny, oix, oiy, odx, ody, video, salida = sys.argv[1:10]
    nx, ny, oix, oiy, odx, ody = map(float, (nx, ny, oix, oiy, odx, ody))
    ref = cv2.cvtColor(cv2.imread(ref_ruta), cv2.COLOR_BGR2GRAY)
    d_ref = math.hypot(odx - oix, ody - oiy)
    k = d_ref / 140.0
    tn = recorte(ref, nx, ny, int(64 * k), int(52 * k))
    ti = recorte(ref, oix, oiy, int(76 * k), int(66 * k))
    td = recorte(ref, odx, ody, int(76 * k), int(66 * k))

    cap = cv2.VideoCapture(video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    ok, f = cap.read()
    g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)

    # Primer cuadro: búsqueda en varias escalas por todo el cuadro
    mejor = None
    for esc in np.linspace(0.5, 1.8, 27):
        t = cv2.resize(tn, None, fx=esc, fy=esc)
        r = cv2.matchTemplate(g, t, cv2.TM_CCOEFF_NORMED)
        _, mx, _, loc = cv2.minMaxLoc(r)
        if not mejor or mx > mejor[0]:
            mejor = (mx, esc, loc[0] + t.shape[1] / 2, loc[1] + t.shape[0] / 2)
    _, esc, cx, cy = mejor
    tn, ti, td = (cv2.resize(t, None, fx=esc, fy=esc) for t in (tn, ti, td))
    d = d_ref * esc
    ang = 0.0
    # posiciones de los ojos relativas a la nariz en la referencia
    vi = np.array([oix - nx, oiy - ny]) * esc
    vd = np.array([odx - nx, ody - ny]) * esc

    cuadros = []
    while ok:
        g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        cx, cy, _ = buscar(g, tn, cx, cy, 0.35 * d)
        ix, iy, si = buscar(g, ti, cx + vi[0] * d / (d_ref * esc), cy + vi[1] * d / (d_ref * esc), 0.25 * d)
        dx_, dy_, sd = buscar(g, td, cx + vd[0] * d / (d_ref * esc), cy + vd[1] * d / (d_ref * esc), 0.25 * d)
        if si > 0.55 and sd > 0.55:
            d_nueva = math.hypot(dx_ - ix, dy_ - iy)
            if 0.7 * d < d_nueva < 1.4 * d:
                d = 0.7 * d + 0.3 * d_nueva
                ang = 0.7 * ang + 0.3 * math.atan2(dy_ - iy, dx_ - ix)
        cuadros.append([round(cx / W, 5), round(cy / W, 5), round(d / W, 5), round(ang, 4)])
        ok, f = cap.read()

    # suavizado leve (promedio móvil de 3) para quitar temblor
    arr = np.array(cuadros)
    if len(arr) > 3:
        s = arr.copy()
        s[1:-1] = (arr[:-2] + arr[1:-1] + arr[2:]) / 3
        arr = s
    json.dump({"fps": round(fps, 3), "w": W, "h": H, "c": arr.round(5).tolist()}, open(salida, "w"))
    print(f"{video}: {len(arr)} cuadros, escala {esc:.2f}, nariz inicial ({cuadros[0][0]:.3f}, {cuadros[0][1]:.3f})")


if __name__ == "__main__":
    main()
