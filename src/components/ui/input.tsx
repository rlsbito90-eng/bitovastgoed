import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type InputProps = React.ComponentProps<"input"> & {
  hideClearButton?: boolean;
  clearLabel?: string;
};

const CLEARABLE_DATE_TIME_TYPES = new Set(["date", "time", "datetime-local", "month", "week"]);

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onChange, value, defaultValue, disabled, hideClearButton = false, clearLabel, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const isDateTimeInput = !!type && CLEARABLE_DATE_TIME_TYPES.has(type);
    const [hasValue, setHasValue] = React.useState(() => String(value ?? defaultValue ?? "").length > 0);

    React.useEffect(() => {
      if (value !== undefined) setHasValue(String(value ?? "").length > 0);
    }, [value]);

    const assignRef = React.useCallback((node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    }, [ref]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(event.target.value.length > 0);
      onChange?.(event);
    };

    const clearValue = () => {
      const input = inputRef.current;
      if (!input || disabled) return;

      // Mobile Safari keeps the native date/time picker tied to focus. Close it
      // before mutating the value and never refocus after a clear action.
      input.blur();

      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(input, "");
      setHasValue(false);

      if (onChange) {
        // Do not rely only on a programmatic DOM event here: Safari can swallow
        // that event while its native picker is active. Notify the controlled
        // React owner directly so the cleared value cannot be restored on render.
        const nativeEvent = new Event("change", { bubbles: true, cancelable: true });
        let propagationStopped = false;
        const changeEvent = {
          nativeEvent,
          currentTarget: input,
          target: input,
          bubbles: nativeEvent.bubbles,
          cancelable: nativeEvent.cancelable,
          defaultPrevented: nativeEvent.defaultPrevented,
          eventPhase: nativeEvent.eventPhase,
          isTrusted: nativeEvent.isTrusted,
          preventDefault: () => nativeEvent.preventDefault(),
          isDefaultPrevented: () => nativeEvent.defaultPrevented,
          stopPropagation: () => {
            propagationStopped = true;
            nativeEvent.stopPropagation();
          },
          isPropagationStopped: () => propagationStopped,
          persist: () => undefined,
          timeStamp: nativeEvent.timeStamp,
          type: "change",
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(changeEvent);
        return;
      }

      // Preserve native listeners for uncontrolled inputs.
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const showClearButton = isDateTimeInput && !hideClearButton && !disabled && hasValue;
    const resolvedClearLabel = clearLabel ?? (type === "time" ? "Tijd wissen" : "Datum wissen");

    const input = (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          showClearButton && "pr-16",
          className,
        )}
        ref={assignRef}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        onChange={handleChange}
        {...props}
      />
    );

    if (!isDateTimeInput) return input;

    return (
      <div className="relative min-w-0 w-full">
        {input}
        {showClearButton ? (
          <button
            type="button"
            aria-label={resolvedClearLabel}
            title={resolvedClearLabel}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              clearValue();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              // Pointer activation is handled on pointerdown so the native iOS
              // picker cannot win the interaction. detail=0 keeps keyboard and
              // accessibility-triggered clicks working without double clearing.
              if (event.detail === 0) clearValue();
            }}
            className="absolute right-8 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
