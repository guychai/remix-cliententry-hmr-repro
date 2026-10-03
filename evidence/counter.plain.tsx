import { clientEntry, on, type Handle } from "remix/component";

export function Counter(handle: Handle) {
  let count = 0;
  return () => {
    return (
      <button
        mix={on("click", () => {
          count++;
          handle.update();
        })}
      >
        Count: {count}
      </button>
    );
  };
}
