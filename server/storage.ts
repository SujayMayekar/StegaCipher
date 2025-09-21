import {
  users,
  encodedImages,
  type User,
  type UpsertUser,
  type EncodedImage,
  type InsertEncodedImage,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Encoded images operations
  createEncodedImage(imageData: InsertEncodedImage): Promise<EncodedImage>;
  getUserEncodedImages(userId: string): Promise<EncodedImage[]>;
  getEncodedImage(id: string): Promise<EncodedImage | undefined>;
  deleteEncodedImage(id: string): Promise<void>;
  getUserStats(userId: string): Promise<{
    totalEncoded: number;
    totalDecoded: number;
    totalStorage: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Encoded images operations
  async createEncodedImage(imageData: InsertEncodedImage): Promise<EncodedImage> {
    const [image] = await db
      .insert(encodedImages)
      .values(imageData)
      .returning();
    return image;
  }

  async getUserEncodedImages(userId: string): Promise<EncodedImage[]> {
    return await db
      .select()
      .from(encodedImages)
      .where(eq(encodedImages.userId, userId))
      .orderBy(desc(encodedImages.createdAt));
  }

  async getEncodedImage(id: string): Promise<EncodedImage | undefined> {
    const [image] = await db
      .select()
      .from(encodedImages)
      .where(eq(encodedImages.id, id));
    return image;
  }

  async deleteEncodedImage(id: string): Promise<void> {
    await db.delete(encodedImages).where(eq(encodedImages.id, id));
  }

  async getUserStats(userId: string): Promise<{
    totalEncoded: number;
    totalDecoded: number;
    totalStorage: number;
  }> {
    const images = await this.getUserEncodedImages(userId);
    const totalStorage = images.reduce((sum, img) => sum + img.fileSize, 0);
    
    return {
      totalEncoded: images.length,
      totalDecoded: images.length, // For now, assume decoded = encoded
      totalStorage,
    };
  }
}

export const storage = new DatabaseStorage();
