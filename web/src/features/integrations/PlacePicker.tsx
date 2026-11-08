import { useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Icon } from "../../components/ui/Icon";
import { apiMessage } from "../../lib/api";
import { searchPlaces } from "../../lib/integrations";
import type { Place } from "../../lib/integrations";

// Only the place ID is saved. Google result details stay transient in this picker.
export function PlacePicker({
  onSelect,
  onClear,
  placeId = "",
  disabled = false,
}: {
  onSelect: (place: Place) => void;
  onClear: () => void;
  placeId?: string;
  disabled?: boolean;
}) {
  const searchId = useId();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Place | null>(null);
  const lookup = useMutation({ mutationFn: searchPlaces });
  return (
    <div className="place-picker">
      <label htmlFor={searchId}>Link a Google Maps place (optional)</label>
      <div className="place-picker-search">
        <input
          id={searchId}
          type="search"
          value={search}
          maxLength={100}
          placeholder="Venue or business name and city"
          disabled={disabled || lookup.isPending}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              if (search.trim().length >= 3 && !disabled && !lookup.isPending) {
                setSelected(null);
                lookup.mutate(search.trim());
              }
            }
          }}
        />
        <button
          className="ws-button"
          type="button"
          disabled={disabled || lookup.isPending || search.trim().length < 3}
          onClick={() => {
            setSelected(null);
            lookup.mutate(search.trim());
          }}
        >
          <Icon name="search" />
          {lookup.isPending ? "Searching…" : "Search"}
        </button>
      </div>
      <p className="place-picker-help">
        Link a place for directions. Enter your own venue or business name,
        address and coordinates in the fields below.
      </p>
      {lookup.isPending && (
        <p role="status" className="place-picker-help">
          Searching Google Maps…
        </p>
      )}
      {lookup.isError && (
        <p className="place-picker-error" role="alert">
          {apiMessage(lookup.error)} You can still enter the address manually.
        </p>
      )}
      {lookup.isSuccess && lookup.data.length === 0 && (
        <p role="status" className="place-picker-help">
          No places matched. Try a more specific name and city, or enter the
          details manually.
        </p>
      )}
      {Boolean(lookup.data?.length) && (
        <div className="place-picker-results">
          <ul aria-label="Google Maps search results">
            {lookup.data?.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  disabled={disabled || lookup.isPending}
                  onClick={() => {
                    onSelect(place);
                    setSelected(place);
                    lookup.reset();
                  }}
                >
                  <Icon name="pin" />
                  <span>
                    <strong>{place.name}</strong>
                    <span>{place.address}</span>
                  </span>
                  <span className="place-picker-use">Link this place</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="place-picker-attribution">
            Places results from <span translate="no">Google Maps</span>
          </p>
        </div>
      )}
      {placeId && (
        <div className="place-picker-selection">
          <p className="place-picker-success" role="status">
            {selected?.id === placeId
              ? selected.name + " is linked."
              : "A Google Maps place is linked."}
          </p>
          <div>
            <a
              className="ws-text-link"
              href={
                "https://www.google.com/maps/search/?api=1&query=Place&query_place_id=" +
                encodeURIComponent(placeId)
              }
              target="_blank"
              rel="noreferrer"
            >
              View linked place on Google Maps
            </a>
            <button
              className="ws-text-link"
              type="button"
              disabled={disabled}
              onClick={() => {
                setSelected(null);
                onClear();
              }}
            >
              Unlink place
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
