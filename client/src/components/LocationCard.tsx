import { memo, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { ClientAction, LocationTodo } from "../types";

type LocationCardProps = {
  location: LocationTodo;
  onAction: (action: ClientAction) => void;
  canEdit: boolean;
  onFocusLocation: (longitude: number, latitude: number) => void;
};

const LocationCardComponent = ({
  location,
  onAction,
  canEdit,
  onFocusLocation,
}: LocationCardProps) => {
  const [locationName, setLocationName] = useState(location.name);
  const [newItemText, setNewItemText] = useState("");
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setLocationName(location.name);
    setItemDrafts(
      Object.fromEntries(location.items.map((item) => [item.id, item.text])),
    );
  }, [location]);

  const doneCount = location.items.filter((item) => item.done).length;

  const submitRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = locationName.trim();
    if (!trimmed || trimmed === location.name || !canEdit) {
      return;
    }

    onAction({
      type: "rename_location",
      locationId: location.id,
      name: trimmed,
    });
  };

  const addItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newItemText.trim();
    if (!trimmed || !canEdit) {
      return;
    }

    onAction({
      type: "add_item",
      locationId: location.id,
      text: trimmed,
    });
    setNewItemText("");
  };

  return (
    <section
      id={`location-card-${location.id}`}
      data-location-id={location.id}
      className="location-card"
    >
      <form className="location-header" onSubmit={submitRename}>
        <div>
          <label
            className="field-label"
            htmlFor={`location-name-${location.id}`}
          >
            Location - {doneCount}/{location.items.length} done
          </label>
          <div className="location-title-row">
            <input
              id={`location-name-${location.id}`}
              value={locationName}
              onChange={(event) => setLocationName(event.target.value)}
              style={{ border: !canEdit ? "none" : undefined }}
              className="location-title-input"
              disabled={!canEdit}
            />
            <button
              type="button"
              className="button subtle location-focus-button"
              style={{ border: "none", padding: 0 }}
              onClick={() =>
                onFocusLocation(location.longitude, location.latitude)
              }
              aria-label="View on map"
              title="View on map"
            >
              <svg
                className="button-icon"
                viewBox="0 -2 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M12 2a5.5 5.5 0 0 1 5.5 5.5c0 4.18-4.4 9.35-5.1 10.15a.5.5 0 0 1-.76 0c-.7-.8-5.14-5.97-5.14-10.15A5.5 5.5 0 0 1 12 2Zm0 2a3.5 3.5 0 0 0-3.5 3.5c0 2.38 2.2 5.63 3.5 7.31 1.28-1.68 3.5-4.93 3.5-7.31A3.5 3.5 0 0 0 12 4Zm0 1.75A1.75 1.75 0 1 1 10.25 7.5 1.75 1.75 0 0 1 12 5.75Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>
        {canEdit && (
          <div className="location-actions">
            <button
              type="submit"
              disabled={
                !canEdit ||
                locationName.trim().length === 0 ||
                locationName.trim() === location.name
              }
              className="button subtle location-focus-button"
              style={{ border: "none", padding: 0 }}
              aria-label="Save location name"
              title="Save location name"
            >
              <svg
                className="button-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M5 3.5A1.5 1.5 0 0 0 3.5 5v14A1.5 1.5 0 0 0 5 20.5h14a1.5 1.5 0 0 0 1.5-1.5V8.62a1.5 1.5 0 0 0-.44-1.06l-3.62-3.62A1.5 1.5 0 0 0 15.38 3.5H5Zm1 1.5h7v4H6V5Zm0 6.5h12V19H6v-7.5Zm3 2a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0V15h6v2.25a.75.75 0 0 0 1.5 0v-3a.75.75 0 0 0-.75-.75H9Z"
                  fill="currentColor"
                />
              </svg>
            </button>

            <button
              type="button"
              className="button danger location-focus-button"
              style={{ border: "none", padding: 0 }}
              disabled={!canEdit}
              onClick={() =>
                onAction({
                  type: "delete_location",
                  locationId: location.id,
                })
              }
              aria-label="Delete location"
              title="Delete location"
            >
              <svg
                className="button-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M9 3.5a1 1 0 0 0-1 1V6H5a.75.75 0 0 0 0 1.5h.73l.85 11.26A2.25 2.25 0 0 0 8.82 20.9h6.36a2.25 2.25 0 0 0 2.24-2.14l.85-11.26H19a.75.75 0 0 0 0-1.5h-3V4.5a1 1 0 0 0-1-1H9Zm1.5 2.5V5h3v1H10.5Zm-2.12 1.5h7.24l-.84 11.13a.75.75 0 0 1-.75.72H10a.75.75 0 0 1-.75-.72L8.38 7.5Zm2.12 2.1a.75.75 0 0 0-.75.75v5.7a.75.75 0 0 0 1.5 0v-5.7a.75.75 0 0 0-.75-.75Zm3 0a.75.75 0 0 0-.75.75v5.7a.75.75 0 0 0 1.5 0v-5.7a.75.75 0 0 0-.75-.75Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        )}
      </form>

      <ul className="items-list">
        {location.items.map((item) => {
          const draft = itemDrafts[item.id] ?? "";
          const trimmedDraft = draft.trim();
          const isUnchanged = trimmedDraft === item.text;

          return (
            <li key={item.id} className="todo-item-row">
              <label className="checkbox-wrap">
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={!canEdit}
                  onChange={(event) =>
                    onAction({
                      type: "toggle_item",
                      locationId: location.id,
                      itemId: item.id,
                      done: event.target.checked,
                    })
                  }
                />
              </label>
              <input
                style={{ border: !canEdit ? "none" : undefined }}
                className={`todo-item-input ${item.done ? "is-done" : ""}`}
                value={draft}
                disabled={!canEdit}
                onChange={(event) =>
                  setItemDrafts((previous) => ({
                    ...previous,
                    [item.id]: event.target.value,
                  }))
                }
              />
              {canEdit && (
                <>
                  <button
                    type="button"
                    className="button subtle location-focus-button"
                    style={{ border: "none", padding: 0 }}
                    disabled={
                      !canEdit || trimmedDraft.length === 0 || isUnchanged
                    }
                    onClick={() =>
                      onAction({
                        type: "update_item",
                        locationId: location.id,
                        itemId: item.id,
                        text: trimmedDraft,
                      })
                    }
                    aria-label="Save item"
                    title="Save item"
                  >
                    <svg
                      className="button-icon"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path
                        d="M5 3.5A1.5 1.5 0 0 0 3.5 5v14A1.5 1.5 0 0 0 5 20.5h14a1.5 1.5 0 0 0 1.5-1.5V8.62a1.5 1.5 0 0 0-.44-1.06l-3.62-3.62A1.5 1.5 0 0 0 15.38 3.5H5Zm1 1.5h7v4H6V5Zm0 6.5h12V19H6v-7.5Zm3 2a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0V15h6v2.25a.75.75 0 0 0 1.5 0v-3a.75.75 0 0 0-.75-.75H9Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="button danger location-focus-button"
                    style={{ border: "none", padding: 0 }}
                    disabled={!canEdit}
                    onClick={() =>
                      onAction({
                        type: "delete_item",
                        locationId: location.id,
                        itemId: item.id,
                      })
                    }
                    aria-label="Delete item"
                    title="Delete item"
                  >
                    <svg
                      className="button-icon"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path
                        d="M9 3.5a1 1 0 0 0-1 1V6H5a.75.75 0 0 0 0 1.5h.73l.85 11.26A2.25 2.25 0 0 0 8.82 20.9h6.36a2.25 2.25 0 0 0 2.24-2.14l.85-11.26H19a.75.75 0 0 0 0-1.5h-3V4.5a1 1 0 0 0-1-1H9Zm1.5 2.5V5h3v1H10.5Zm-2.12 1.5h7.24l-.84 11.13a.75.75 0 0 1-.75.72H10a.75.75 0 0 1-.75-.72L8.38 7.5Zm2.12 2.1a.75.75 0 0 0-.75.75v5.7a.75.75 0 0 0 1.5 0v-5.7a.75.75 0 0 0-.75-.75Zm3 0a.75.75 0 0 0-.75.75v5.7a.75.75 0 0 0 1.5 0v-5.7a.75.75 0 0 0-.75-.75Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {canEdit && (
        <form className="new-item-form" onSubmit={addItem}>
          <label className="field-label" htmlFor={`new-item-${location.id}`}>
            Add item
          </label>
          <div className="row">
            <input
              id={`new-item-${location.id}`}
              value={newItemText}
              onChange={(event) => setNewItemText(event.target.value)}
              placeholder="e.g. Take photos of storefront"
              disabled={!canEdit}
            />
            <button
              type="submit"
              className="button primary"
              disabled={!canEdit || newItemText.trim().length === 0}
            >
              Add
            </button>
          </div>
        </form>
      )}
    </section>
  );
};

export const LocationCard = memo(LocationCardComponent);
