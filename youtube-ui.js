document.addEventListener("DOMContentLoaded", () => {
  const connectButton = document.getElementById("connectYouTubeBtn");
  const status = document.getElementById("youtubeAccountStatus");

  if (!connectButton || !status) return;

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
});
