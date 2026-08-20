import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Nếu OAuth được khởi tạo từ luồng REGISTER,
      // callback /onboarding sẽ đánh dấu tài khoản phải
      // hoàn tất onboarding trước khi vào Dashboard.
      if (next === "/onboarding") {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && user.user_metadata?.onboardingCompleted !== true) {
          await supabase.auth.updateUser({
            data: {
              onboardingRequired: true,
              onboardingCompleted: false,
              termsAccepted:
                user.user_metadata?.termsAccepted === true,
            },
          });
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
