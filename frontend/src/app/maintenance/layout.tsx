import React from "react";

export const metadata = {
  title: "Hệ Thống Đang Bảo Trì | ADQ Security Platform",
  description: "ADQ Platform đang trong quá trình nâng cấp hệ thống định kỳ.",
};

export default function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[999999] bg-[#07090e] overflow-y-auto">
      {children}
    </div>
  );
}
