async function youtubeApiRequest(url, options = {}) {
  const token = window.JVYouTube?.getAccessToken?.();

  if (!token) {
    throw new Error("YouTube no está conectado.");
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `YouTube API error ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function createYouTubeBroadcast({
  title,
  description = "",
  privacyStatus = "unlisted",
  scheduledStartTime = null
}) {
  const startTime =
    scheduledStartTime ||
    new Date(Date.now() + 60 * 1000).toISOString();

  const broadcast = await youtubeApiRequest(
    "https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails",
    {
      method: "POST",
      body: JSON.stringify({
        snippet: {
          title,
          description,
          scheduledStartTime: startTime
        },
        status: {
          privacyStatus,
          selfDeclaredMadeForKids: false
        },
        contentDetails: {
          enableAutoStart: false,
          enableAutoStop: false
        }
      })
    }
  );

  return broadcast;
}

async function createYouTubeStream({
  title,
  resolution = "720p",
  frameRate = "30fps"
}) {
  const stream = await youtubeApiRequest(
    "https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn,status",
    {
      method: "POST",
      body: JSON.stringify({
        snippet: {
          title
        },
        cdn: {
          ingestionType: "rtmp",
          resolution,
          frameRate
        }
      })
    }
  );

  return stream;
}

async function bindYouTubeBroadcastToStream(broadcastId, streamId) {
  const url =
    `https://www.googleapis.com/youtube/v3/liveBroadcasts/bind` +
    `?part=id,contentDetails` +
    `&id=${encodeURIComponent(broadcastId)}` +
    `&streamId=${encodeURIComponent(streamId)}`;

  return await youtubeApiRequest(url, {
    method: "POST"
  });
}

async function createYouTubeLiveSession({
  title,
  description = "",
  privacyStatus = "unlisted",
  resolution = "720p",
  frameRate = "30fps"
}) {
  const broadcast = await createYouTubeBroadcast({
    title,
    description,
    privacyStatus
  });

  const stream = await createYouTubeStream({
    title: `${title} - Stream`,
    resolution,
    frameRate
  });

  await bindYouTubeBroadcastToStream(
    broadcast.id,
    stream.id
  );

  const ingestionInfo = stream?.cdn?.ingestionInfo || {};

  const result = {
    broadcastId: broadcast.id,
    streamId: stream.id,
    watchUrl: `https://www.youtube.com/watch?v=${broadcast.id}`,
    ingestionAddress:
      ingestionInfo.rtmpsIngestionAddress ||
      ingestionInfo.ingestionAddress ||
      "",
    streamName:
      ingestionInfo.streamName ||
      ""
  };

  window.JVYouTubeLiveSession = result;

  window.dispatchEvent(
    new CustomEvent("youtube-live-session-created", {
      detail: result
    })
  );

  return result;
}

window.JVYouTubeLive = {
  createBroadcast: createYouTubeBroadcast,
  createStream: createYouTubeStream,
  bind: bindYouTubeBroadcastToStream,
  createSession: createYouTubeLiveSession,
  getCurrentSession: () =>
    window.JVYouTubeLiveSession || null
};
