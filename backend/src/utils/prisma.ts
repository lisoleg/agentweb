/**
 * Shared Prisma Client Instance
 * All modules should import prisma from here instead of creating their own instance.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
