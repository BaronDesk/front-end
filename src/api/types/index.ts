/*
 * Shapes the frontend reads from the backend (back-end/src DTOs, checked
 * against the running API). Money is whole coins (1000 coins = 1 DT here);
 * discount percents are Prisma Decimals, sent as strings.
 */

export * from './common';
export * from './auth';
export * from './branches';
export * from './stations';
export * from './games';
export * from './commands';
export * from './alerts';
export * from './wallet';
export * from './plans';
export * from './ranks';
export * from './uploads';
export * from './bookings';
export * from './sessions';
export * from './audit';
export * from './events';
