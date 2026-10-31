FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY server ./server
# Voz de ZUMI (modelo libre; si no se puede descargar, la app usa la voz del teléfono)
RUN cd server && node scripts/descargar-voz.js
# El script de siembra lee los datos de comunas del cliente.
COPY client/src/data ./client/src/data
COPY client/public/limites ./client/public/limites
WORKDIR /app/server
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node scripts/migrar.js && node scripts/sembrar-comunas.js --si-vacia && node index.js"]
