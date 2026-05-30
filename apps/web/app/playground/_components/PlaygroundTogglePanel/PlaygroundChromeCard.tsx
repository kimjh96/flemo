"use client";

import usePlaygroundSettingsStore from "@/app/playground/_stores/usePlaygroundSettingsStore";

import PlaygroundColorSwatch from "./PlaygroundColorSwatch";
import PlaygroundNumberSlider from "./PlaygroundNumberSlider";
import PlaygroundToggleCard from "./PlaygroundToggleCard";
import PlaygroundToggleCardHeader from "./PlaygroundToggleCardHeader";
import PlaygroundToggleSwitch from "./PlaygroundToggleSwitch";
import {
  chromeBackgroundOptions,
  chromeBarColorOptions,
  chromeHeightPresets
} from "./PlaygroundTogglePanel.constants";

function PlaygroundChromeCard() {
  const chrome = usePlaygroundSettingsStore((state) => state.chrome);
  const setChrome = usePlaygroundSettingsStore((state) => state.setChrome);
  const resetChrome = usePlaygroundSettingsStore((state) => state.resetChrome);

  return (
    <PlaygroundToggleCard>
      <PlaygroundToggleCardHeader
        eyebrow="Screen chrome"
        title="Frame the screen like a device"
        description="Every screen renders inside flemo's <Screen>, which reserves a status bar and a system navigation bar and owns the scroll. Drive those props here — heights, tints, scroll — and watch the preview reflow. (The frame isn't a real notch, so colored bands render as plain strips.)"
      />

      <PlaygroundNumberSlider
        label="statusBarHeight"
        value={chrome.statusBarHeight}
        presets={chromeHeightPresets}
        onChange={(statusBarHeight) => setChrome({ statusBarHeight })}
      />
      <PlaygroundColorSwatch
        label="statusBarColor"
        value={chrome.statusBarColor}
        options={chromeBarColorOptions}
        onChange={(statusBarColor) => setChrome({ statusBarColor })}
      />

      <PlaygroundNumberSlider
        label="systemNavigationBarHeight"
        value={chrome.systemNavigationBarHeight}
        presets={chromeHeightPresets}
        onChange={(systemNavigationBarHeight) => setChrome({ systemNavigationBarHeight })}
      />
      <PlaygroundColorSwatch
        label="systemNavigationBarColor"
        value={chrome.systemNavigationBarColor}
        options={chromeBarColorOptions}
        onChange={(systemNavigationBarColor) => setChrome({ systemNavigationBarColor })}
      />

      <PlaygroundColorSwatch
        label="backgroundColor"
        value={chrome.backgroundColor}
        options={chromeBackgroundOptions}
        onChange={(backgroundColor) => setChrome({ backgroundColor })}
      />

      <div className="flex flex-col gap-2">
        <PlaygroundToggleSwitch
          name="Hide status bar"
          checked={chrome.hideStatusBar}
          onChange={(hideStatusBar) => setChrome({ hideStatusBar })}
          on="hideStatusBar · true"
          off="hideStatusBar · false"
        />
        <PlaygroundToggleSwitch
          name="Content scrollable"
          checked={chrome.contentScrollable}
          onChange={(contentScrollable) => setChrome({ contentScrollable })}
          on="contentScrollable · true"
          off="contentScrollable · false"
        />
      </div>

      <button
        type="button"
        onClick={resetChrome}
        className="self-start rounded-md border border-[var(--color-border)] bg-[var(--color-layer)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]"
      >
        Reset to defaults
      </button>
    </PlaygroundToggleCard>
  );
}

export default PlaygroundChromeCard;
