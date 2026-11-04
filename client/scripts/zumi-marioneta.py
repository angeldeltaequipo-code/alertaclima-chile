"""Arma la «marioneta» de ZUMI para un escenario: capas que la app anima en vivo.

A partir del primer cuadro del clip de reposo (la pose base), su seguimiento de cara, las bocas reales
del escenario y un fondo sin ZUMI, genera en public/zumi/marioneta/<escena>/:
  fondo.webp      escenario vacío (alineado a la pose base)
  cuerpo.webp     ZUMI sin la cabeza (con transparencia)
  cabeza.webp     cabeza sin la mandíbula, con el cuello difuminado (para girar sin costura)
  mandibula.webp  mandíbula y mentón (baja cuando abre la boca)
  ojos.webp       ojos cerrados, recortados de un parpadeo real del mismo clip
  bocas.webp      6 bocas (reposo, m, e, a, i, o), ya en la escala de la pose
  sombra.webp     sombra suave bajo los pies
  pieza.json      medidas: nariz, pivotes, posiciones y tamaños

Uso: python3 scripts/zumi-marioneta.py escena clip_reposo.mp4 cara.json bocas.webp fondo.png|- salida_dir [ancho]
"""
import json
import math
import sys

import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove

escena, clip, cara_p, bocas_p, fondo_p, salida = sys.argv[1:7]
ANCHO = int(sys.argv[7]) if len(sys.argv) > 7 else 900
BOCA = dict(ancho=1.4, alto=0.62, bajo=0.43)  # igual que zumi-bocas.py
D_TIRA = 200

cara = json.load(open(cara_p))
cap = cv2.VideoCapture(clip)
cuadros = []
while True:
    ok, f = cap.read()
    if not ok:
        break
    cuadros.append(f)
base = cuadros[0]
H0, W0 = base.shape[:2]
k = ANCHO / W0
ALTO = round(H0 * k)
nx, ny, d, ang = cara['c'][0]
nx, ny, d = nx * W0, ny * W0, d * W0

ses = new_session('isnet-general-use')
mask = np.asarray(remove(Image.fromarray(cv2.cvtColor(base, cv2.COLOR_BGR2RGB)), session=ses, only_mask=True)).astype(np.float32) / 255
mask = cv2.GaussianBlur(mask, (0, 0), 1.2)

# ---------- fondo ----------
if fondo_p != '-':
    fondo = cv2.imread(fondo_p)
    fondo = cv2.resize(fondo, (W0, H0), interpolation=cv2.INTER_AREA)
    # Alinear con la pose base usando solo las zonas sin ZUMI
    lejos = (cv2.dilate((mask > 0.1).astype(np.uint8), np.ones((61, 61), np.uint8)) == 0).astype(np.uint8)
    g1 = cv2.cvtColor(base, cv2.COLOR_BGR2GRAY).astype(np.float32)
    g2 = cv2.cvtColor(fondo, cv2.COLOR_BGR2GRAY).astype(np.float32)
    M = np.eye(2, 3, dtype=np.float32)
    try:
        _, M = cv2.findTransformECC(g1, g2, M, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-5), lejos, 5)
        fondo = cv2.warpAffine(fondo, M, (W0, H0), flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
    except cv2.error as e:
        print('Sin alineación fina:', e)
    # Igualar color/luz con la pose base (el editor puede cambiar levemente el tono)
    for c in range(3):
        a, b = base[..., c][lejos > 0].astype(np.float32), fondo[..., c][lejos > 0].astype(np.float32)
        fondo[..., c] = np.clip((fondo[..., c] - b.mean()) * (a.std() / (b.std() + 1e-6)) + a.mean(), 0, 255)
else:
    hueco = cv2.dilate((mask > 0.05).astype(np.uint8), np.ones((31, 31), np.uint8)) * 255
    fondo = cv2.inpaint(base, hueco, 15, cv2.INPAINT_TELEA)

# ---------- cabeza / mandíbula / cuerpo ----------
yy, xx = np.mgrid[0:H0, 0:W0].astype(np.float32)
cuello_y = ny + 1.0 * d  # pivote de la cabeza
corte = np.clip((cuello_y + 0.12 * d - yy) / (0.22 * d), 0, 1)  # 1 arriba, 0 abajo, difuminado
# solo la zona de la cabeza en x (los brazos no deben irse con la cabeza)
ancho_cabeza = np.clip((1.75 * d - np.abs(xx - nx)) / (0.25 * d), 0, 1)
cabeza_a = mask * corte * ancho_cabeza
# mandíbula: desde la línea de la boca hasta el mentón
boca_y = ny + 0.28 * d
mand = np.clip((yy - boca_y) / (0.1 * d), 0, 1) * np.clip((ny + 0.95 * d - yy) / (0.12 * d), 0, 1) * np.clip((0.62 * d - np.abs(xx - nx)) / (0.12 * d), 0, 1)
mandibula_a = cabeza_a * mand
cabeza_sola_a = cabeza_a * (1 - mand * 0.0)  # la cabeza conserva la mandíbula detrás (sin hueco al bajar)
# ---------- brazos (capas aparte para gestos) ----------
# Los brazos cuelgan a los lados: busca la primera fila (bajando desde los hombros) donde la silueta se
# separa en 3 tramos (brazo, torso, brazo); los bordes del torso ahí marcan dónde termina cada brazo.
mb = mask > 0.5
borde_izq = borde_der = None
for f in np.arange(1.6, 3.6, 0.05):
    y = int(ny + f * d)
    if y >= H0:
        break
    fila = mb[y]
    tramos, x = [], 0
    while x < W0:
        if fila[x]:
            s0 = x
            while x < W0 and fila[x]:
                x += 1
            if x - s0 > 6:
                tramos.append((s0, x))
        x += 1
    if len(tramos) >= 3:
        cen = min(tramos, key=lambda t: abs((t[0] + t[1]) / 2 - nx))
        izq = [t for t in tramos if t[1] <= cen[0]]
        der = [t for t in tramos if t[0] >= cen[1]]
        if izq and der:
            borde_izq, borde_der, y_sep = cen[0], cen[1], y
            break
brazos = {}
restos = []
cuerpo_a = mask.copy()
if borde_izq is not None:
    hombro_y = ny + 1.25 * d
    for lado, borde in (('izq', borde_izq), ('der', borde_der)):
        dentro = (xx - borde) if lado == 'izq' else (borde - xx)  # >0 hacia el torso
        fuera = np.clip((-dentro + 10) / 22, 0, 1)  # 1 fuera del torso, difuminado en el borde
        alto = np.clip((yy - hombro_y) / (0.25 * d), 0, 1)
        a_brazo = mask * fuera * alto
        # Solo la pieza conectada al brazo (sin la cola ni los pies)
        n_comp, etiquetas = cv2.connectedComponents((a_brazo > 0.25).astype(np.uint8))
        semilla_x = int(borde - 0.25 * d) if lado == 'izq' else int(borde + 0.25 * d)
        fila_sep = (a_brazo[y_sep] > 0.25).nonzero()[0]
        if len(fila_sep):
            semilla_x = int(fila_sep[np.argmin(np.abs(fila_sep - semilla_x))])
        etq = etiquetas[y_sep, semilla_x]
        if etq > 0:
            a_brazo = a_brazo * cv2.GaussianBlur((etiquetas == etq).astype(np.float32), (0, 0), 1.5)
        # Bajo la mano puede tocar la cola: ahí solo queda lo oscuro (la mano), no el pelaje claro de la cola
        hsv_b = cv2.cvtColor(base, cv2.COLOR_BGR2HSV)
        oscuro = np.maximum(np.clip((125 - hsv_b[..., 2].astype(np.float32)) / 30, 0, 1), np.clip((70 - hsv_b[..., 1].astype(np.float32)) / 25, 0, 1))  # mano oscura o garras grises
        bajo = np.clip((yy - (y_sep + 0.3 * d)) / (0.08 * d), 0, 1)
        mano_baja = a_brazo * bajo * oscuro * (yy < y_sep + 0.85 * d)
        a_brazo = a_brazo * (1 - bajo + bajo * oscuro) * (yy < y_sep + 0.85 * d)
        restos.append(mano_baja)
        brazos[lado] = (a_brazo, borde)
        # el cuerpo sin el brazo (la cola y los pies se quedan en el cuerpo)
        cuerpo_a = cuerpo_a * (1 - np.clip(a_brazo / np.maximum(mask, 1e-3), 0, 1) * np.clip((-dentro + 2) / 6, 0, 1))
        # El costado del torso que tapaba el brazo: una curva suave (panza redonda), no un corte recto.
        y0, y1 = ny + 1.15 * d, y_sep + 0.1 * d
        u = np.clip((yy - y0) / (y1 - y0), 0, 1)
        panza = 0.14 * d * np.sin(np.pi * u) * ((yy > y0) & (yy < y1))
        extra = np.clip((panza + dentro + 2) / 4, 0, 1) * (dentro < 2) * (yy > y0) * (yy < y1)
        relleno_a = np.maximum(relleno_a, extra) if 'relleno_a' in dir() else extra
        cuerpo_a = np.maximum(cuerpo_a, extra)
    print(f'brazos: torso entre x={borde_izq} y x={borde_der} (fila {y_sep})')
    # La mano (oscura o garras grises) sale del cuerpo aunque toque la cola
    for r in restos:
        cuerpo_a = cuerpo_a * (1 - np.clip(cv2.dilate(r, np.ones((3, 3), np.uint8)) * 1.5, 0, 1))
    # Quitar restos sueltos (puntas de garras) que quedaron donde estaba la mano
    n_c, et, est, _ = cv2.connectedComponentsWithStats((cuerpo_a > 0.3).astype(np.uint8))
    if n_c > 2:
        grande = 1 + int(np.argmax(est[1:, cv2.CC_STAT_AREA]))
        islas = (et > 0) & (et != grande)
        cuerpo_a = cuerpo_a * (1 - cv2.dilate(islas.astype(np.uint8), np.ones((5, 5), np.uint8)))
    # Pelaje del costado: se rellena desde el torso (donde antes estaba el brazo)
    hueco = ((mask > 0.3) & (sum(a for a, _ in brazos.values()) > 0.3)) | (relleno_a > 0)
    rellena = cv2.inpaint(base, (hueco * 255).astype(np.uint8), 12, cv2.INPAINT_TELEA)
    base_cuerpo = np.where((relleno_a > 0)[..., None] | ((sum(a for a, _ in brazos.values()) > 0.3) & (cuerpo_a > 0.05))[..., None], rellena, base)
else:
    print('No se encontraron brazos separados: sin gestos de brazos en este escenario')
    base_cuerpo = base


def rgba(img, alfa):
    out = np.dstack([img, np.clip(alfa * 255, 0, 255).astype(np.uint8)])
    return cv2.resize(out, (ANCHO, ALTO), interpolation=cv2.INTER_AREA)


def guardar(nombre, img, calidad=88):
    cv2.imwrite(f'{salida}/{nombre}', img, [cv2.IMWRITE_WEBP_QUALITY, calidad])


def recortar(nombre, img_rgba):
    """Guarda solo el rectángulo con contenido y devuelve su posición (para no pesar de más)."""
    a = img_rgba[..., 3]
    ys, xs = np.where(a > 2)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    guardar(nombre, img_rgba[y0:y1, x0:x1])
    return [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]


import os

os.makedirs(salida, exist_ok=True)
guardar('fondo.webp', cv2.resize(fondo, (ANCHO, ALTO), interpolation=cv2.INTER_AREA), 84)
pos = {
    'cuerpo': recortar('cuerpo.webp', rgba(base_cuerpo, cuerpo_a)),
    **{f'brazo_{l}': recortar(f'brazo_{l}.webp', rgba(base, a)) for l, (a, _) in brazos.items()},
    'cabeza': recortar('cabeza.webp', rgba(base, cabeza_sola_a)),
    'mandibula': recortar('mandibula.webp', rgba(base, mandibula_a)),
}

# ---------- sombra ----------
ys, xs = np.where(mask > 0.5)
pie_y, cx = ys.max(), (xs.min() + xs.max()) / 2
sw, sh = int((xs.max() - xs.min()) * 0.9 * k), int(0.35 * d * k)
sombra = np.zeros((sh * 2, sw, 4), np.uint8)
cv2.ellipse(sombra, (sw // 2, sh), (sw // 2 - 2, sh // 2), 0, 0, 360, (10, 6, 4, 150), -1)
sombra[..., 3] = cv2.GaussianBlur(sombra[..., 3], (0, 0), sh * 0.35)
guardar('sombra.webp', sombra)
pos['sombra'] = [int(cx * k - sw / 2), int(pie_y * k - sh), sw, sh * 2]

# ---------- ojos cerrados (del parpadeo más profundo del clip) ----------
def zona(f, c, ancho, alto, bajo):
    fnx, fny, fd, fa = c[0] * W0, c[1] * W0, c[2] * W0, c[3]
    cx, cy = fnx - math.sin(fa) * bajo * fd, fny + math.cos(fa) * bajo * fd
    M = cv2.getRotationMatrix2D((cx, cy), math.degrees(fa), D_TIRA / fd)
    w, h = int(ancho * D_TIRA), int(alto * D_TIRA)
    M[0, 2] += w / 2 - cx
    M[1, 2] += h / 2 - cy
    return cv2.warpAffine(f, M, (w, h), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REPLICATE)


OJOS = dict(ancho=1.55, alto=0.5, bajo=-0.33)
blancos = []
for f, c in zip(cuadros, cara['c']):
    z = zona(f, c, **OJOS)
    hsv = cv2.cvtColor(z, cv2.COLOR_BGR2HSV)
    # ojos abiertos: pupila e iris oscuros y esclera blanca; cerrados: casi solo pelaje
    blancos.append(float((hsv[..., 2] < 70).mean() + ((hsv[..., 1] < 60) & (hsv[..., 2] > 170)).mean()))
j = int(np.argmin(blancos))
print(f'parpadeo en el cuadro {j} (esclera {blancos[j]:.3f} vs base {blancos[0]:.3f})')
ojos = zona(cuadros[j], cara['c'][j], **OJOS)
h, w = ojos.shape[:2]
alfa = np.zeros((h, w), np.float32)
for lado in (-1, 1):
    cv2.ellipse(alfa, (int(w / 2 + lado * 0.5 * D_TIRA * 1.0), int(h / 2)), (int(0.3 * D_TIRA), int(0.21 * D_TIRA)), 0, 0, 360, 1.0, -1)
alfa = cv2.GaussianBlur(alfa, (0, 0), 0.05 * D_TIRA)
guardar('ojos.webp', np.dstack([ojos, (np.clip(alfa / alfa.max(), 0, 1) * 255).astype(np.uint8)]))

# ---------- bocas (ya recortadas por zumi-bocas.py) ----------
tira = cv2.imread(bocas_p, cv2.IMREAD_UNCHANGED)
guardar('bocas.webp', tira, 90)

pieza = {
    'escena': escena,
    'ancho': ANCHO,
    'alto': ALTO,
    'nariz': [round(nx * k, 1), round(ny * k, 1)],
    'd': round(d * k, 2),
    'angulo': round(ang, 4),
    'pivoteCabeza': [round(nx * k, 1), round(cuello_y * k, 1)],
    'pivotePies': [round(cx * k, 1), round(pie_y * k, 1)],
    'boca': BOCA,
    'ojos': OJOS,
    'dTira': D_TIRA,
    'pos': pos,
    # hombro de cada brazo (pivote del giro), en la escala de salida
    'hombros': {l: [round((b + (14 if l == 'izq' else -14)) * k, 1), round((ny + 1.45 * d) * k, 1)] for l, (_, b) in brazos.items()},
}
json.dump(pieza, open(f'{salida}/pieza.json', 'w'))
print(json.dumps(pieza))
