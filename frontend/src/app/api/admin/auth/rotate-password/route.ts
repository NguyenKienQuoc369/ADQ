import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin";
import { rotateSocPassword } from "@/lib/soc-auth";

export async function POST(request: Request) {
  try {
    const admin = await requireAdminRequest();

    const body = await request.json();
    const currentPassword = String(body?.currentPassword ?? "").trim();
    const newPassword = String(body?.newPassword ?? "").trim();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới" },
        { status: 400 }
      );
    }

    const result = await rotateSocPassword(
      currentPassword,
      newPassword,
      admin.id || "soc-root"
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Không thể cập nhật mật khẩu" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Mật khẩu quản trị SOC đã được cập nhật thành công.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Lỗi xử lý yêu cầu" },
      { status: 500 }
    );
  }
}
