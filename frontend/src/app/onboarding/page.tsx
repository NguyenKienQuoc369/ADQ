"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { TermsModal } from "@/components/auth/terms-modal";
import { GoogleSetupModal } from "@/components/auth/google-setup-modal";
import { PlansModal } from "@/components/auth/plans-modal";

type OnboardingStage = "loading" | "google-setup" | "terms" | "plans";

export default function OnboardingPage() {
  const router = useRouter();

  const [stage, setStage] = useState<OnboardingStage>("loading");
  const [email, setEmail] = useState("");
  const [defaultName, setDefaultName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    const initialise = async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      let metadata = user.user_metadata ?? {};
      const identities = user.identities ?? [];

      // Bootstrap onboarding metadata cho tài khoản mới nếu còn thiếu.
      const createdAt = user.created_at
        ? new Date(user.created_at).getTime()
        : 0;

      const onboardingEnforcedFrom =
        new Date("2026-08-20T00:00:00+07:00").getTime();

      const isNewAccount =
        createdAt >= onboardingEnforcedFrom;

      if (
        isNewAccount &&
        metadata.onboardingCompleted !== true &&
        metadata.onboardingRequired !== true
      ) {
        const { data: updatedData, error: bootstrapError } =
          await supabase.auth.updateUser({
            data: {
              onboardingRequired: true,
              onboardingCompleted: false,
              termsAccepted:
                metadata.termsAccepted === true,
            },
          });

        if (bootstrapError) {
          console.error(
            "Failed to bootstrap onboarding metadata:",
            bootstrapError
          );
        } else if (updatedData.user) {
          metadata = updatedData.user.user_metadata ?? metadata;
        }
      }

      const isGoogle =
        user.app_metadata?.provider === "google" ||
        identities.some((identity: any) => identity?.provider === "google");

      setEmail(user.email ?? "");
      setDefaultName(
        String(
          metadata.full_name ||
            metadata.name ||
            metadata.user_name ||
            user.email?.split("@")[0] ||
            ""
        )
      );

      // Tài khoản đã hoàn tất onboarding trước đây:
      // không hiển thị lại modal.
      if (metadata.onboardingCompleted === true) {
        router.replace("/dashboard");
        return;
      }

      // Google mới cần bổ sung thông tin phục hồi trước.
      if (isGoogle && metadata.hasRecoveryPassword !== true) {
        setStage("google-setup");
        return;
      }

      // Chưa chấp thuận điều khoản.
      if (metadata.termsAccepted !== true) {
        setStage("terms");
        return;
      }

      // Cuối cùng quảng bá/chọn gói.
      setStage("plans");
    };

    initialise();

    return () => {
      active = false;
    };
  }, [router]);

  const completeGoogleSetup = async (data: {
    name: string;
    username: string;
    password: string;
  }) => {
    const supabase = createSupabaseBrowserClient();

    const { error } = await supabase.auth.updateUser({
      password: data.password,
      data: {
        name: data.name,
        full_name: data.name,
        username: data.username,
        hasRecoveryPassword: true,
      },
    });

    if (error) {
      throw error;
    }

    setDefaultName(data.name);
    setStage("terms");
  };

  const acceptTerms = async () => {
    const supabase = createSupabaseBrowserClient();

    const { error } = await supabase.auth.updateUser({
      data: {
        termsAccepted: true,
        termsAcceptedAt: new Date().toISOString(),
      },
    });

    if (error) {
      throw error;
    }

    setStage("plans");
  };

  const declineTerms = async () => {
    if (busy) return;

    setBusy(true);

    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      router.replace("/login");
    }
  };

  const finishOnboarding = async () => {
    if (busy) return;

    setBusy(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const { error } = await supabase.auth.updateUser({
        data: {
          onboardingRequired: false,
          onboardingCompleted: true,
          onboardingCompletedAt: new Date().toISOString(),
        },
      });

      if (error) {
        throw error;
      }

      router.replace("/dashboard");
    } catch (error) {
      console.error("Failed to finish onboarding:", error);
      setBusy(false);
    }
  };

  if (stage === "loading") {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center">
            <ShieldCheck className="h-7 w-7 text-cyan-400" />
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-400">
            <LoaderCircle className="h-4 w-4 animate-spin text-cyan-400" />
            Đang chuẩn bị tài khoản ADQ Security...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950">
      <GoogleSetupModal
        isOpen={stage === "google-setup"}
        userEmail={email}
        defaultName={defaultName}
        onComplete={completeGoogleSetup}
      />

      <TermsModal
        isOpen={stage === "terms"}
        userEmail={email}
        onAccept={acceptTerms}
        onDecline={declineTerms}
      />

      <PlansModal
        isOpen={stage === "plans"}
        onClose={finishOnboarding}
      />
    </main>
  );
}
