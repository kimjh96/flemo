"use client";

import { createContext } from "react";

import { playgroundDict, type PlaygroundDict, type PlaygroundLang } from "../dict";

interface LangValue {
  lang: PlaygroundLang;
  dict: PlaygroundDict;
}

const LangContext = createContext<LangValue>({ lang: "en", dict: playgroundDict.en });

export default LangContext;
