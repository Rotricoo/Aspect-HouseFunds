import { appDataDir, basename, join } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { open } from "@tauri-apps/plugin-dialog";
import { BaseDirectory, copyFile, mkdir, remove } from "@tauri-apps/plugin-fs";

export interface StoredAttachment {
  filePath: string;
  originalFileName: string;
}

export interface SelectedAttachment {
  sourcePath: string;
  originalFileName: string;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function chooseAttachments(): Promise<SelectedAttachment[]> {
  if (!("__TAURI_INTERNALS__" in window)) {
    throw new Error("Managed attachments are available in the installed Aspect - House Funds app.");
  }

  const selectedPaths = await open({
    multiple: true,
    directory: false,
    title: "Choose receipts or proof of payment",
    filters: [{ name: "Receipts and statements", extensions: ["jpg", "jpeg", "png", "webp", "pdf"] }],
  });

  if (!selectedPaths) return [];
  const paths = Array.isArray(selectedPaths) ? selectedPaths : [selectedPaths];
  return Promise.all(paths.map(async (sourcePath) => ({ sourcePath, originalFileName: await basename(sourcePath) })));
}

export async function storeAttachments(selectedAttachments: SelectedAttachment[]): Promise<StoredAttachment[]> {
  await mkdir("attachments", { baseDir: BaseDirectory.AppData, recursive: true });
  const storedAttachments: StoredAttachment[] = [];
  for (const attachment of selectedAttachments) {
    const { sourcePath, originalFileName } = attachment;
    const storedFileName = `${crypto.randomUUID()}-${sanitizeFileName(originalFileName)}`;
    const filePath = `attachments/${storedFileName}`;
    await copyFile(sourcePath, filePath, { toPathBaseDir: BaseDirectory.AppData });
    storedAttachments.push({ filePath, originalFileName });
  }

  return storedAttachments;
}

export async function removeStoredAttachments(filePaths: string[]): Promise<void> {
  const managedFilePaths = filePaths.filter((filePath) => filePath.startsWith("attachments/"));

  await Promise.allSettled(managedFilePaths.map((filePath) => remove(filePath, { baseDir: BaseDirectory.AppData })));
}

export async function openStoredAttachment(filePath: string): Promise<void> {
  if (!filePath.startsWith("attachments/")) {
    throw new Error("This attachment has not been migrated into Aspect - House Funds storage.");
  }
  await openPath(await join(await appDataDir(), filePath));
}
