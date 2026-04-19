import { NestFactory } from '@nestjs/core';
import { AppModule } from './backend/app.module';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET environment variable is missing.');
}
process.env.JWT_SECRET = jwtSecret || "SUPER_SECRET_ERP_KEY";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    transform: true 
  }));
  app.enableCors();
  
  // Достаем внутренний Express 
  const server = app.getHttpAdapter().getInstance();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    server.use((req: any, res: any, next: any) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      vite.middlewares(req, res, next);
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    server.use((req: any, res: any, next: any) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      express.static(distPath)(req, res, next);
    });
    server.use((req: any, res: any, next: any) => {
      if (req.path.startsWith('/api') || req.path.indexOf('.') !== -1) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Только теперь инициализируем роуты бэкенда. 
  // Это гарантирует, что 404 обработчик NestJS будет в самом конце стека!
  await app.init();

  const PORT = 3000;
  await app.listen(PORT, "0.0.0.0");
  console.log(`🚀 Наш бронебойный NestJS + Vite сервер запущен на порту: ${PORT}`);
}
bootstrap();
