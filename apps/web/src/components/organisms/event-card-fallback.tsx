export function EventCardFallback() {
  return (
    <img
      src="/discovery-placeholder.svg"
      alt=""
      className="h-full w-full bg-[#edf5eb] object-contain"
      aria-hidden="true"
      draggable={false}
    />
  );
}
