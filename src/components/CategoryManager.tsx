import { useState, type FormEvent } from "react";
import type { Category } from "../types/category";

interface Props {
  categories: Category[];
  onSave: (category: Category) => Promise<void>;
  onDelete: (category: Category) => Promise<void>;
}

export default function CategoryManager({ categories, onSave, onDelete }: Props) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) return;
    const duplicate = categories.find(
      (category) => category.name.toLowerCase() === normalizedName.toLowerCase() && category.id !== editing?.id,
    );
    if (duplicate) {
      setError("A category with this name already exists.");
      return;
    }
    try {
      await onSave({ id: editing?.id ?? crypto.randomUUID(), name: normalizedName, isActive: editing?.isActive ?? true });
      setName("");
      setEditing(null);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The category could not be saved.");
    }
  }

  return (
    <details className="fund-balance-report__section category-manager">
      <summary>
        <strong>Manage categories</strong> · {categories.filter((category) => category.isActive).length} active
      </summary>
      <form onSubmit={submit}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Category name" aria-label="Category name" />
        <button type="submit">{editing ? "Save name" : "Add category"}</button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setName("");
            }}
          >
            Cancel
          </button>
        )}
      </form>
      {error && <p role="alert">{error}</p>}
      <ul>
        {categories.map((category) => (
          <li key={category.id}>
            <span>
              {category.name}
              {category.isActive ? "" : " (inactive)"}
            </span>
            <div>
              <button
                type="button"
                onClick={() => {
                  setEditing(category);
                  setName(category.name);
                }}
              >
                Rename
              </button>
              <button type="button" onClick={() => void onSave({ ...category, isActive: !category.isActive })}>
                {category.isActive ? "Deactivate" : "Activate"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm(`Delete category "${category.name}"?`)) return;
                  try {
                    await onDelete(category);
                    setError(null);
                  } catch (deleteError) {
                    setError(deleteError instanceof Error ? deleteError.message : "The category could not be deleted.");
                  }
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
