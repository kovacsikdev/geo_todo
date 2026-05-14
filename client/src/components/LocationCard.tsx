import { memo, useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ClientAction, LocationTodo } from "../types";
import "./LocationCard.css";

type LocationCardProps = {
  location: LocationTodo;
  onAction: (action: ClientAction) => void;
  canEdit: boolean;
  onFocusLocation: (longitude: number, latitude: number) => void;
  onStartDirections: (location: LocationTodo, mode: "driving" | "walking") => void;
};

type EditorState =
  | { kind: "location" }
  | { kind: "item"; itemId: string }
  | null;

type SortableTaskRowProps = {
  locationId: string;
  item: LocationTodo["items"][number];
  canEdit: boolean;
  onAction: (action: ClientAction) => void;
  onOpenEditor: (itemId: string) => void;
};

const SortableTaskRow = ({
  locationId,
  item,
  canEdit,
  onAction,
  onOpenEditor,
}: SortableTaskRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: !canEdit,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`todo-item-row ${isDragging ? "is-dragging" : ""}`}
    >
      {canEdit ? (
        <button
          type="button"
          className="drag-handle"
          aria-label={`Drag task ${item.text}`}
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
      ) : null}
      <label className="todo-item-toggle">
        <input
          type="checkbox"
          checked={item.done}
          disabled={!canEdit}
          onChange={(event) =>
            onAction({
              type: "toggle_item",
              locationId,
              itemId: item.id,
              done: event.target.checked,
            })
          }
        />
        <span className={`todo-item-text ${item.done ? "is-done" : ""}`}>
          {item.text}
        </span>
      </label>
      {canEdit ? (
        <button
          type="button"
          className="button subtle location-action-button"
          onClick={() => onOpenEditor(item.id)}
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
              locationId,
              itemId: item.id,
            })
          }
        >
          Delete
        </button>
      ) : null}
    </li>
  );
};

const LocationCardComponent = ({
  location,
  onAction,
  canEdit,
  onFocusLocation,
  onStartDirections,
}: LocationCardProps) => {
  const itemContextId = useId();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: location.id,
    disabled: !canEdit,
  });
  const [editorState, setEditorState] = useState<EditorState>(null);
  const [editorDraft, setEditorDraft] = useState("");
  const [newItemText, setNewItemText] = useState("");
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDirectionsDialogOpen, setIsDirectionsDialogOpen] = useState(false);

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

  const closeDirectionsDialog = () => {
    setIsDirectionsDialogOpen(false);
  };

  const taskSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  const handleTaskDragEnd = (event: DragEndEvent) => {
    if (!canEdit) {
      return;
    }

    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const previousIndex = location.items.findIndex((item) => item.id === active.id);
    const nextIndex = location.items.findIndex((item) => item.id === over.id);
    if (previousIndex < 0 || nextIndex < 0) {
      return;
    }

    const nextOrder = arrayMove(location.items, previousIndex, nextIndex).map((item) => item.id);
    onAction({
      type: "reorder_items",
      locationId: location.id,
      itemIds: nextOrder,
    });
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const startDirections = (mode: "driving" | "walking") => {
    onStartDirections(location, mode);
    closeDirectionsDialog();
  };

  return (
    <section
      ref={setNodeRef}
      style={style}
      id={`location-card-${location.id}`}
      data-location-id={location.id}
      className={`location-card ${isDragging ? "is-dragging" : ""}`}
    >
      <div className="location-header">
        <div className="location-title-line">
          {canEdit ? (
            <button
              type="button"
              className="drag-handle location-drag-handle"
              aria-label={`Drag location ${location.name}`}
              {...attributes}
              {...listeners}
            >
              ⋮⋮
            </button>
          ) : null}
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

          <button
            type="button"
            className="button subtle location-action-button"
            onClick={() => setIsDirectionsDialogOpen(true)}
          >
            Directions
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <>
          <DndContext id={itemContextId} sensors={taskSensors} collisionDetection={closestCenter} onDragEnd={handleTaskDragEnd}>
            <SortableContext items={location.items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <ul className="items-list">
                {location.items.map((item) => (
                  <SortableTaskRow
                    key={item.id}
                    locationId={location.id}
                    item={item}
                    canEdit={canEdit}
                    onAction={onAction}
                    onOpenEditor={openItemEditor}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

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
                Add task
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

      {isDirectionsDialogOpen ? (
        <div className="location-editor-backdrop" role="presentation" onClick={closeDirectionsDialog}>
          <div
            className="location-editor-dialog directions-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Choose directions type for ${location.name}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="directions-dialog-copy">
              <p className="field-label">Directions to {location.name}</p>
              <p className="directions-dialog-text">
                Choose whether you want driving or walking directions from your current location.
              </p>
            </div>
            <div className="location-editor-actions">
              <button
                type="button"
                className="button subtle location-action-button"
                onClick={closeDirectionsDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button subtle location-action-button"
                onClick={() => startDirections("walking")}
              >
                Walking
              </button>
              <button
                type="button"
                className="button primary location-action-button"
                onClick={() => startDirections("driving")}
              >
                Driving
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export const LocationCard = memo(LocationCardComponent);
