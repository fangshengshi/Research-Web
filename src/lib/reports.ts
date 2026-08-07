import manifest from "@/data/reports.json";

export type TrackKey = keyof typeof manifest.tracks;
export type Report = (typeof manifest.tracks)[TrackKey]["reports"][number];

export const tracks = manifest.tracks;
export const generatedAt = manifest.generatedAt;

export function getTrack(key: string) {
  if (!(key in tracks)) return undefined;
  return tracks[key as TrackKey];
}

export function getLatest(key: TrackKey) {
  const reports = tracks[key].reports;
  return reports.find((report) => report.latest) ?? reports[0];
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(`${date}T00:00:00Z`));
}
