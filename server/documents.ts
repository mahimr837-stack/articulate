import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { storagePut } from "./storage";

const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

export function sanitizeDocumentName(value: string) {
  const decoded = decodeURIComponent(value || "upload");
  const basename = decoded.split(/[\\/]/).pop() ?? "upload";
  const normalized = basename.replace(/[^a-zA-Z0-9._()\- ]/g, "_").slice(0, 180).trim();
  return normalized || "upload";
}

export async function uploadDocument(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.isCron) return res.status(403).json({ error: "Interactive upload required." });
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: "Choose a non-empty file to upload." });
    }
    if (req.body.length > MAX_DOCUMENT_BYTES) {
      return res.status(413).json({ error: "Files must be 50 MB or smaller." });
    }

    const name = sanitizeDocumentName(String(req.headers["x-document-name"] ?? "upload"));
    const mimeType = String(req.headers["content-type"] ?? "application/octet-stream").slice(0, 160);
    const documentId = crypto.randomUUID();
    const { key, url } = await storagePut(`documents/${user.id}/${documentId}-${name}`, req.body, mimeType);

    return res.status(201).json({
      file: { id: documentId, name, mimeType, size: req.body.length, storageKey: key, storageUrl: url, uploadedAt: Date.now() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload the document.";
    return res.status(500).json({ error: message });
  }
}
