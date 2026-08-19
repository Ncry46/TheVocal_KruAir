# Kru Air — Run locally (frontend + backend)

## 1. SQL Server (once)
```bat
cd backend
npm install
npm run setup
```

`setup` สร้าง database `BD_AIR` จาก `sql/schema.sql` และใส่ข้อมูลตั้งต้นจาก `data/`

## 2. Backend
```bat
cd backend
npm run dev
```
API: http://localhost:3001/api/health

## 3. Frontend
```bat
cd frontend
npm run dev
```
Web: http://localhost:5173

Demo logins:
- student `mint@email.com` / `mint123`
- teacher `kruaer@email.com` / `kruaer123`
- admin `admin@kruaer.com` / `admin123`
