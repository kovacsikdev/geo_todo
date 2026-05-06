let turfModulePromise: Promise<typeof import("@turf/turf")> | null = null;

function loadTurf() {
  if (!turfModulePromise) {
    turfModulePromise = import("@turf/turf");
  }

  return turfModulePromise;
}

export async function buildFocusBounds(longitude: number, latitude: number) {
  try {
    const { bbox, buffer, point } = await loadTurf();
    const target = point([longitude, latitude]);
    const area = buffer(target, 0.7, { units: "kilometers" });

    return area
      ? (bbox(area) as [number, number, number, number])
      : ([
          longitude - 0.01,
          latitude - 0.01,
          longitude + 0.01,
          latitude + 0.01,
        ] as [number, number, number, number]);
  } catch {
    return [
      longitude - 0.01,
      latitude - 0.01,
      longitude + 0.01,
      latitude + 0.01,
    ] as [number, number, number, number];
  }
}
