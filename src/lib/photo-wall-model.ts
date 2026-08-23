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
  allPhotos: PhotoRecord[];
  filteredPhotos: PhotoRecord[];
};

export function buildPhotoWallModel(
  index: PhotoCatalogIndex | null,
  monthCatalogs: Record<string, PhotoMonthCatalog>,
  view: PhotoView,
): PhotoWallModel {
  const selectedAlbumId = view.mode === "timeline" ? view.albumId : null;
  if (!index) {
    return {
      selectedAlbumId,
      selectedAlbum: undefined,
      albumSummaries: [],
      visiblePeriods: [],
      overviewPeriods: [],
      overviewItems: [],
      allPhotos: [],
      filteredPhotos: [],
      allPhotoCount: 0,
      totalPhotoCount: 0,
      timelineRange: "",
    };
  }

  const albumCounts = new Map(index.albums.map((album) => [album.id, 0]));
  const periodsByAlbum = new Map(index.albums.map((album) => [album.id, [] as PhotoPeriod[]]));
  const previewCounts = new Map(index.albums.map((album) => [album.id, 0]));
  const previewMonths = new Set(index.periods.slice(0, 1).map((period) => period.month));
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
      const previewCount = previewCounts.get(albumId) ?? 0;
      if (previewCount < PREVIEW_PHOTO_COUNT) {
        previewMonths.add(period.month);
        previewCounts.set(albumId, previewCount + count);
      }
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
  const allPhotos = index.periods.flatMap((period) => monthCatalogs[period.month]?.photos ?? []);
  const previewPhotos = new Map(index.albums.map((album) => [album.id, [] as PhotoRecord[]]));
  const filteredPhotos: PhotoRecord[] = [];

  for (const photo of allPhotos) {
    if (!selectedAlbumId || photo.albumIds.includes(selectedAlbumId)) {
      filteredPhotos.push(photo);
    }
    for (const albumId of photo.albumIds) {
      const photos = previewPhotos.get(albumId);
      if (photos && photos.length < PREVIEW_PHOTO_COUNT) {
        photos.push(photo);
      }
    }
  }

  const overviewItems: AlbumOverviewItem[] = [
    {
      id: null,
      title: "全部",
      count: allPhotoCount,
      meta: formatPeriodRange(index.periods),
      photos: allPhotos.slice(0, PREVIEW_PHOTO_COUNT),
    },
    ...index.albums.map((album) => {
      const periods = periodsByAlbum.get(album.id) ?? [];
      return {
        id: album.id,
        title: album.title,
        count: albumCounts.get(album.id) ?? 0,
        meta: formatPeriodRange(periods),
        photos: previewPhotos.get(album.id) ?? [],
      };
    }),
  ];

  return {
    selectedAlbumId,
    selectedAlbum,
    albumSummaries,
    visiblePeriods,
    overviewPeriods: index.periods.filter((period) => previewMonths.has(period.month)),
    overviewItems,
    allPhotos,
    filteredPhotos,
    allPhotoCount,
    totalPhotoCount: selectedAlbumId ? (selectedAlbum?.count ?? 0) : allPhotoCount,
    timelineRange: formatPeriodRange(visiblePeriods),
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
