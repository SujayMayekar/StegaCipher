import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { SteganographyService } from "./services/steganography";
import multer from "multer";
import path from "path";
import fs from "fs";
import { insertEncodedImageSchema } from "@shared/schema";

// Configure multer for file uploads
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/bmp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG and BMP files are allowed'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get user stats
  app.get('/api/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Encode message into image
  app.post('/api/encode', isAuthenticated, upload.single('image'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { message, encryptionKey } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }
      
      if (!message) {
        return res.status(400).json({ message: "No message provided" });
      }

      // Read the uploaded file
      const imageBuffer = fs.readFileSync(req.file.path);
      
      // Encode the message
      const encodedImageBuffer = await SteganographyService.encodeMessage(
        imageBuffer,
        message,
        encryptionKey || undefined
      );

      // Generate unique filename
      const timestamp = Date.now();
      const originalName = req.file.originalname;
      const extension = path.extname(originalName);
      const baseName = path.basename(originalName, extension);
      const encodedFilename = `${baseName}_encoded_${timestamp}${extension}`;
      const encodedFilePath = path.join(uploadsDir, encodedFilename);

      // Save encoded image
      fs.writeFileSync(encodedFilePath, encodedImageBuffer);

      // Get image dimensions
      const sharp = (await import('sharp')).default;
      const metadata = await sharp(encodedImageBuffer).metadata();

      // Save to database
      const imageData = {
        userId,
        originalFilename: originalName,
        filename: encodedFilename,
        filePath: encodedFilePath,
        fileSize: encodedImageBuffer.length,
        width: metadata.width || 0,
        height: metadata.height || 0,
        messageLength: message.length,
        isEncrypted: !!encryptionKey,
      };

      const validatedData = insertEncodedImageSchema.parse(imageData);
      const savedImage = await storage.createEncodedImage(validatedData);

      // Clean up original uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        id: savedImage.id,
        filename: encodedFilename,
        message: "Image encoded successfully",
      });

    } catch (error) {
      console.error("Encoding error:", error);
      
      // Clean up files on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Encoding failed" 
      });
    }
  });

  // Decode message from image
  app.post('/api/decode', isAuthenticated, upload.single('image'), async (req: any, res) => {
    try {
      const { decryptionKey } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      // Read the uploaded file
      const imageBuffer = fs.readFileSync(req.file.path);
      
      // Decode the message
      const decodedMessage = await SteganographyService.decodeMessage(
        imageBuffer,
        decryptionKey || undefined
      );

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        message: decodedMessage,
        extractedAt: new Date().toISOString(),
      });

    } catch (error) {
      console.error("Decoding error:", error);
      
      // Clean up file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Decoding failed" 
      });
    }
  });

  // Get user's encoded images
  app.get('/api/images', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const images = await storage.getUserEncodedImages(userId);
      res.json(images);
    } catch (error) {
      console.error("Error fetching images:", error);
      res.status(500).json({ message: "Failed to fetch images" });
    }
  });

  // Download encoded image
  app.get('/api/images/:id/download', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const imageId = req.params.id;
      
      const image = await storage.getEncodedImage(imageId);
      if (!image || image.userId !== userId) {
        return res.status(404).json({ message: "Image not found" });
      }

      if (!fs.existsSync(image.filePath)) {
        return res.status(404).json({ message: "Image file not found" });
      }

      res.download(image.filePath, image.originalFilename);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ message: "Download failed" });
    }
  });

  // Delete encoded image
  app.delete('/api/images/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const imageId = req.params.id;
      
      const image = await storage.getEncodedImage(imageId);
      if (!image || image.userId !== userId) {
        return res.status(404).json({ message: "Image not found" });
      }

      // Delete file if it exists
      if (fs.existsSync(image.filePath)) {
        fs.unlinkSync(image.filePath);
      }

      // Delete from database
      await storage.deleteEncodedImage(imageId);

      res.json({ message: "Image deleted successfully" });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ message: "Delete failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
