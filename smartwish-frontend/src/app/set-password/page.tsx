"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-teal-600 mb-4" />
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}

function SetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  useEffect(() => {
    // Redirect to managers/signup with the same token
    if (token) {
      router.replace(`/managers/signup?token=${encodeURIComponent(token)}`);
    } else {
      router.replace("/managers/signup");
    }
  }, [token, router]);

  return <LoadingSpinner />;
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SetPasswordContent />
    </Suspense>
  );
}
