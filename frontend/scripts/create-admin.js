// scripts/create-admin.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!supabaseUrl || !supabaseServiceKey || !adminEmail || !adminPassword) {
  console.error("❌ Thiếu biến môi trường! Vui lòng kiểm tra lại cấu hình.");
  process.exit(1);
}

// Khởi tạo client với Service Role Key để có quyền Admin
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdmin() {
  console.log(`Đang tạo tài khoản admin: ${adminEmail}...`);

  const { data, error } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true, // Tự động xác thực email không cần gửi thư xác nhận
    // Đồng bộ với frontend: role lưu dạng "ADMIN" (uppercase). Frontend vẫn hỗ trợ đọc lowercase để tương thích ngược.
    user_metadata: { role: 'ADMIN' },
    app_metadata: { role: 'ADMIN' }
  });

  if (error) {
    console.error("❌ Tạo admin thất bại:", error.message);
  } else {
    console.log("✅ Tạo tài khoản admin thành công!");
    console.log("User ID:", data.user.id);
  }
}

createAdmin();
