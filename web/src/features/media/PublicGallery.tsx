import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "../../components/ui/Icon";
import { apiMessage } from "../../lib/api";
import { getPublicPhotos } from "../../lib/media";
import type { PublicPhoto } from "../../lib/media";
import { PlanningDialog } from "../weddings/PlanningDialog";

export function PublicGallery({ publicId }: { publicId: string }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PublicPhoto | null>(null);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const query = useQuery({
    queryKey: ["public-photos", publicId, page],
    queryFn: ({ signal }) => getPublicPhotos(publicId, page, signal),
    staleTime: 30000,
    refetchInterval: selected ? false : 30000,
    refetchIntervalInBackground: false,
  });
  // Hide the gallery until an organizer has approved at least one photo.
  if (query.isPending || (!query.isError && query.data?.total === 0))
    return null;
  return (
    <section
      className="media-public-gallery celebration-container"
      id="guest-gallery"
    >
      <div className="media-section-heading">
        <div>
          <h2>Wedding photos</h2>
          <p>View and download photos approved by the organizers.</p>
        </div>
      </div>
      {query.isError && (
        <div className="media-notice" role="status">
          <p>{apiMessage(query.error)}</p>
          <button
            type="button"
            className="ws-button"
            onClick={() => void query.refetch()}
          >
            Try gallery again
          </button>
        </div>
      )}
      {query.data && (
        <div className="media-photo-grid">
          {query.data.photos.map((photo) => (
            <article className="media-photo" key={photo.id}>
              {!failedImages.includes(photo.id + photo.url) ? (
                <button
                  type="button"
                  className="media-photo-preview"
                  aria-label={"View photo " + photo.name}
                  onClick={() => setSelected(photo)}
                >
                  <img
                    src={photo.url}
                    width={photo.width}
                    height={photo.height}
                    alt={photo.name}
                    loading="lazy"
                    onError={() =>
                      setFailedImages((current) => [
                        ...current,
                        photo.id + photo.url,
                      ])
                    }
                  />
                </button>
              ) : (
                <div className="media-photo-unavailable">
                  <Icon name="camera" />
                  <p>This photo couldn’t be loaded.</p>
                  <button
                    type="button"
                    className="ws-text-link"
                    onClick={() => {
                      setFailedImages((current) =>
                        current.filter(
                          (value) => value !== photo.id + photo.url,
                        ),
                      );
                      void query.refetch();
                    }}
                  >
                    Try photo again
                  </button>
                </div>
              )}
              <div className="media-public-photo-caption">
                <span title={photo.name}>{photo.name}</span>
                <a href={photo.downloadUrl} download className="ws-text-link">
                  Download
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
      {query.data && query.data.total > query.data.pageSize && (
        <nav className="media-pagination" aria-label="Gallery pages">
          <button
            type="button"
            className="ws-button"
            disabled={page <= 1 || query.isFetching}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.ceil(query.data.total / query.data.pageSize)}
          </span>
          <button
            type="button"
            className="ws-button"
            disabled={
              page * query.data.pageSize >= query.data.total || query.isFetching
            }
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </nav>
      )}
      {selected && (
        <PlanningDialog
          title="Wedding photo"
          onClose={() => setSelected(null)}
          wide
        >
          <div className="media-lightbox">
            {!failedImages.includes("full" + selected.id + selected.url) ? (
              <img
                src={selected.url}
                width={selected.width}
                height={selected.height}
                alt={selected.name}
                onError={() =>
                  setFailedImages((current) => [
                    ...current,
                    "full" + selected.id + selected.url,
                  ])
                }
              />
            ) : (
              <p role="status">
                This photo couldn’t be loaded. Close it and try the gallery
                again.
              </p>
            )}
            <a
              href={selected.downloadUrl}
              download
              className="ws-button ws-primary"
            >
              Download photo
            </a>
          </div>
        </PlanningDialog>
      )}
    </section>
  );
}
