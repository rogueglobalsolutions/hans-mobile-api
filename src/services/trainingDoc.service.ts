import prisma from "../config/prisma";
import fs from "fs";
import path from "path";

/**
 * Get all root folders (and their children + files) for a training.
 */
export async function getFoldersForTraining(trainingId: string) {
  return prisma.trainingFolder.findMany({
    where: { trainingId, parentId: null },
    include: {
      files:    true,
      children: {
        include: { files: true, children: { include: { files: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Create a folder inside a training (optionally nested under a parent folder).
 */
export async function createFolder(trainingId: string, name: string, parentId?: string) {
  // Verify training exists
  const training = await prisma.training.findUnique({ where: { id: trainingId } });
  if (!training) throw new Error("Training not found");

  if (parentId) {
    const parent = await prisma.trainingFolder.findUnique({ where: { id: parentId } });
    if (!parent || parent.trainingId !== trainingId) throw new Error("Parent folder not found");
  }

  return prisma.trainingFolder.create({
    data: { trainingId, name, parentId: parentId ?? null },
  });
}

/**
 * Add a document to a folder.
 */
export async function addDocument(
  folderId: string,
  fileName: string,
  filePath: string,
  fileSize: number,
  mimeType: string,
) {
  const folder = await prisma.trainingFolder.findUnique({ where: { id: folderId } });
  if (!folder) throw new Error("Folder not found");

  return prisma.trainingDocument.create({
    data: { folderId, fileName, filePath, fileSize, mimeType },
  });
}

/**
 * Delete a folder and all its nested contents (files deleted from disk too).
 */
export async function deleteFolder(folderId: string) {
  // Collect all file paths before cascade delete
  const allDocs = await prisma.trainingDocument.findMany({
    where: { folder: { OR: [{ id: folderId }, { parentId: folderId }] } },
  });
  await prisma.trainingFolder.delete({ where: { id: folderId } });
  for (const doc of allDocs) {
    try { fs.unlinkSync(path.resolve(doc.filePath)); } catch {}
  }
}

/**
 * Delete a single document (removes file from disk too).
 */
export async function deleteDocument(docId: string) {
  const doc = await prisma.trainingDocument.findUnique({ where: { id: docId } });
  if (!doc) throw new Error("Document not found");
  await prisma.trainingDocument.delete({ where: { id: docId } });
  try { fs.unlinkSync(path.resolve(doc.filePath)); } catch {}
}
