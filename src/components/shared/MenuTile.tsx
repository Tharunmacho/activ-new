/**
 * THE MENU BUTTON FOR EVERY SIGNED-IN SCREEN (member, business, admin).
 *
 * The same three-bar mark as the public site's header, in a 40px tile a thumb
 * cannot miss. Each screen used to draw a bare 20px icon of its own, in a
 * slightly different place and colour. Hidden from `lg`, where the rail shows.
 */
export function MenuTile({ onClick, className = '', label = 'Open menu' }: {
    onClick: () => void;
    className?: string;
    label?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={`lg:hidden shrink-0 grid h-10 w-10 place-items-center rounded-xl border border-slate-200
                        bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-90 ${className}`}
        >
            <span aria-hidden="true" className="flex w-5 flex-col gap-[4px]">
                <span className="h-[2px] w-5 rounded-full bg-current" />
                <span className="h-[2px] w-3.5 rounded-full bg-current" />
                <span className="h-[2px] w-4 rounded-full bg-current" />
            </span>
        </button>
    );
}

export default MenuTile;
