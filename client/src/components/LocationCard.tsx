import { memo, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { ClientAction, LocationTodo } from "../types";
import "./LocationCard.css";

type LocationCardProps = {
  location: LocationTodo;
  onAction: (action: ClientAction) => void;
  canEdit: boolean;
  onFocusLocation: (longitude: number, latitude: number) => void;
};

type EditorState =
  | { kind: "location" }
  | { kind: "item"; itemId: string }
  | null;

const LocationCardComponent = ({
  location,
  onAction,
  canEdit,
  onFocusLocation,
}: LocationCardProps) => {
  const [editorState, setEditorState] = useState<EditorState>(null);
  const [editorDraft, setEditorDraft] = useState("");
  const [newItemText, setNewItemText] = useState("");
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!editorState) {
      return;
    }

    if (editorState.kind === "location") {
      setEditorDraft(location.name);
      return;
    }

    const item = location.items.find((entry) => entry.id === editorState.itemId);
    setEditorDraft(item?.text ?? "");
  }, [editorState, location]);

  const doneCount = location.items.filter((item) => item.done).length;

  const openLocationEditor = () => {
    setEditorState({ kind: "location" });
    setEditorDraft(location.name);
  };

  const openItemEditor = (itemId: string) => {
    const item = location.items.find((entry) => entry.id === itemId);
    setEditorState({ kind: "item", itemId });
    setEditorDraft(item?.text ?? "");
  };

  const closeEditor = () => {
    setEditorState(null);
    setEditorDraft("");
  };

  const submitEditor = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editorState || !canEdit) {
      return;
    }

    const trimmed = editorDraft.trim();
    if (!trimmed) {
      return;
    }

    if (editorState.kind === "location") {
      if (trimmed !== location.name) {
        onAction({
          type: "rename_location",
          locationId: location.id,
          name: trimmed,
        });
      }
    } else {
      const item = location.items.find((entry) => entry.id === editorState.itemId);
      if (item && trimmed !== item.text) {
        onAction({
          type: "update_item",
          locationId: location.id,
          itemId: item.id,
          text: trimmed,
        });
      }
    }

    closeEditor();
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
    setIsAddingItem(false);
  };

  const cancelAddItem = () => {
    setNewItemText("");
    setIsAddingItem(false);
  };

  return (
    <section
      id={`location-card-${location.id}`}
      data-location-id={location.id}
      className="location-card"
    >
      <div className="location-header">
        <div className="location-title-line">
          <button
            type="button"
            className="button subtle caret-toggle"
            onClick={() => setIsCollapsed((current) => !current)}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "Expand location" : "Collapse location"}
          >
            {isCollapsed ? "▸" : "▾"}
          </button>
          <div className="location-title-wrapper">
            <div className="location-title">{location.name}</div>
            <div className="location-subtitle">{doneCount}/{location.items.length} tasks</div>
          </div>
        </div>
        <div className="location-actions location-actions-below">
          {canEdit ? (
            <button
              type="button"
              className="button subtle location-action-button"
              onClick={openLocationEditor}
            >
              Edit
            </button>
          ) : null}

          {canEdit ? (
            <button
              type="button"
              className="button danger location-action-button"
              onClick={() =>
                onAction({
                  type: "delete_location",
                  locationId: location.id,
                })
              }
            >
              Delete
            </button>
          ) : null}

          <button
            type="button"
            className="button subtle location-action-button"
            onClick={() =>
              onFocusLocation(location.longitude, location.latitude)
            }
          >
            Zoom
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <>
          <ul className="items-list">
            {location.items.map((item) => (
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
                <span className={`todo-item-text ${item.done ? "is-done" : ""}`}>
                  {item.text}
                </span>
                {canEdit ? (
                  <button
                    type="button"
                    className="button subtle location-action-button"
                    onClick={() => openItemEditor(item.id)}
                  >
                    Edit
                  </button>
                ) : null}
                {canEdit ? (
                  <button
                    type="button"
                    className="button danger location-action-button"
                    onClick={() =>
                      onAction({
                        type: "delete_item",
                        locationId: location.id,
                        itemId: item.id,
                      })
                    }
                  >
                    Delete
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          {canEdit ? (
            isAddingItem ? (
              <form className="new-item-form" onSubmit={addItem}>
                <input
                  id={`new-item-${location.id}`}
                  className="new-item-input"
                  value={newItemText}
                  onChange={(event) => setNewItemText(event.target.value)}
                  onBlur={() => {
                    if (newItemText.trim().length === 0) {
                      cancelAddItem();
                    }
                  }}
                  placeholder="Add task"
                  autoFocus
                />
                <div className="new-item-actions">
                  <button
                    type="submit"
                    className="button primary location-action-button"
                    disabled={newItemText.trim().length === 0}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    className="button subtle location-action-button"
                    onClick={cancelAddItem}
                  >
                    Delete
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="button subtle add-task-button"
                onClick={() => setIsAddingItem(true)}
                aria-label="Add task"
                title="Add task"
              >
                +
              </button>
            )
          ) : null}
        </>
      ) : null}

      {editorState && canEdit ? (
        <div className="location-editor-backdrop" role="presentation" onClick={closeEditor}>
          <div className="location-editor-dialog" role="dialog" aria-modal="true" aria-label={editorState.kind === "location" ? "Edit location" : "Edit task"} onClick={(event) => event.stopPropagation()}>
            <form className="location-editor-form" onSubmit={submitEditor}>
              <label className="field-label" htmlFor={`editor-${location.id}`}>
                {editorState.kind === "location" ? "Edit location" : "Edit task"}
              </label>
              <input
                id={`editor-${location.id}`}
                value={editorDraft}
                onChange={(event) => setEditorDraft(event.target.value)}
                autoFocus
              />
              <div className="location-editor-actions">
                <button
                  type="button"
                  className="button subtle location-action-button"
                  onClick={closeEditor}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button primary location-action-button"
                  disabled={editorDraft.trim().length === 0}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export const LocationCard = memo(LocationCardComponent);
