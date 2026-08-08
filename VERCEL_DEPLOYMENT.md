# Vercel Deployment Guide for ADQ Frontend 🚀

This guide provides step-by-step instructions for deploying the **ADQ Web Dashboard** (`frontend/` directory) to **Vercel**.

---

## 🏗️ Deployment Steps

### 1. Connect GitHub Repository to Vercel
1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New** ➔ **Project**.
3. Select your GitHub repository: `NguyenKienQuoc369/ADQ`.

### 2. Configure Framework & Root Directory
* **Framework Preset:** `Next.js`
* **Root Directory:** Edit and set to `frontend` *(Crucial: Do not leave as default root)*.

### 3. Configure Environment Variables
In the Vercel **Environment Variables** panel, add the following variables:

| Variable Name | Description | Example Value |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | FastAPI Backend URL on your VPS | `https://api.yourdomain.com` |
| `DATABASE_URL` | Supabase Transaction Pooler URL | `postgresql://postgres.ref:pass@pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true` |
| `DIRECT_URL` | Supabase Direct Connection URL | `postgresql://postgres.ref:pass@pooler.supabase.com:5432/postgres?sslmode=require` |

### 4. Deploy & Verify
1. Click **Deploy**. Vercel will automatically run `npm install`, `npx prisma generate`, and `next build`.
2. Every subsequent push or PR merged into `main` branch will trigger an automatic production deployment.

---

## 🔒 Security & Database Connection Best Practices

* **Supabase Connection Pooling:** Since Vercel serverless functions scale dynamically, use Supabase Transaction Pooler (Port 6543 with `pgbouncer=true`) to avoid exhausting database connections.
* **CORS Policy:** Ensure your FastAPI Backend on VPS sets CORS headers allowing requests from your Vercel deployment domain (e.g. `https://adq-web.vercel.app`).
