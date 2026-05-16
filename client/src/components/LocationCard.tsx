import { memo, useCallback, useEffect, useId, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDragPointerSensors } from "../hooks/useDragPointerSensors";
import type { ClientAction, LocationTodo } from "../types";
import "./LocationCard.css";

type LocationCardProps = {
  location: LocationTodo;
  onAction: (action: ClientAction) => Promise<boolean>;
  canEdit: boolean;
  onFocusLocation: (longitude: number, latitude: number) => void;
  onOpenLocationEditor: (location: LocationTodo) => void;
  onOpenDirectionsDialog: (location: LocationTodo) => void;
};

type EditorState = { kind: "item"; itemId: string } | null;

type SortableTaskRowProps = {
  locationId: string;
  item: LocationTodo["items"][number];
  canEdit: boolean;
  onAction: (action: ClientAction) => Promise<boolean>;
  onOpenEditor: (itemId: string) => void;
  onDeleteItem: (itemId: string, itemText: string) => void;
};

const SortableTaskRowComponent = ({
  locationId,
  item,
  canEdit,
  onAction,
  onOpenEditor,
  onDeleteItem,
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
          onClick={() => onDeleteItem(item.id, item.text)}
        >
          Delete
        </button>
      ) : null}
    </li>
  );
};

const SortableTaskRow = memo(SortableTaskRowComponent);

const LocationCardComponent = ({
  location,
  onAction,
  canEdit,
  onFocusLocation,
  onOpenLocationEditor,
  onOpenDirectionsDialog,
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
  const [isSubmittingNewItem, setIsSubmittingNewItem] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!editorState) {
      return;
    }

    const item = location.items.find((entry) => entry.id === editorState.itemId);
    setEditorDraft(item?.text ?? "");
  }, [editorState, location]);

  const doneCount = useMemo(
    () => location.items.filter((item) => item.done).length,
    [location.items],
  );

  const openLocationEditor = useCallback(() => {
    onOpenLocationEditor(location);
  }, [location, onOpenLocationEditor]);

  const openItemEditor = useCallback((itemId: string) => {
    const item = location.items.find((entry) => entry.id === itemId);
    setEditorState({ kind: "item", itemId });
    setEditorDraft(item?.text ?? "");
  }, [location.items]);

  const closeEditor = useCallback(() => {
    setEditorState(null);
    setEditorDraft("");
  }, []);

  const submitEditor = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editorState || !canEdit) {
      return;
    }

    const trimmed = editorDraft.trim();
    if (!trimmed) {
      return;
    }

    const item = location.items.find((entry) => entry.id === editorState.itemId);
    if (item && trimmed !== item.text) {
      onAction({
        type: "update_item",
        locationId: location.id,
        itemId: item.id,
        text: trimmed,
      });
    }

    closeEditor();
  };

  const addItem = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newItemText.trim();
    if (!trimmed || !canEdit) {
      return;
    }

    setIsSubmittingNewItem(true);
    void onAction({
      type: "add_item",
      locationId: location.id,
      text: trimmed,
    }).finally(() => {
      setIsSubmittingNewItem(false);
      setNewItemText("");
      setIsAddingItem(false);
    });
  }, [canEdit, location.id, newItemText, onAction]);

  const cancelAddItem = useCallback(() => {
    setNewItemText("");
    setIsAddingItem(false);
  }, []);

  const taskSensors = useDragPointerSensors();

  const handleTaskDragEnd = useCallback((event: DragEndEvent) => {
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
  }, [canEdit, location.id, location.items, onAction]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const confirmDeleteLocation = useCallback(() => {
    const shouldDelete = window.confirm(
      `Delete location "${location.name}" and all of its tasks?`,
    );

    if (!shouldDelete) {
      return;
    }

    onAction({
      type: "delete_location",
      locationId: location.id,
    });
  }, [location.id, location.name, onAction]);

  const confirmDeleteItem = useCallback((itemId: string, itemText: string) => {
    const shouldDelete = window.confirm(`Delete task "${itemText}"?`);

    if (!shouldDelete) {
      return;
    }

    onAction({
      type: "delete_item",
      locationId: location.id,
      itemId,
    });
  }, [location.id, onAction]);

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
          <div className="location-title-wrapper">
            <div className="location-title">{location.name}</div>
            {location.address ? (
              <div className="location-address">{location.address}</div>
            ) : null}
            <div className="location-subtitle">{doneCount}/{location.items.length} tasks</div>
          </div>
          <button
            type="button"
            className="button subtle caret-toggle"
            onClick={() => setIsCollapsed((current) => !current)}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "Expand location" : "Collapse location"}
          >
            {isCollapsed ? "▸" : "▾"}
          </button>
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
              onClick={confirmDeleteLocation}
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
            onClick={() => onOpenDirectionsDialog(location)}
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
                    onDeleteItem={confirmDeleteItem}
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
                  disabled={isSubmittingNewItem}
                  onBlur={() => {
                    if (!isSubmittingNewItem && newItemText.trim().length === 0) {
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
                    disabled={isSubmittingNewItem || newItemText.trim().length === 0}
                  >
                    {isSubmittingNewItem ? "Adding..." : "Add"}
                  </button>
                  <button
                    type="button"
                    className="button subtle location-action-button"
                    onClick={cancelAddItem}
                    disabled={isSubmittingNewItem}
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
          <div className="location-editor-dialog" role="dialog" aria-modal="true" aria-label="Edit task" onClick={(event) => event.stopPropagation()}>
            <form className="location-editor-form" onSubmit={submitEditor}>
              <label className="field-label" htmlFor={`editor-${location.id}`}>
                Edit task
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
