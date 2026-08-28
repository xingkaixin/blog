import type {
  PhotoAlbum,
  PhotoCatalogIndex,
  PhotoMonthCatalog,
  PhotoPeriod,
  PhotoRecord,
} from "./photo-catalog";
import type { PhotoView } from "./photo-location";

const PREVIEW_PHOTO_COUNT = 4;

export type AlbumOverviewItem = {
  id: string | null;
  title: string;
  count: number;
  meta: string;
  photos: PhotoRecord[];
};

type AlbumOverviewSummary = Omit<AlbumOverviewItem, "photos"> & { previewPeriods: PhotoPeriod[] };

export type PhotoAlbumSummary = PhotoAlbum & {
  count: number;
};

export type PhotoTimelineModel = {
  selectedAlbumId: string | null;
  selectedAlbum: PhotoAlbumSummary | undefined;
  albumSummaries: PhotoAlbumSummary[];
  visiblePeriods: PhotoPeriod[];
  allPhotoCount: number;
  totalPhotoCount: number;
  timelineRange: string;
};

export type PhotoWallModel = PhotoTimelineModel & {
  overviewPeriods: PhotoPeriod[];
  overviewItems: AlbumOverviewItem[];
};

type PhotoWallCatalogModel = PhotoTimelineModel & {
  overviewPeriods: PhotoPeriod[];
  overviewSummaries: AlbumOverviewSummary[];
};

export function buildPhotoWallCatalogModel(
  index: PhotoCatalogIndex | null,
  view: PhotoView,
): PhotoWallCatalogModel {
  const selectedAlbumId = view.mode === "timeline" ? view.albumId : null;
  if (!index) {
    return {
      selectedAlbumId,
      selectedAlbum: undefined,
      albumSummaries: [],
      visiblePeriods: [],
      overviewPeriods: [],
      overviewSummaries: [],
      allPhotoCount: 0,
      totalPhotoCount: 0,
      timelineRange: "",
    };
  }

  const albumCounts = new Map(index.albums.map((album) => [album.id, 0]));
  const periodsByAlbum = new Map(index.albums.map((album) => [album.id, [] as PhotoPeriod[]]));
  let allPhotoCount = 0;

  for (const period of index.periods) {
    allPhotoCount += period.count;
    for (const [albumId, count] of Object.entries(period.albumCounts)) {
      const albumPeriods = periodsByAlbum.get(albumId);
      if (!albumPeriods || count <= 0) {
        continue;
      }
      albumCounts.set(albumId, (albumCounts.get(albumId) ?? 0) + count);
      albumPeriods.push(period);
    }
  }

  const albumSummaries = index.albums.map((album) => ({
    ...album,
    count: albumCounts.get(album.id) ?? 0,
  }));
  const selectedAlbum = albumSummaries.find((album) => album.id === selectedAlbumId);
  const visiblePeriods = selectedAlbumId
    ? (periodsByAlbum.get(selectedAlbumId) ?? [])
    : index.periods;
  const overviewSummaries: AlbumOverviewSummary[] = [
    {
      id: null,
      title: "全部",
      count: allPhotoCount,
      meta: formatPeriodRange(index.periods),
      previewPeriods: previewPeriods(index.periods, null),
    },
    ...index.albums.map((album) => {
      const periods = periodsByAlbum.get(album.id) ?? [];
      return {
        id: album.id,
        title: album.title,
        count: albumCounts.get(album.id) ?? 0,
        meta: formatPeriodRange(periods),
        previewPeriods: previewPeriods(periods, album.id),
      };
    }),
  ];

  const previewMonths = new Set(
    overviewSummaries.flatMap((summary) => summary.previewPeriods.map((period) => period.month)),
  );
  return {
    selectedAlbumId,
    selectedAlbum,
    albumSummaries,
    visiblePeriods,
    overviewPeriods: index.periods.filter((period) => previewMonths.has(period.month)),
    overviewSummaries,
    allPhotoCount,
    totalPhotoCount: selectedAlbumId ? (selectedAlbum?.count ?? 0) : allPhotoCount,
    timelineRange: formatPeriodRange(visiblePeriods),
  };
}

export function buildPhotoWallModel(
  catalog: PhotoWallCatalogModel,
  monthCatalogs: Record<string, PhotoMonthCatalog>,
): PhotoWallModel {
  const { overviewSummaries, ...timeline } = catalog;
  return {
    ...timeline,
    overviewItems: overviewSummaries.map(({ previewPeriods, ...summary }) => ({
      ...summary,
      photos: previewPeriods.every((period) => monthCatalogs[period.month])
        ? previewPeriods
            .flatMap((period) =>
              monthCatalogs[period.month].photos.filter(
                (photo) => summary.id === null || photo.albumIds.includes(summary.id),
              ),
            )
            .slice(0, PREVIEW_PHOTO_COUNT)
        : [],
    })),
  };
}

function previewPeriods(periods: PhotoPeriod[], albumId: string | null): PhotoPeriod[] {
  const result: PhotoPeriod[] = [];
  let count = 0;
  for (const period of periods) {
    result.push(period);
    count += albumId === null ? period.count : (period.albumCounts[albumId] ?? 0);
    if (count >= PREVIEW_PHOTO_COUNT) {
      break;
    }
  }
  return result;
}

export function formatPeriodRange(periods: PhotoPeriod[]): string {
  const newest = periods[0]?.month;
  const oldest = periods.at(-1)?.month;
  if (!newest || !oldest) {
    return "";
  }
  if (newest === oldest) {
    const [year, month] = newest.split("-");
    return `${year}年${Number(month)}月`;
  }
  const newestYear = newest.slice(0, 4);
  const oldestYear = oldest.slice(0, 4);
  return newestYear === oldestYear ? newestYear : `${oldestYear} – ${newestYear}`;
}
