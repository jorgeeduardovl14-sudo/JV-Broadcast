document.addEventListener("DOMContentLoaded", () => {
  const connectButton = document.getElementById("connectYouTubeBtn");
  const status = document.getElementById("youtubeAccountStatus");

  const createLiveButton = document.getElementById("createYouTubeLiveBtn");
  const liveStatus = document.getElementById("youtubeLiveStatus");

  // CONECTAR CUENTA DE YOUTUBE
  if (connectButton && status) {
    connectButton.addEventListener("click", () => {
      status.textContent = "Conectando con YouTube...";

      if (!window.JVYouTube) {
        status.textContent = "Error: módulo de YouTube no disponible.";
        return;
      }

      window.JVYouTube.connect();
    });

    window.addEventListener("youtube-connected", (event) => {
      const channel = event.detail;

      status.textContent = `Conectado: ${channel.title}`;
      connectButton.textContent = "YouTube conectado";
    });
  }

  // CREAR TRANSMISIÓN DE PRUEBA
  if (createLiveButton && liveStatus) {
    createLiveButton.addEventListener("click", async () => {
      try {
        liveStatus.textContent = "Creando transmisión de prueba...";
        createLiveButton.disabled = true;

        if (!window.JVYouTubeLive) {
          throw new Error("Módulo YouTube Live no disponible.");
        }

        if (!window.JVYouTube?.getAccessToken?.()) {
          throw new Error("Primero conecta tu cuenta de YouTube.");
        }

        const session = await window.JVYouTubeLive.createSession({
          title: "JV Broadcast - Prueba",
          description: "Prueba de integración JV Broadcast con YouTube Live",
          privacyStatus: "unlisted",
          resolution: "720p",
          frameRate: "30fps"
        });

        liveStatus.textContent =
          `Transmisión creada correctamente. ID: ${session.broadcastId}`;

        console.log("YouTube Live Session:", session);
      } catch (error) {
        console.error("Error creando transmisión:", error);
        liveStatus.textContent = `Error: ${error.message}`;
      } finally {
        createLiveButton.disabled = false;
      }
    });
  }
});
