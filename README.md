# Fertilizer CRM

เว็บแอพ CRM สำหรับธุรกิจขายปุ๋ย ใช้จัดการลูกค้า รายการซื้อ รายการขาย ค่าใช้จ่าย ใบแจ้งหนี้ ทีมขาย คอมมิชชั่น และรายงาน

## Tech Stack

- Next.js 14
- React + TypeScript
- Prisma
- PostgreSQL

## Local Setup

1. ติดตั้ง dependencies

```bash
npm install
```

2. สร้างไฟล์ `.env` จาก `.env.example`

```bash
cp .env.example .env
```

3. ใส่ `DATABASE_URL` ของ PostgreSQL ใน `.env`

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
```

4. รัน migration และ generate Prisma Client

```bash
npx prisma migrate deploy
npx prisma generate
```

5. เปิด dev server

```bash
npm run dev
```

## Deploy To Vercel

แนะนำใช้ Vercel + PostgreSQL เช่น Neon, Supabase, Railway หรือ Vercel Postgres

1. Push โปรเจกต์ขึ้น GitHub
2. Import โปรเจกต์ใน Vercel
3. เพิ่ม Environment Variable ใน Vercel:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

4. Deploy

โปรเจกต์มี `vercel.json` แล้ว โดย build command จะรัน:

```bash
npx prisma migrate deploy && npm run build
```

## Useful Commands

```bash
npm run dev
npm run build
npm run db:deploy
npm run prisma:generate
```

## App Pages

- `/` แดชบอร์ด
- `/customers` ลูกค้า
- `/purchases` รายการซื้อ
- `/sale-records` รายการขาย
- `/expenses` ค่าใช้จ่าย
- `/invoices` ใบแจ้งหนี้
- `/sales` ทีมขาย
- `/reports` รายงาน
