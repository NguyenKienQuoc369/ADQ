import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin";

export async function POST(request: Request) {
  try {
    await requireAdminRequest();

    return NextResponse.json({
      ok: true,
      retired: true,
      message: "Hệ thống xác thực SOC đã chuyển đổi sang Supabase Identity (UUID-based). Quản lý danh tính và đổi mật khẩu được thực hiện trực tiếp qua tài khoản Supabase / Google OAuth.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Lỗi xử lý yêu cầu" },
      { status: 401 }
    );
  }
}
