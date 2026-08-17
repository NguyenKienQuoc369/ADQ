# ADQ Security Frontend

Next.js App Router + Tailwind CSS + Supabase Auth + Prisma + TypeScript.

Mục tiêu của project này là cung cấp giao diện marketing / dashboard cho ADQ Security với trải nghiệm hiện đại, theme sáng/tối rõ ràng, auth flow hoạt động với Supabase và dữ liệu ứng dụng lưu qua Prisma.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- TypeScript
- Prisma ORM
- Supabase Auth + PostgreSQL
- Framer Motion
- Lucide React

## Kiến trúc tổng quan

- Frontend: `src/app` và `src/components`
- Auth: Supabase Auth
- Database app metadata / admin data: Prisma + PostgreSQL
- Theme: client-side theme provider + CSS variables
- API: Next.js route handlers (`src/app/api/*`)

## Yêu cầu môi trường

- Node.js 20+
- npm
- Tài khoản Supabase project (hoặc cấu hình auth phù hợp)
- Database PostgreSQL (Supabase Postgres hoặc local Postgres) — hoặc nếu bạn dùng backend Python, frontend có thể proxy tới backend đó

Note: Project can be wired two ways:
- Standalone Next.js backend: Next.js API routes (src/app/api) use Prisma + Supabase for auth and storage. In this mode set DATABASE_URL and Supabase keys in .env.local.
- Proxy to external backend: set BACKEND_API_URL to your backend server (e.g. http://localhost:8000). Next.js API routes will call BACKEND_API_URL for triggering scans and retrieving long-running job results. Set NEXT_PUBLIC_API_BASE_URL to the public URL of the frontend (usually http://localhost:3000).
## Cài đặt

1. Tại thư mục `frontend`:

```bash
npm install
```

2. Tạo file `.env.local` dựa trên `.env.local.example`:

```bash
cp .env.local.example .env.local
```

3. Điền các biến môi trường thực:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:password@db.xxxxxx.supabase.co:5432/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:password@db.xxxxxx.supabase.co:5432/postgres
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

## Supabase setup cần thiết

### 1) Kích hoạt Auth providers

Trong Supabase Dashboard:

- Authentication > Providers
- Enable:
  - Email
  - Google (nếu dùng OAuth)
- Thiết lập redirect URL phù hợp:

```text
http://localhost:3000/auth/callback
http://localhost:3000/confirm-email
http://localhost:3000/reset-password
```

Nếu dùng Google, thêm URL callback chuẩn của Supabase theo hướng dẫn trong dashboard.

### 2) Cấu hình Email confirmation

Nếu Supabase bật "Confirm email":

- người dùng đăng ký sẽ không tự đăng nhập ngay
- app sẽ redirect tới trang `/confirm-email`
- cần cấu hình SMTP/Email provider trong Supabase hoặc dựa trên default provider của Supabase

Nếu không cấu hình SMTP hoặc email provider, flow signup có thể bị lỗi hoặc không gửi mail xác thực.

### 3) Kiểm tra Auth redirect

Project đang dùng flow App Router, nên các trang liên quan đến query params như `/confirm-email` và `/reset-password` cần được xử lý đúng với `Suspense` khi dùng `useSearchParams`.

## Prisma setup

1. Tạo schema nếu chưa có:

```bash
npx prisma generate
```

2. Chạy migration ban đầu:

```bash
npx prisma migrate dev --name init
```

3. Nếu cần xem database schema:

```bash
npx prisma studio
```

## Chạy project local

```bash
npm run dev
```

Mở:

```text
http://localhost:3000
```

## Build kiểm tra

Project hiện đã được kiểm tra bằng:

```bash
npm run build
```

Build nên thành công sau khi:

- Prisma client được generate
- env variables đã được điền đúng
- không còn stale Prisma lock issue trên Windows

## Scripts có sẵn

```bash
npm run dev
npm run build
npm run start
npm run lint
npx prisma generate
npx prisma migrate dev --name init
```

## Cấu trúc thư mục quan trọng

```text
src/
  app/
    api/               # Route handlers cho auth, dashboard, admin, etc.
    login/
    register/
    confirm-email/
    reset-password/
    forgot-password/
  components/
    auth/
    landing-page.tsx
    Navigation.tsx
    providers/
  lib/
    prisma.ts
    supabase/
    api.ts
prisma/
  schema.prisma
public/
  fonts/
```

## Vấn đề thường gặp

### 1) Prisma lock / EPERM rename trên Windows

Nếu build báo lỗi liên quan đến Prisma native client hoặc file đang bị lock:

```bash
# đóng mọi node process đang chạy
# sau đó
npx prisma generate
npm run build
```

### 2) Email confirmation không gửi

Kiểm tra:

- Supabase Auth > Email Templates
- SMTP provider / custom email provider đã bật chưa
- redirect URL đúng chưa
- domain gửi mail không bị chặn

### 3) Google OAuth không hoạt động

Kiểm tra:

- provider Google trong Supabase đã enable
- Client ID và Secret đã được điền
- Authorized redirect URLs đúng

### 4) Auth form submit lỗi

Project đã có xử lý fallback cho duplicate email, login error, sign-up confirmation flow. Nếu vẫn lỗi, cần kiểm tra .env.local và Supabase project config.

## Ghi chú production

- Không commit `.env.local` lên git
- Không hardcode Supabase service role ở client
- Đối với production, nên:
  - dùng HTTPS
  - cấu hình domain production cho Supabase Auth
  - bảo vệ admin routes bằng server-side auth/session checks
  - kiểm tra RBAC / role enforcement rõ ràng

## Hướng dẫn handover nhanh

Khi chuyển project cho người vận hành / dev tiếp theo:

1. Copy `.env.local.example` -> `.env.local`
2. Cấu hình Supabase project URL + keys
3. Cấu hình Prisma `DATABASE_URL` và `DIRECT_URL`
4. Kích hoạt Email + Google Auth trong Supabase Dashboard
5. Chạy:

```bash
npm install
npx prisma generate
npm run dev
```

6. Test flow:
   - register
   - confirm email
   - login
   - Google OAuth
   - admin pages

## Tóm tắt

Project hiện đang ở trạng thái buildable và có trải nghiệm frontend hợp lệ cho ADQ Security, với Supabase + Prisma vẫn được giữ nguyên. Để chạy thực sự trên môi trường live, cần cấu hình Supabase dashboard đúng (email, OAuth, redirect URL) và phần DB production cho Prisma.
