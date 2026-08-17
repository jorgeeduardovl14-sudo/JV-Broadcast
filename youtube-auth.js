let youtubeTokenClient = null;
let youtubeAccessToken = null;

function initYouTubeAuth() {
  if (!window.JV_YOUTUBE_CONFIG) {
    console.error("JV_YOUTUBE_CONFIG no está cargado.");
    return;
  }

  if (!window.google || !google.accounts || !google.accounts.oauth2) {
    console.error("Google Identity Services no está cargado.");
    return;
  }

  youtubeTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: window.JV_YOUTUBE_CONFIG.clientId,
    scope: window.JV_YOUTUBE_CONFIG.scope,
    callback: async (tokenResponse) => {
      if (tokenResponse.error) {
        console.error("Error OAuth:", tokenResponse);
        return;
      }

      youtubeAccessToken = tokenResponse.access_token;

      try {
        const channel = await getYouTubeChannel();
        console.log("Canal conectado:", channel);

        window.dispatchEvent(new CustomEvent("youtube-connected", {
          detail: channel
        }));
      } catch (error) {
        console.error("No se pudo obtener el canal de YouTube:", error);
      }
    }
  });
}

function connectYouTube() {
  if (!youtubeTokenClient) {
    initYouTubeAuth();
  }

  if (!youtubeTokenClient) {
    alert("No se pudo inicializar Google OAuth.");
    return;
  }

  youtubeTokenClient.requestAccessToken({
    prompt: "consent"
  });
}

async function getYouTubeChannel() {
  if (!youtubeAccessToken) {
    throw new Error("No hay access token de YouTube.");
  }

  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    {
      headers: {
        Authorization: `Bearer ${youtubeAccessToken}`
      }
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Error consultando YouTube.");
  }

  if (!data.items || data.items.length === 0) {
    throw new Error("No se encontró un canal de YouTube asociado.");
  }

  const channel = data.items[0];

  return {
    id: channel.id,
    title: channel.snippet?.title || "Canal de YouTube",
    thumbnail:
      channel.snippet?.thumbnails?.default?.url ||
      channel.snippet?.thumbnails?.medium?.url ||
      ""
  };
}

window.JVYouTube = {
  init: initYouTubeAuth,
  connect: connectYouTube,
  getChannel: getYouTubeChannel,
  getAccessToken: () => youtubeAccessToken
};
