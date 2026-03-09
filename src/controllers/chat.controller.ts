import { Request, Response } from "express";

export async function uploadChatImage(req: Request, res: Response) {
  if (!req.file) {
    res.status(400).json({ success: false, message: "Image is required" });
    return;
  }

  const imageUrl = `uploads/chat/${req.file.filename}`;

  res.json({
    success: true,
    message: "Image uploaded successfully",
    data: { imageUrl },
  });
}
