import { projection, type Place } from "./puzzle";
const tileURL =
  import.meta.env.VITE_TILE_URL ||
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
function image(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timeout = setTimeout(() => {
      img.src = "";
      reject(new Error("Map request timed out. Please retry."));
    }, 15000);
    img.onload = () => {
      clearTimeout(timeout);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      reject(
        new Error(
          "Map tiles could not be loaded. Check your connection and retry.",
        ),
      );
    };
    img.src = url;
  });
}
export async function mapImage(place: Place, metres: number): Promise<string> {
  const { zoom, world, x, y, span } = projection(place.lat, place.lon, metres);
  const left = x - span / 2,
    top = y - span / 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 900;
  const ctx = canvas.getContext("2d")!;
  const scale = 900 / span,
    count = world / 256;
  const jobs: Promise<void>[] = [];
  for (
    let tx = Math.floor(left / 256);
    tx <= Math.floor((left + span) / 256);
    tx++
  ) {
    for (
      let ty = Math.floor(top / 256);
      ty <= Math.floor((top + span) / 256);
      ty++
    ) {
      const tileY = Math.max(0, Math.min(count - 1, ty));
      const tileX = ((tx % count) + count) % count;
      const url = tileURL
        .replace("{z}", String(zoom))
        .replace("{x}", String(tileX))
        .replace("{y}", String(tileY));
      jobs.push(
        image(url).then((img) => {
          ctx.drawImage(
            img,
            (tx * 256 - left) * scale,
            (ty * 256 - top) * scale,
            256 * scale,
            256 * scale,
          );
        }),
      );
    }
  }
  await Promise.all(jobs);
  return canvas.toDataURL("image/png");
}
