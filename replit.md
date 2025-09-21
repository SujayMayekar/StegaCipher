# Steganography Web Application

## Overview

This is a full-stack steganography web application built with React and Express that allows users to hide secret messages inside images using LSB (Least Significant Bit) steganography. The platform provides secure image encoding/decoding capabilities with optional encryption, user authentication via Replit Auth, and a comprehensive image gallery system.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development and building
- **UI Library**: Shadcn/ui components built on Radix UI primitives for accessible, customizable components
- **Styling**: Tailwind CSS with custom CSS variables for theming, featuring a dark crypto-inspired design
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **File Structure**: Component-based architecture with shared UI components, custom hooks, and utility functions

### Backend Architecture
- **Framework**: Express.js with TypeScript for the REST API server
- **Database ORM**: Drizzle ORM with PostgreSQL for type-safe database operations
- **File Processing**: Sharp for image manipulation and multer for file uploads
- **Session Management**: Express sessions with PostgreSQL storage via connect-pg-simple
- **Authentication**: Replit Auth integration with OpenID Connect
- **API Design**: RESTful endpoints for authentication, image encoding/decoding, and gallery management

### Database Schema
- **Users Table**: Stores user authentication data (id, email, names, profile image)
- **Sessions Table**: Manages user session data for authentication persistence
- **Encoded Images Table**: Tracks uploaded images with metadata (filename, dimensions, message length, encryption status)
- **Relationships**: Users have many encoded images with foreign key constraints

### Authentication and Authorization
- **Authentication Provider**: Replit Auth using OpenID Connect protocol
- **Session Strategy**: Server-side sessions with PostgreSQL storage
- **Authorization**: Middleware-based route protection requiring valid sessions
- **User Management**: Automatic user creation/updates on successful authentication

### Steganography Service
- **Algorithm**: LSB (Least Significant Bit) steganography implementation
- **Image Processing**: Sharp library for image manipulation and format conversion
- **Encryption**: Optional AES encryption for message content before embedding
- **File Support**: PNG and BMP image formats for lossless steganography
- **Capacity Checking**: Validates image can accommodate message size before encoding

### File Management
- **Upload Handling**: Multer middleware with file size limits (10MB) and type validation
- **Storage**: Local file system with organized directory structure
- **File Serving**: Express static file serving for image downloads and previews
- **Cleanup**: Automatic file cleanup for failed operations

## External Dependencies

### Database
- **Neon PostgreSQL**: Serverless PostgreSQL database with connection pooling
- **Connection Management**: @neondatabase/serverless client with WebSocket support

### Authentication
- **Replit Auth**: OAuth 2.0/OpenID Connect identity provider
- **Session Storage**: PostgreSQL-backed session store for persistence across server restarts

### Image Processing
- **Sharp**: High-performance image processing library for format conversion and manipulation
- **File Uploads**: Multer for handling multipart form data and file uploads

### Frontend Libraries
- **UI Components**: Radix UI primitives for accessible component foundations
- **State Management**: TanStack Query for server state, caching, and optimistic updates
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with custom theme configuration

### Development Tools
- **Build System**: Vite for fast development server and optimized production builds
- **Type Safety**: TypeScript throughout the stack with strict configuration
- **Database Migrations**: Drizzle Kit for schema management and migrations
- **Code Quality**: ESBuild for server bundling and PostCSS for style processing