import type {
  PhotoAlbum,
  PhotoCatalogIndex,
  PhotoMonthCatalog,
  PhotoPeriod,
  PhotoRecord,
} from "./photo-catalog";

const FEATURED_PREVIEW_COUNT = 3;
const CARD_PREVIEW_COUNT = 1;

export type AlbumOverviewItem = {
  id: string;
  title: string;
  count: number;
  latestMonth: string;
  status: "loading" | "ready" | "error";
  photos: PhotoRecord[];
};

type AlbumOverviewSummary = Omit<AlbumOverviewItem, "status" | "photos"> & {
  previewCount: number;
  previewPeriods: PhotoPeriod[];
};

export type PhotoAlbumSummary = PhotoAlbum & {
  count: number;
};

export type JourneyYear = {
  year: string;
  albums: PhotoAlbumSummary[];
};

export type PhotoTimelineModel = {
  selectedAlbumId: string | null;
  selectedAlbum: PhotoAlbumSummary | undefined;
  companionAlbums: PhotoAlbumSummary[];
  visiblePeriods: PhotoPeriod[];
  allPhotoCount: number;
  totalPhotoCount: number;
  timelineRange: string;
};

type PhotoWallCatalogModel = PhotoTimelineModel & {
  albumCount: number;
  allPhotoRange: string;
  journeyYears: JourneyYear[];
  overviewPeriods: PhotoPeriod[];
  overviewSummaries: AlbumOverviewSummary[];
};

export function buildPhotoWallCatalogModel(
  index: PhotoCatalogIndex | null,
  selectedAlbumId: string | null,
): PhotoWallCatalogModel {
  if (!index) {
    return {
      selectedAlbumId,
      selectedAlbum: undefined,
      companionAlbums: [],
      visiblePeriods: [],
      albumCount: 0,
      allPhotoRange: "",
      journeyYears: [],
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

  const latestMonth = (albumId: string) => periodsByAlbum.get(albumId)?.[0]?.month ?? "";
  // 目录按 id 排列；总览与同期城市都按最近一次到访倒序展示。
  const albumSummaries = index.albums
    .map((album) => ({ ...album, count: albumCounts.get(album.id) ?? 0 }))
    .toSorted((left, right) => latestMonth(right.id).localeCompare(latestMonth(left.id)));
  const selectedAlbum = albumSummaries.find((album) => album.id === selectedAlbumId);
  const visiblePeriods = selectedAlbumId
    ? (periodsByAlbum.get(selectedAlbumId) ?? [])
    : index.periods;
  const selectedMonths = new Set(visiblePeriods.map((period) => period.month));
  const companionAlbums = selectedAlbum
    ? albumSummaries.filter((album) =>
        periodsByAlbum.get(album.id)?.some((period) => selectedMonths.has(period.month)),
      )
    : [];
  const overviewSummaries = albumSummaries.map((album, position): AlbumOverviewSummary => {
    const previewCount = position === 0 ? FEATURED_PREVIEW_COUNT : CARD_PREVIEW_COUNT;
    return {
      ...album,
      latestMonth: latestMonth(album.id).replace("-", "."),
      previewCount,
      previewPeriods: previewPeriods(periodsByAlbum.get(album.id) ?? [], album.id, previewCount),
    };
  });

  const previewMonths = new Set(
    overviewSummaries.flatMap((summary) => summary.previewPeriods.map((period) => period.month)),
  );
  return {
    selectedAlbumId,
    selectedAlbum,
    companionAlbums,
    visiblePeriods,
    albumCount: index.albums.length,
    allPhotoRange: formatPeriodRange(index.periods),
    journeyYears: buildJourneyYears(index),
    overviewPeriods: index.periods.filter((period) => previewMonths.has(period.month)),
    overviewSummaries,
    allPhotoCount,
    totalPhotoCount: selectedAlbumId ? (selectedAlbum?.count ?? 0) : allPhotoCount,
    timelineRange: formatPeriodRange(visiblePeriods),
  };
}

export function buildOverviewItems(
  summaries: AlbumOverviewSummary[],
  monthCatalogs: Record<string, PhotoMonthCatalog>,
  monthErrors: Record<string, string>,
): AlbumOverviewItem[] {
  return summaries.map(({ previewPeriods, previewCount, ...summary }) => {
    if (!previewPeriods.every((period) => monthCatalogs[period.month])) {
      return {
        ...summary,
        status: previewPeriods.some((period) => period.month in monthErrors) ? "error" : "loading",
        photos: [],
      };
    }
    return {
      ...summary,
      status: "ready",
      photos: previewPeriods
        .flatMap((period) =>
          monthCatalogs[period.month].photos.filter((photo) => photo.albumIds.includes(summary.id)),
        )
        .slice(0, previewCount),
    };
  });
}

function buildJourneyYears(index: PhotoCatalogIndex): JourneyYear[] {
  const titles = new Map(index.albums.map((album) => [album.id, album.title]));
  const years = new Map<string, Map<string, number>>();
  for (const period of index.periods) {
    const year = period.month.slice(0, 4);
    for (const [albumId, count] of Object.entries(period.albumCounts)) {
      if (count <= 0 || !titles.has(albumId)) {
        continue;
      }
      const albums = years.get(year) ?? new Map<string, number>();
      albums.set(albumId, (albums.get(albumId) ?? 0) + count);
      years.set(year, albums);
    }
  }
  return [...years].map(([year, albums]) => ({
    year,
    albums: [...albums].map(([id, count]) => ({ id, title: titles.get(id) ?? id, count })),
  }));
}

function previewPeriods(periods: PhotoPeriod[], albumId: string, limit: number): PhotoPeriod[] {
  const result: PhotoPeriod[] = [];
  let count = 0;
  for (const period of periods) {
    result.push(period);
    count += period.albumCounts[albumId] ?? 0;
    if (count >= limit) {
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
