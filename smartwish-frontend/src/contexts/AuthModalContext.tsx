"use client";

import React, { createContext, useContext, useState } from "react";

interface AuthModalContextType {
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(
  undefined
);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const openAuthModal = () => {
    console.log("🎯 AuthModal Context: Opening auth modal");
    console.log(
      "🎯 AuthModal Context: Current state before opening:",
      authModalOpen
    );
    setAuthModalOpen(true);
    console.log("🎯 AuthModal Context: State set to true");
  };

  const closeAuthModal = () => {
    console.log("🎯 AuthModal Context: Closing auth modal");
    setAuthModalOpen(false);
  };

  return (
    <AuthModalContext.Provider
      value={{
        authModalOpen,
        setAuthModalOpen,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (context === undefined) {
    throw new Error("useAuthModal must be used within an AuthModalProvider");
  }
  return context;
}
