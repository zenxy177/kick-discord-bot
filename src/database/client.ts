import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

export const prisma = new PrismaClient({
  log: process.env.DEBUG === 'true' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

export async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.success('DATABASE', 'Veritabanı bağlantısı başarıyla kuruldu.');
  } catch (error) {
    logger.error('DATABASE', 'Veritabanına bağlanırken hata oluştu:', error);
    throw error;
  }
}
