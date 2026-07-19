import { getStore } from "@netlify/blobs";

export default async (req) => {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const key = id && id !== "latest" ? `episodes/${id.replace(/^episodes\//, "")}` : "latest";

    const store = getStore("lektionen");
    const ab = await store.get(key, { type: "arrayBuffer" });
    if (!ab) {
      return new Response("Noch keine Lektion vorhanden. Rufe zuerst /.netlify/functions/generate-background auf und warte ~1 Minute.", { status: 404 });
    }

    const total = ab.byteLength;
    const range = req.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? parseInt(match[2], 10) : total - 1;
        if (start >= 0 && end < total && start <= end) {
          const chunk = ab.slice(start, end + 1);
          return new Response(chunk, {
            status: 206,
            headers: {
              "content-type": "audio/mpeg",
              "content-range": `bytes ${start}-${end}/${total}`,
              "content-length": String(chunk.byteLength),
              "accept-ranges": "bytes"
            }
          });
        }
        return new Response(null, {
          status: 416,
          headers: { "content-range": `bytes */${total}` }
        });
      }
    }

    return new Response(ab, {
      headers: {
        "content-type": "audio/mpeg",
        "content-length": String(total),
        "accept-ranges": "bytes"
      }
    });
  } catch (e) {
    return new Response("FEHLER: " + e.message, { status: 500 });
  }
};
