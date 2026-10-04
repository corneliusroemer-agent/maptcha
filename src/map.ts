import { projection, type Place } from "./puzzle";

export function withoutLabels<T extends { layers: { type: string }[] }>(
  style: T,
): T {
  // Symbol layers contain text, road shields and oriented POI icons.
  return {
    ...style,
    layers: style.layers.filter((layer) => layer.type !== "symbol"),
  };
}

export async function mapImage(
  place: Place,
  metres: number,
  signal?: AbortSignal,
): Promise<string> {
  const [{ default: Map }, { default: View }, { fromLonLat }, { apply }] =
    await Promise.all([
      import("ol/Map.js"),
      import("ol/View.js"),
      import("ol/proj.js"),
      import("ol-mapbox-style"),
    ]);
  signal?.throwIfAborted();
  const requestSignal = AbortSignal.any([
    ...(signal ? [signal] : []),
    AbortSignal.timeout(15000),
  ]);
  const response = await fetch(
    import.meta.env.VITE_MAP_STYLE ||
      "https://tiles.openfreemap.org/styles/liberty",
    { signal: requestSignal },
  );
  if (!response.ok)
    throw new Error("Map style could not be loaded. Please retry.");
  const style = withoutLabels(await response.json());
  const { zoom, span } = projection(place.lat, place.lon, metres);
  const target = document.createElement("div");
  target.setAttribute("aria-hidden", "true");
  target.dataset.mapRenderer = "true";
  target.style.cssText =
    "position:fixed;left:-10000px;top:0;width:900px;height:900px;pointer-events:none;";
  document.body.append(target);
  const map = new Map({
    controls: [],
    interactions: [],
    pixelRatio: 1,
    view: new View({
      center: fromLonLat([place.lon, place.lat]),
      zoom: zoom + Math.log2(900 / span),
      maxZoom: 24,
    }),
  });
  let abort: (() => void) | undefined;
  try {
    return await new Promise<string>((resolve, reject) => {
      abort = () =>
        reject(
          requestSignal.reason?.name === "TimeoutError"
            ? new Error("Map request timed out. Please retry.")
            : requestSignal.reason,
        );
      requestSignal.addEventListener("abort", abort, { once: true });
      if (requestSignal.aborted) {
        abort();
        return;
      }
      apply(map, style, {
        transformRequest: (url) => new Request(url, { signal: requestSignal }),
      })
        .then(() => {
          if (requestSignal.aborted) return;
          for (const layer of map.getAllLayers()) {
            const source = layer.getSource();
            source?.on("tileloaderror" as never, () =>
              reject(
                new Error(
                  "Map tiles could not be loaded. Check your connection and retry.",
                ),
              ),
            );
          }
          map.once("rendercomplete", () => {
            try {
              const output = document.createElement("canvas");
              output.width = output.height = 900;
              const ctx = output.getContext("2d")!;
              ctx.fillStyle =
                getComputedStyle(map.getViewport()!).backgroundColor ||
                "#f2efe9";
              ctx.fillRect(0, 0, 900, 900);
              target
                .querySelectorAll<HTMLCanvasElement>(".ol-layer canvas")
                .forEach((canvas) => {
                  if (!canvas.width) return;
                  const opacity =
                    canvas.parentElement?.style.opacity || canvas.style.opacity;
                  ctx.globalAlpha = opacity === "" ? 1 : Number(opacity);
                  const matrix = new DOMMatrix(canvas.style.transform);
                  ctx.setTransform(
                    matrix.a,
                    matrix.b,
                    matrix.c,
                    matrix.d,
                    matrix.e,
                    matrix.f,
                  );
                  ctx.drawImage(canvas, 0, 0);
                });
              resolve(output.toDataURL("image/png"));
            } catch (error) {
              reject(error);
            }
          });
          map.setTarget(target);
          map.updateSize();
        })
        .catch(reject);
    });
  } finally {
    if (abort) requestSignal.removeEventListener("abort", abort);
    map.dispose();
    target.remove();
  }
}
