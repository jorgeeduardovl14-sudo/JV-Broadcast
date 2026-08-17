# Configurar la salida a YouTube

JV Broadcast se aloja en Netlify y publica la señal final del teléfono mediante WHIP. Para que esa señal llegue a YouTube se necesita un servicio puente compatible con WHIP y salida RTMPS, por ejemplo Cloudflare Stream u otro proveedor equivalente.

## Configuración una sola vez

1. En YouTube Studio, activa las transmisiones en vivo del canal.
2. Crea una transmisión con codificador y copia la URL RTMPS y la clave de transmisión.
3. En el servicio puente, crea una entrada en vivo WebRTC/WHIP.
4. Configura una salida o simulcast RTMPS hacia YouTube utilizando la URL y clave de YouTube.
5. Copia la URL WHIP de publicación que entrega el servicio puente.

## Durante cada partido

1. Abre JV Broadcast en el teléfono.
2. Crea o ingresa el código del partido y entra como Cámara.
3. Activa cámara y micrófono.
4. Pega la URL WHIP.
5. Presiona **Iniciar transmisión en YouTube**.
6. Abre JV Broadcast en la tablet, usa el mismo código y entra como Control.
7. Maneja desde la tablet el marcador, cintillos, escenas y patrocinadores.
8. Al terminar, presiona **Detener transmisión** en el teléfono.

## Importante

- La clave de YouTube se configura en el servicio puente, no en los archivos públicos de Netlify.
- La URL WHIP se guarda localmente en el teléfono.
- Para que teléfono y tablet se sincronicen por Internet, completa `assets/js/config.js` con un proyecto Firebase Realtime Database.
- Mantén el teléfono conectado a corriente, sin bloquear la pantalla y con una conexión estable.
