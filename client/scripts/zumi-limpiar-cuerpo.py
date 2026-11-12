import cv2, numpy as np, json, sys
from PIL import Image
P='/home/claude/alertaclima-chile/client/public/zumi/marioneta/'
def limpiar(rgba, desde_y):
    a = rgba[:,:,3].astype(np.uint8)
    solido = (a > 200).astype(np.uint8)
    # quita salientes delgadas (ganchos de garra) solo bajo los hombros
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))
    abierto = cv2.morphologyEx(solido, cv2.MORPH_OPEN, k)
    solido[desde_y:] = abierto[desde_y:]
    # se queda con la pieza principal (y la cola si está pegada)
    n, lab, st, _ = cv2.connectedComponentsWithStats(solido, 8)
    if n > 1:
        grande = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
        solido = ((lab == grande) | ((st[lab, cv2.CC_STAT_AREA] > 0.04 * st[grande, cv2.CC_STAT_AREA]) & (lab > 0))).astype(np.uint8)
    # borde suave del pelo: hasta 5 px alrededor del sólido; todo lo demás (fantasmas) fuera
    zona = cv2.dilate(solido, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
    suave = cv2.GaussianBlur(zona.astype(np.float32), (7, 7), 0)
    out = rgba.copy()
    out[:,:,3] = (a.astype(np.float32) * np.clip(suave, 0, 1)).astype(np.uint8)
    out[:,:,3][desde_y:][~(zona[desde_y:].astype(bool))] = 0
    return out

out_dir = sys.argv[1]
ims=[]
for e in sys.argv[2:]:
    pz = json.load(open(P+e+'/pieza.json'))
    im = np.array(Image.open(P+e+'/cuerpo.webp').convert('RGBA'))
    hy = int(min(pz['hombros']['izq'][1], pz['hombros']['der'][1]) - pz['pos']['cuerpo'][1])
    o = limpiar(im, hy)
    Image.fromarray(o).save(f"{out_dir}/{e}.webp" if out_dir!='-' else P+e+'/cuerpo.webp', quality=88, method=6)
    ims.append(Image.fromarray(o))
W=sum(i.width for i in ims); H=max(i.height for i in ims)
m=Image.new('RGBA',(W,H),(40,160,90,255)); x=0
for i in ims: m.alpha_composite(i,(x,0)); x+=i.width
m.thumbnail((2000,900)); m.save('cuerpos2.png')
