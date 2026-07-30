export type PhotoDimensions = {
  id: string;
  width: number;
  height: number;
};

export type JustifiedPhoto<T extends PhotoDimensions> = {
  photo: T;
  width: number;
  height: number;
};

export type JustifiedPhotoRow<T extends PhotoDimensions> = {
  items: JustifiedPhoto<T>[];
  height: number;
  justified: boolean;
};

type BuildJustifiedRowsOptions = {
  containerWidth: number;
  targetRowHeight: number;
  gap: number;
};

function rowHeight(photos: PhotoDimensions[], containerWidth: number, gap: number): number {
  const availableWidth = containerWidth - gap * Math.max(0, photos.length - 1);
  const totalAspectRatio = photos.reduce((sum, photo) => sum + photo.width / photo.height, 0);
  return availableWidth / totalAspectRatio;
}

function buildRow<T extends PhotoDimensions>(
  photos: T[],
  height: number,
  containerWidth: number,
  gap: number,
  justified: boolean,
): JustifiedPhotoRow<T> {
  const widths = photos.map((photo) => (photo.width / photo.height) * height);

  if (justified && widths.length > 0) {
    const occupiedWidth = widths.reduce((sum, width) => sum + width, 0);
    widths[widths.length - 1] =
      widths[widths.length - 1] +
      containerWidth -
      occupiedWidth -
      gap * Math.max(0, widths.length - 1);
  }

  return {
    height,
    justified,
    items: photos.map((photo, index) => ({
      photo,
      width: widths[index],
      height,
    })),
  };
}

export function buildJustifiedRows<T extends PhotoDimensions>(
  photos: T[],
  options: BuildJustifiedRowsOptions,
): JustifiedPhotoRow<T>[] {
  const { containerWidth, targetRowHeight, gap } = options;

  if (
    photos.length === 0 ||
    !Number.isFinite(containerWidth) ||
    !Number.isFinite(targetRowHeight) ||
    !Number.isFinite(gap) ||
    containerWidth <= 0 ||
    targetRowHeight <= 0 ||
    gap < 0
  ) {
    return [];
  }

  const rows: JustifiedPhotoRow<T>[] = [];
  let pending: T[] = [];

  for (const photo of photos) {
    if (photo.width <= 0 || photo.height <= 0) {
      throw new RangeError(`照片 ${photo.id} 的尺寸必须大于 0`);
    }

    pending.push(photo);
    const height = rowHeight(pending, containerWidth, gap);

    if (height <= targetRowHeight) {
      rows.push(buildRow(pending, height, containerWidth, gap, true));
      pending = [];
    }
  }

  if (pending.length > 0) {
    const height = Math.min(targetRowHeight, rowHeight(pending, containerWidth, gap));
    rows.push(buildRow(pending, height, containerWidth, gap, false));
  }

  return rows;
}
