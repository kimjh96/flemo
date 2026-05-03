"use client";

import { useContext } from "react";

import LangContext from "./LangContext";

export default function useLang() {
  return useContext(LangContext).dict;
}
