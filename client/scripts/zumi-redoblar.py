# Uso: python3 scripts/zumi-redoblar.py carpeta hola lluvia ...  (carpeta con orig-<id>.wav y <id>.wav; deja out/<id>.wav)
# Re-dobla una película de ZUMI con su voz única: alinea la nueva voz (DTW) al ritmo de la boca del video.
import sys, numpy as np, librosa, pyrubberband as prb, soundfile as sf
from scipy.ndimage import uniform_filter1d, binary_closing, binary_dilation
D = sys.argv[1]; SR = 24000; HOP = 240  # 10 ms
def feats(y):
    m = librosa.feature.mfcc(y=y, sr=SR, n_mfcc=20, hop_length=HOP, n_fft=1024)[1:]
    m = (m - m.mean(1, keepdims=True)) / (m.std(1, keepdims=True) + 1e-6)
    r = librosa.feature.rms(y=y, frame_length=1024, hop_length=HOP)[0]
    db = 20 * np.log10(r + 1e-6); db = (db - db.max()) / 10
    return np.vstack([m * 0.6, np.repeat(db[None], 6, 0)]), db
for e in sys.argv[2:]:
    o, _ = librosa.load(f'{D}/orig-{e}.wav', sr=SR)
    g, _ = librosa.load(f'{D}/{e}.wav', sr=SR)
    g, _ = librosa.effects.trim(g, top_db=38)
    fo, dbo = feats(o); fg, dbg = feats(g)
    habla = dbo > -3.2  # voz (relativa al máximo)
    habla = binary_closing(habla, np.ones(18)); habla = binary_dilation(habla, np.ones(6))
    idx = np.where(habla)[0]; a, b = idx[0], idx[-1]  # tramo con voz en la película
    C = np.linalg.norm(fo[:, a:b+1, None] - fg[:, None, :], axis=0)
    # silencio de la película: barato emparejarlo con cualquier cosa no muy fuerte
    _, wp = librosa.sequence.dtw(C=C, step_sizes_sigma=np.array([[1, 1], [0, 1], [1, 0], [2, 1], [1, 2]]), weights_add=np.array([0, 0.6, 0.6, 0.3, 0.3]))
    wp = wp[::-1]
    pares = {}
    for i, j in wp: pares.setdefault(i, j)
    io = np.array(sorted(pares)); jg = np.array([pares[i] for i in io])
    paso = 12
    mapa = [(0, 0)]
    for i, j in zip(io[::paso], jg[::paso]):
        si, so = int(j * HOP), int((i + a) * HOP)
        if si > mapa[-1][0] + 120 and so > mapa[-1][1] + 120: mapa.append((si, so))
    fin_g = len(g); fin_o = int((b + 1) * HOP)
    if fin_g > mapa[-1][0] and fin_o > mapa[-1][1]: mapa.append((fin_g, fin_o))
    mapa[0] = (0, int(a * HOP))
    # rubberband necesita el mapa desde 0: anteponer silencio a la voz
    pre = int(a * HOP)
    gp = np.concatenate([np.zeros(pre), g])
    tm = [(0, 0)] + [(si + pre, so) for si, so in mapa]
    w = prb.timemap_stretch(gp, SR, tm)
    out = np.zeros_like(o); n = min(len(w), len(o)); out[:n] = w[:n]
    # fondo de la película (efectos) solo donde no habla
    m = uniform_filter1d(np.repeat(habla.astype(float), HOP)[:len(o)], 2400)
    m = np.pad(m, (0, max(0, len(o) - len(m))))[:len(o)]
    mez = out  # solo la voz única: nada de la voz anterior
    mez = mez / max(1e-6, np.abs(mez).max()) * 0.95
    sf.write(f'{D}/out/{e}.wav', mez, SR)
    eo = librosa.feature.rms(y=o, hop_length=HOP)[0]; ew = librosa.feature.rms(y=out, hop_length=HOP)[0]
    k = min(len(eo), len(ew)); sl = slice(a, min(b, k))
    print(e, 'tramo', round(a*HOP/SR,2), round(b*HOP/SR,2), 'voz', round(len(g)/SR,2), 'anclas', len(tm), 'corr env', round(float(np.corrcoef(eo[sl], ew[sl])[0,1]),3))
