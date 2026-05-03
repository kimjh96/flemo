"use client";

import { useEffect, useMemo, useState } from "react";

import { Route, Router } from "flemo";

import { playgroundDict, resolvePlaygroundLang, type PlaygroundLang } from "../dict";
import { LangContext } from "../lang";
import Account from "../screens/Account";
import Cart from "../screens/Cart";
import Checkout from "../screens/Checkout";
import Login from "../screens/Login";
import Lookbook from "../screens/Lookbook";
import ProductDetail from "../screens/ProductDetail";
import QuickBuy from "../screens/QuickBuy";
import Reviews from "../screens/Reviews";
import Shop from "../screens/Shop";
import SizeGuide from "../screens/SizeGuide";
import WhatsNew from "../screens/WhatsNew";
import fade from "../transitions/fade";
import fadeLeft from "../transitions/fadeLeft";
import fadeRight from "../transitions/fadeRight";

export default function PlaygroundDemo() {
  const [ready, setReady] = useState(false);
  const [lang, setLang] = useState<PlaygroundLang>("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setLang(resolvePlaygroundLang(params.get("lang")));
    if (window.location.pathname !== "/") {
      window.history.replaceState({}, "", "/");
    }
    setReady(true);
  }, []);

  const langValue = useMemo(() => ({ lang, dict: playgroundDict[lang] }), [lang]);

  if (!ready) return null;

  return (
    <LangContext.Provider value={langValue}>
      <div className="flex min-h-[100dvh] flex-col bg-[var(--color-surface)]">
        <Router defaultTransitionName="cupertino" transitions={[fade, fadeLeft, fadeRight]}>
          <Route path="/" element={<Shop />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/products/:id/reviews" element={<Reviews />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/account" element={<Account />} />
          <Route path="/quick-buy" element={<QuickBuy />} />
          <Route path="/size-guide" element={<SizeGuide />} />
          <Route path="/login" element={<Login />} />
          <Route path="/lookbook" element={<Lookbook />} />
          <Route path="/whats-new" element={<WhatsNew />} />
        </Router>
      </div>
    </LangContext.Provider>
  );
}

declare module "flemo" {
  interface RegisterRoute {
    "/": undefined;
    "/products/:id": { id: string };
    "/products/:id/reviews": { id: string };
    "/cart": undefined;
    "/checkout": { step?: "address" | "payment" | "done" };
    "/account": undefined;
    "/quick-buy": undefined;
    "/size-guide": undefined;
    "/login": undefined;
    "/lookbook": undefined;
    "/whats-new": undefined;
  }
  interface RegisterTransition {
    fade: "fade";
    fadeLeft: "fadeLeft";
    fadeRight: "fadeRight";
  }
}
