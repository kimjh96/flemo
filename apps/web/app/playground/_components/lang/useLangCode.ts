"use client";

import { useContext } from "react";

import LangContext from "./LangContext";

export default function useLangCode() {
  return useContext(LangContext).lang;
}
