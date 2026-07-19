import { getStore } from "@netlify/blobs";

const CHANNEL_TITLE = "Spanisch-Lektionen";
const CHANNEL_DESCRIPTION = "Automatisch erzeugte spanische Hör-Lektionen für unterwegs – zum freihändigen Anhören beim Autofahren, Kochen oder Putzen.";
const CHANNEL_LANGUAGE = "de-de";
const CHANNEL_AUTHOR = "Spanisch-Lektionen";
const COVER_IMAGE_PATH = "/cover.jpg";

function escapeXml(str) {
  return String(str).replace(/[<>&'"]/g, (c) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;"
  })[c]);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function titleForEpisode(topic, created) {
  if (topic) return `Spanisch-Lektion: ${capitalize(topic)}`;
  const d = created ? new Date(created) : new Date();
  return `Spanisch-Lektion – ${d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}`;
}

var feed_src_default = async (req) => {
  try {
    const store = getStore("lektionen");
    const { blobs } = await store.list({ prefix: "episodes/" });
    const keys = blobs.map((b) => b.key).sort().reverse();

    const episodes = [];
    for (const key of keys) {
      const result = await store.getMetadata(key);
      episodes.push({
        key,
        created: result?.metadata?.created ?? null,
        bytes: Number(result?.metadata?.bytes) || 0,
        topic: result?.metadata?.topic ?? null
      });
    }

    const origin = new URL(req.url).origin;
    const items = episodes.map(({ key, created, bytes, topic }) => {
      const pubDate = created ? new Date(created).toUTCString() : new Date().toUTCString();
      const enclosureUrl = `${origin}/.netlify/functions/lektion?id=${encodeURIComponent(key)}`;
      const dateLabel = created ? new Date(created).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) : "";
      return `
    <item>
      <title>${escapeXml(titleForEpisode(topic, created))}</title>
      <description>${escapeXml(dateLabel)}</description>
      <guid isPermaLink="false">${escapeXml(key)}</guid>
      <pubDate>${pubDate}</pubDate>
      <enclosure url="${escapeXml(enclosureUrl)}" length="${bytes}" type="audio/mpeg" />
    </item>`;
    }).join("");

    const coverUrl = `${origin}${COVER_IMAGE_PATH}`;
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>${escapeXml(CHANNEL_TITLE)}</title>
    <link>${escapeXml(origin)}</link>
    <description>${escapeXml(CHANNEL_DESCRIPTION)}</description>
    <language>${CHANNEL_LANGUAGE}</language>
    <itunes:explicit>false</itunes:explicit>
    <itunes:category text="Education" />
    <itunes:author>${escapeXml(CHANNEL_AUTHOR)}</itunes:author>
    <itunes:image href="${escapeXml(coverUrl)}" />
    <image>
      <url>${escapeXml(coverUrl)}</url>
      <title>${escapeXml(CHANNEL_TITLE)}</title>
      <link>${escapeXml(origin)}</link>
    </image>${items}
  </channel>
</rss>`;

    return new Response(rss, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
  } catch (e) {
    return new Response("FEHLER: " + e.message, { status: 500 });
  }
};

export {
  feed_src_default as default
};
