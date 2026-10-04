"use client";

import { Screen } from "@flemo/react";

import SiteFooter from "@/app/[lang]/_components/SiteFooter";

import HomeCta from "./HomeCta";
import HomeEngine from "./HomeEngine";
import HomeHero from "./HomeHero";
import HomePrimitives from "./HomePrimitives";
import HomeQuickstart from "./HomeQuickstart";
import HomeShowcase from "./HomeShowcase";

// The landing. Every demo on it is a real nested flemo Router, and the page
// itself is a screen of the site's Router: what you read about is what you are
// scrolling through.
function HomeScreen() {
  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="var(--bg)">
      <div className="h-full overflow-y-auto pt-14">
        <HomeHero />
        <HomeQuickstart />
        <HomePrimitives />
        <HomeEngine />
        <HomeShowcase />
        <HomeCta />
        <SiteFooter />
      </div>
    </Screen>
  );
}

export default HomeScreen;
