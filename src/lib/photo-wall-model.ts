import type {
  PhotoAlbum,
  PhotoCatalogIndex,
  PhotoMonthCatalog,
  PhotoPeriod,
  PhotoRecord,
} from "./photo-catalog";
import type { PhotoView } from "./photo-location";

export type AlbumOverviewItem = {
  id: string | null;
  title: string;
  count: number;
  meta: string;
  photos: PhotoRecord[];
};

export type PhotoWallPeriodModel = {
  selectedAlbumId: string | null;
  selectedAlbum: PhotoAlbum | undefined;
  visiblePeriods: PhotoPeriod[];
  overviewPeriods: PhotoPeriod[];
  totalPhotoCount: number;
  timelineRange: string;
};

export type PhotoTimelineModel = Omit<PhotoWallPeriodModel, "overviewPeriods">;

export type PhotoWallLoadedModel = {
  overviewItems: AlbumOverviewItem[];
  allPhotos: PhotoRecord[];
  filteredPhotos: PhotoRecord[];
};

export function buildPhotoWallPeriodModel(
  index: PhotoCatalogIndex | null,
  view: PhotoView,
): PhotoWallPeriodModel {
  const selectedAlbumId = view.mode === "timeline" ? view.albumId : null;
  if (!index) {
    return {
      selectedAlbumId,
      selectedAlbum: undefined,
      visiblePeriods: [],
      overviewPeriods: [],
      totalPhotoCount: 0,
      timelineRange: "",
    };
  }

  const visiblePeriods = index.periods.filter(
    (period) => !selectedAlbumId || (period.albumCounts[selectedAlbumId] ?? 0) > 0,
  );
  return {
    selectedAlbumId,
    selectedAlbum: index.albums.find((album) => album.id === selectedAlbumId),
    visiblePeriods,
    overviewPeriods: previewPeriods(index),
    totalPhotoCount: visiblePeriods.reduce(
      (sum, period) =>
        sum + (selectedAlbumId ? (period.albumCounts[selectedAlbumId] ?? 0) : period.count),
      0,
    ),
    timelineRange: formatPeriodRange(visiblePeriods),
  };
}

export function buildPhotoWallLoadedModel(
  index: PhotoCatalogIndex | null,
  monthCatalogs: Record<string, PhotoMonthCatalog>,
  selectedAlbumId: string | null,
): PhotoWallLoadedModel {
  if (!index) {
    return { overviewItems: [], allPhotos: [], filteredPhotos: [] };
  }

  const allPhotos = index.periods.flatMap((period) => monthCatalogs[period.month]?.photos ?? []);
  const totalCount = index.periods.reduce((sum, period) => sum + period.count, 0);
  const overviewItems = index.albums.map((album) => {
    const periods = index.periods.filter((period) => (period.albumCounts[album.id] ?? 0) > 0);
    return {
      id: album.id,
      title: album.title,
      count: periods.reduce((sum, period) => sum + (period.albumCounts[album.id] ?? 0), 0),
      meta: formatPeriodRange(periods),
      photos: allPhotos.filter((photo) => photo.albumIds.includes(album.id)).slice(0, 4),
    };
  });

  return {
    overviewItems: [
      {
        id: null,
        title: "全部",
        count: totalCount,
        meta: formatPeriodRange(index.periods),
        photos: allPhotos.slice(0, 4),
      },
      ...overviewItems,
    ],
    allPhotos,
    filteredPhotos: allPhotos.filter(
      (photo) => !selectedAlbumId || photo.albumIds.includes(selectedAlbumId),
    ),
  };
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

function previewPeriods(index: PhotoCatalogIndex): PhotoPeriod[] {
  const neededMonths = new Set(index.periods.slice(0, 1).map((period) => period.month));
  for (const album of index.albums) {
    let previewCount = 0;
    for (const period of index.periods) {
      const count = period.albumCounts[album.id] ?? 0;
      if (count === 0) {
        continue;
      }
      neededMonths.add(period.month);
      previewCount += count;
      if (previewCount >= 4) {
        break;
      }
    }
  }
  return index.periods.filter((period) => neededMonths.has(period.month));
}
