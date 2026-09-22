import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * A password field with a reveal toggle.
 *
 * Four screens had grown their own copy of this — the same relative wrapper,
 * the same absolutely-positioned button, the same Eye/EyeOff pair — and they
 * had drifted: the login page showed the words "Show"/"Hide" instead of an
 * icon, and the member profile shared ONE `showPassword` flag between its
 * "current password" and "new password" boxes, so revealing either revealed
 * both. Owning the visibility state here is what fixes that: every instance
 * gets its own, because every instance is its own component.
 *
 * It forwards its ref and spreads the rest of its props, so it drops into a
 * react-hook-form `{...register('password')}` and into a controlled
 * `value`/`onChange` pair without either caller doing anything special.
 *
 * `autoComplete` is deliberately NOT defaulted. The right value differs by
 * screen and getting it wrong is what makes a browser fill a registration form
 * with the credentials of an existing account — so each caller states its own:
 * `current-password` to sign in, `new-password` to choose one.
 */
export interface PasswordInputProps
    extends Omit<React.ComponentProps<"input">, "type"> {
    /** Class names for the wrapper; `className` still styles the input itself. */
    wrapperClassName?: string;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
    ({ className, wrapperClassName, disabled, ...props }, ref) => {
        const [visible, setVisible] = React.useState(false);

        return (
            <div className={cn("relative", wrapperClassName)}>
                <Input
                    {...props}
                    ref={ref}
                    disabled={disabled}
                    type={visible ? "text" : "password"}
                    // Room for the button, so a long password never runs under it.
                    className={cn("pr-11", className)}
                />
                <button
                    type="button"
                    // Never a submit button: inside a form, a bare <button> defaults
                    // to type="submit", so revealing the password would send it.
                    onClick={() => setVisible((v) => !v)}
                    disabled={disabled}
                    // Announced to screen readers, which see only an icon otherwise.
                    aria-label={visible ? "Hide password" : "Show password"}
                    aria-pressed={visible}
                    // Skipped when tabbing between fields — it is a convenience, not
                    // a step in filling the form.
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500
                               hover:text-gray-700 disabled:opacity-50
                               disabled:cursor-not-allowed"
                >
                    {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>
        );
    },
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
