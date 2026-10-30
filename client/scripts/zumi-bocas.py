"""Saca las bocas reales de ZUMI de un clip donde habla, para dibujarlas sincronizadas con la voz.

Con el seguimiento de la cara (zumi-cara.py) recorta la zona de la boca de cada cuadro, la endereza y
la lleva a un tamaño fijo, mide qué tan abierta está y elige 6 formas: reposo, m, e, a, i, o
(el mismo orden que VISEMAS en src/services/labios.js). Las guarda en una tira WebP con transparencia
de bordes suaves, para que se funda con la cara.

Uso: python3 scripts/zumi-bocas.py clip.mp4 clip.json salida.webp
"""
import json
import math
import sys

import cv2
import numpy as np

D = 200  # distancia entre ojos en la tira (px)
# Zona de la boca relativa a la nariz, en unidades de distancia entre ojos
ANCHO, ALTO, BAJO = 1.4, 0.62, 0.43  # BAJO: centro de la zona bajo la nariz


def zona(frame, c, W):
    nx, ny, d, ang = c[0] * W, c[1] * W, c[2] * W, c[3]
    cx = nx - math.sin(ang) * BAJO * d
    cy = ny + math.cos(ang) * BAJO * d
    k = D / d
    M = cv2.getRotationMatrix2D((cx, cy), math.degrees(ang), k)
    w, h = int(ANCHO * D), int(ALTO * D)
    M[0, 2] += w / 2 - cx
    M[1, 2] += h / 2 - cy
    return cv2.warpAffine(frame, M, (w, h), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REPLICATE)


def medir(p):
    """Abertura (área oscura dentro de la boca) y proporción alto/ancho de esa área."""
    hsv = cv2.cvtColor(p, cv2.COLOR_BGR2HSV)
    h, w = p.shape[:2]
    m = (hsv[..., 2] < 95).astype(np.uint8)
    msk = np.zeros_like(m)
    cv2.ellipse(msk, (w // 2, int(h * 0.48)), (int(w * 0.36), int(h * 0.42)), 0, 0, 360, 1, -1)
    m = m * msk
    area = int(m.sum())
    if area < 20:
        return area, 0.0
    ys, xs = np.nonzero(m)
    return area, (ys.max() - ys.min() + 1) / (xs.max() - xs.min() + 1)


def main():
    video, cara, salida = sys.argv[1:4]
    datos = json.load(open(cara))
    W = datos["w"]
    cap = cv2.VideoCapture(video)
    parches = []
    i = 0
    while True:
        ok, f = cap.read()
        if not ok or i >= len(datos["c"]):
            break
        p = zona(f, datos["c"][i], W)
        a, r = medir(p)
        parches.append((a, r, p))
        i += 1
    orden = sorted(range(len(parches)), key=lambda j: parches[j][0])
    n = len(orden)
    q = lambda f: parches[orden[min(n - 1, int(f * n))]][2]
    cerrada = parches[orden[0]][2]
    abiertas = [j for j in orden if parches[j][0] > parches[orden[n // 2]][0]]
    redonda = max(abiertas, key=lambda j: parches[j][1]) if abiertas else orden[-1]
    formas = [cerrada, q(0.4), q(0.75), q(0.97), q(0.6), parches[redonda][2]]  # reposo, m, e, a, i, o

    # Borde suave (elipse con degradado) para que se funda con el pelaje
    h, w = formas[0].shape[:2]
    alfa = np.zeros((h, w), np.float32)
    cv2.ellipse(alfa, (w // 2, h // 2), (int(w * 0.42), int(h * 0.4)), 0, 0, 360, 1.0, -1)
    alfa = cv2.GaussianBlur(alfa, (0, 0), sigmaX=w * 0.06, sigmaY=h * 0.08)
    alfa = (np.clip(alfa / alfa.max(), 0, 1) * 255).astype(np.uint8)
    tira = np.concatenate([np.dstack([fm, alfa]) for fm in formas], axis=1)
    cv2.imwrite(salida, tira, [cv2.IMWRITE_WEBP_QUALITY, 90])
    print(f"{salida}: 6 bocas de {w}x{h}; aberturas {[parches[orden[min(n - 1, int(x * n))]][0] for x in (0, .4, .75, .97, .6)]}")


if __name__ == "__main__":
    main()
