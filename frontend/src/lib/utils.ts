import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value: string | number | Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function getSeverityColor(severity: string) {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return "text-rose-300 bg-rose-500/10 border-rose-500/30";
    case "HIGH":
      return "text-orange-300 bg-orange-500/10 border-orange-500/30";
    case "MEDIUM":
      return "text-amber-300 bg-amber-500/10 border-amber-500/30";
    default:
      return "text-cyan-300 bg-cyan-500/10 border-cyan-500/30";
  }
}

export function getPackageGlow(packageName: string) {
  switch (packageName) {
    case "PRO_MAX":
      return "from-cyan-500/25 via-emerald-500/15 to-slate-950";
    case "PRO":
      return "from-emerald-500/20 via-cyan-500/10 to-slate-950";
    default:
      return "from-slate-700/20 via-slate-800/20 to-slate-950";
  }
}

/**
 * Che giấu một phần email để bảo vệ quyền riêng tư người dùng
 * Ví dụ: kienquocn64@gmail.com -> ki***4@gmail.com
 */
export function maskEmail(email?: string | null): string {
  if (!email || typeof email !== "string") return "";
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return email;

  const username = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  let maskedUser = "";
  if (username.length <= 2) {
    maskedUser = `${username[0]}*`;
  } else if (username.length <= 4) {
    maskedUser = `${username[0]}**${username[username.length - 1]}`;
  } else {
    const prefix = username.slice(0, 2);
    const suffix = username.slice(-1);
    maskedUser = `${prefix}***${suffix}`;
  }

  return `${maskedUser}@${domain}`;
}

/**
 * Nén và thay đổi kích thước ảnh avatar thành Base64 nhỏ gọn (256x256)
 * Giúp tối ưu hóa tốc độ tải và không làm phình Supabase JWT
 * Nén và thay đổi kích thước ảnh avatar thành Base64 nhỏ gọn (256x256 WebP/JPEG)
 * Giúp tối ưu hóa tốc độ tải và không làm phình Supabase JWT payload
 */
export async function resizeImageToBase64(file: File, maxDimension = 256, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new (window as any).Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
    const boundedDimension = Math.max(16, Math.min(Math.round(maxDimension) || 256, 1024));
    const boundedQuality = Math.max(0.1, Math.min(Number.isFinite(quality) ? quality : 0.85, 1.0));

    if (!file || !file.type.startsWith("image/")) {
      return reject(new Error("Định dạng tệp không phải hình ảnh hợp lệ."));
    }

    let objectUrl: string | null = null;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      return reject(new Error("Không thể đọc tệp hình ảnh."));
    }

    const img = new (window as any).Image();

    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {}
        objectUrl = null;
      }
    };

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height || width <= 0 || height <= 0) {
          cleanup();
          return reject(new Error("Không thể giải mã kích thước hình ảnh."));
        }

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          if (width > boundedDimension) {
            height = Math.round((height * boundedDimension) / width);
            width = boundedDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          if (height > boundedDimension) {
            width = Math.round((width * boundedDimension) / height);
            height = boundedDimension;
          }
        }

        width = Math.max(1, Math.round(width));
        height = Math.max(1, Math.round(height));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
          cleanup();
          return reject(new Error("Trình duyệt không hỗ trợ Canvas 2D context."));
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/webp", quality) || canvas.toDataURL("image/jpeg", quality);
        cleanup();

        let dataUrl = canvas.toDataURL("image/webp", boundedQuality);
        // Fallback sang image/jpeg nếu trình duyệt không xuất WebP (canvas trả về image/png)
        if (!dataUrl || dataUrl.startsWith("data:image/png")) {
          dataUrl = canvas.toDataURL("image/jpeg", boundedQuality);
        }

        if (!dataUrl || dataUrl === "data:,") {
          return reject(new Error("Không thể xuất dữ liệu hình ảnh sau khi nén."));
        }

        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
      } catch (err) {
        cleanup();
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);

    img.onerror = () => {
      cleanup();
      reject(new Error("Giải mã hình ảnh thất bại. Tệp có thể bị lỗi hoặc định dạng không hỗ trợ."));
    };

    img.src = objectUrl;
  });
}


