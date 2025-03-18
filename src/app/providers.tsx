'use client';

import { SessionProvider } from "next-auth/react";
import { AuthValidator } from "@/components/AuthValidator";

type Props = {
  children?: React.ReactNode;
};

export default function Providers({ children }: Props) {
  return (
    <SessionProvider>
      <AuthValidator fallback={<div className="flex justify-center items-center h-screen">Verifying authentication...</div>}>
        {children}
      </AuthValidator>
    </SessionProvider>
  );
}