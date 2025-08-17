export default function isServer() {
  return typeof document === "undefined";
}
