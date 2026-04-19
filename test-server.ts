import { NestFactory } from '@nestjs/core';
import { AppModule } from './backend/app.module';
import axios from 'axios';

process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";
process.env.JWT_SECRET = process.env.JWT_SECRET || "SUPER_SECRET_ERP_KEY";

async function run() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  await app.listen(3001);
  
  try {
    const res = await axios.post('http://127.0.0.1:3001/api/v1/auth/login', {
      email: 'admin@erp.local',
      password: 'admin123'
    });
    console.log(res.data);
  } catch (e: any) {
    console.log(e.response?.data || e.message);
  }
  await app.close();
}
run();
