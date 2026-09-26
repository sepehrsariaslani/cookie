export type LocationRequestIdentity = { id: number; revision: number };

/** Ignore a geolocation response after its address or request has changed. */
export function isCurrentLocationRequest(
  request: LocationRequestIdentity,
  activeRequestId: number,
  currentRevision: number,
) {
  return request.id === activeRequestId && request.revision === currentRevision;
}
