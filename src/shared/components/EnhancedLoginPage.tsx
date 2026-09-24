import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { login, getMyApplication, errorMessage, getPaymentStatus } from "@/services/activApi";
import { clearSession } from "@/services/api";
import { Mail, Lock, ShieldCheck } from "lucide-react";
import { FaGoogle, FaLinkedinIn, FaFacebookF } from "react-icons/fa";
import AuthSplitLayout from "./AuthSplitLayout";

/**
 * The field, the label and the leading icon.
 *
 * `BusinessUI`'s 16px bold label and a 52px box, which is the size the rest of
 * the product's forms use — the reference design underlines its fields, and a
 * sign-in that does not look like every other form in the product is a
 * different kind of inconsistency from the one this redesign set out to fix.
 */
/**
 * THE FIELD IS A RULED LINE, NOT A BOX.
 *
 * The reference the association chose underlines its inputs, and the boxed
 * version of this screen read as the old form with new copy over it — the
 * heading and the panel had changed and the part you actually touch had not.
 * A 2px rule that turns brand-navy and thickens on focus is the whole control:
 * no border to fight the icon, no rounded corner, and the caret lands where
 * the eye already is.
 *
 * `rounded-none` and the explicit `border-0 border-b-2` are both required —
 * the shared `Input` ships a full border and a radius, and Tailwind emits its
 * classes in source order, so a later `border-b` alone would not win.
 */
/**
 * THE FIELD IS A RULED LINE, NOT A BOX — on THIS screen only.
 *
 * The reference the association chose underlines its inputs, and they kept it
 * for sign-in. Register uses the product's boxed field on a card instead, and
 * that difference is deliberate: sign-in is two boxes on an otherwise empty
 * column, where a rule is enough to say "type here"; register is a fourteen-
 * field form, where a box per control is what keeps the rows apart.
 */
const FIELD =
  'h-[3.75rem] w-full rounded-none border-0 border-b-2 border-slate-200 bg-transparent px-0 pl-11 ' +
  'text-[1.4375rem] font-medium text-slate-900 placeholder:text-[1.25rem] placeholder:font-normal placeholder:text-slate-400 ' +
  'shadow-none transition-colors focus:border-blue-600 focus:ring-0 focus-visible:ring-0 ' +
  'focus-visible:ring-offset-0';

const FIELD_LABEL = 'mb-3 block text-[1.25rem] font-semibold text-slate-800';

/*
 * `z-10` matters. `PasswordInput` wraps its field in its own `relative` div,
 * and a positioned element paints above an earlier positioned sibling — so
 * without this the lock icon rendered UNDER the password box (which has a
 * white background) while the identical mail icon above it, whose neighbour
 * is an unpositioned `<Input>`, showed fine.
 */
/*
 * `z-10` matters: `PasswordInput` wraps its field in its own `relative` div,
 * and a positioned element paints above an earlier positioned sibling — so
 * without it the lock icon rendered under the password field.
 */
const FIELD_ICON =
  'pointer-events-none absolute left-0 top-1/2 z-10 -translate-y-1/2 text-blue-600';

/**
 * ============================================================================
 * TWO SIGN-IN SCREENS, ONE COMPONENT
 * ============================================================================
 *
 *   /login         audience="member"  members only — social sign-in and
 *                                      "Create an account" are offered
 *   /admin/login   audience="admin"   block, district, state, super and CMS
 *                                      admins — neither is offered
 *
 * The backend has one sign-in endpoint for every role, so what separates the
 * two screens is what each one ACCEPTS: a member signing in on the admin
 * screen, or an admin on the member screen, is signed straight back out and
 * told where they belong. That is a courtesy of the screen, not a security
 * boundary — every admin endpoint still checks the role on the server.
 */
export default function EnhancedLoginPage({ audience = 'member' }: { audience?: 'member' | 'admin' } = {}) {
  const forAdmins = audience === 'admin';
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  /*
   * Kept, and kept in the flow rather than tucked away: the association uses
   * these three to sign in. Each still reports that the provider is not wired
   * up yet — which is the honest answer until the OAuth apps exist — rather
   * than failing silently on a click.
   */
  const handleSocialLogin = (provider: string) => {
    toast.info(`${provider} sign-in is being set up — use your email for now.`);
  };


  /**
   * Sign in.
   *
   * ONE call, all five roles. The backend checks the member `auth` collection
   * first and then every admin collection, and reports which it found in
   * `data.role` — so there is nothing to branch on here, and the old
   * "try admin, then member, then localStorage" cascade is gone. That cascade
   * was also what produced the misleading error: each stage failed silently and
   * the last one reported "invalid email or password" for what was actually an
   * unreachable server.
   */
  const handleUnifiedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const id = identifier.trim();

    if (!id || !password) {
      toast.error('Please enter both your email and password');
      return;
    }

    /**
     * Catch input that cannot identify an account before it is sent.
     *
     * The server rejects it too, but a request that was never going to succeed
     * still lands in the console as a red `400`, which reads like a server
     * fault for what is really a typo. Whether the account exists is still the
     * server's answer, not ours — this only checks the shape.
     *
     * Email only, matching the label. The endpoint still accepts a Member ID,
     * so nothing breaks for a client that sends one, but this form does not
     * advertise or accept it.
     */
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(id)) {
      toast.error(
        id.includes('@')
          ? 'That email address is not complete — check for a typo.'
          : 'Enter the email address you registered with.',
      );
      return;
    }

    setIsLoading(true);

    try {
      /* The server refuses the wrong screen outright — see `assertPortal`. */
      const result = await login(id, password, audience);

      /* A backstop: the server has already refused the wrong screen, so this
         only catches an older server that does not know `portal`. */
      const isAdminRole = !!result.role && result.role !== 'member';
      if (forAdmins && !isAdminRole) {
        clearSession();
        toast.error('This sign-in is for ACTIV administrators. Members sign in on the member login page.');
        navigate('/login', { replace: true });
        return;
      }
      if (!forAdmins && isAdminRole) {
        clearSession();
        toast.error('Admins sign in on the admin login page.');
        navigate('/admin/login', { replace: true });
        return;
      }

      toast.success(`Welcome ${result.user?.fullName || 'back'}!`);

      // Members who have already paid land on the paid dashboard. A failure to
      // read the application must not block the sign-in that already succeeded.
      if (result.role === 'member') {
        // Payment is recorded on the member. The login response already carries
        // the profile, so prefer it and only ask the server if it is absent.
        // `approved` is the application's approval, not the payment — routing a
        // member there sent someone who still owed a membership fee to the paid
        // dashboard, where nothing offers to take it.
        const status = String(result.memberDetails?.membershipStatus || '').toLowerCase();
        const paid =
          status === 'active' ||
          status === 'completed' ||
          (!status && (await getPaymentStatus().catch(() => 'pending')) === 'completed');

        navigate(paid ? '/payment/member-dashboard' : '/member/unpaid-dashboard');
        return;
      }

      navigate(result.home);
    } catch (err) {
      // errorMessage separates "the server rejected these credentials" from
      // "the request never arrived", so a backend that is not running stops
      // being reported as a password problem.
      toast.error(errorMessage(err, 'Login failed. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <AuthSplitLayout
      eyebrow={forAdmins ? "ACTIV admin portal" : "ACTIV member portal"}
      /* The association's own welcome, as this screen has always carried it —
         the reference's "Hello, welcome back!" was a stand-in for it. */
      headline={forAdmins ? <>ACTIV<br />Administration</> : <>Welcome to<br />ACTIVian Platform! 👋</>}
      quote={forAdmins ? '"Serving every member, in every region"' : '"Empowering Communities, Simplifying Lives"'}
      lede={forAdmins
        ? "For block, district, state and super admins, and the website's CMS editors. Review applications, manage members and keep the association's content up to date."
        : "Our digital platform connects communities with essential services and resources. Whether you are managing applications, accessing member benefits or exploring business opportunities, we are here to make your journey seamless and transparent."}
      formEyebrow={forAdmins ? "Admin sign in" : "Sign in"}
      title={forAdmins ? "Sign in to the admin panel" : "Log in to your account"}
      subtitle={forAdmins ? "For ACTIV administrators only." : "Members sign in here."}
      assurance=""
    >
      <form onSubmit={handleUnifiedSubmit} className="space-y-6">

        {/* ------------------------------------------------------- email */}
        <div>
          <label htmlFor="login-email" className={FIELD_LABEL}>
            Email address
          </label>
          <div className="relative">
            <Mail size={20} className={FIELD_ICON} aria-hidden="true" />
            {/*
              `username` + `current-password` below is what lets the browser
              offer a credential it has already SAVED for this site, and offer
              to save one after a successful sign-in. Both fields carried
              `autoComplete="off"`, which does the opposite of what it sounds
              like here: it suppressed the saved-password prompt entirely.
            */}
            <Input
              id="login-email"
              name="email"
              type="email"
              placeholder={forAdmins ? "admin@activ.org.in" : "you@example.com"}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className={FIELD}
              autoComplete="username"
              required
            />
          </div>
        </div>

        {/* ---------------------------------------------------- password */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <label htmlFor="login-password" className={`${FIELD_LABEL} mb-0`}>
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-[1.125rem] font-semibold text-blue-600 transition-colors hover:text-blue-800"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock size={20} className={FIELD_ICON} aria-hidden="true" />
            <PasswordInput
              id="login-password"
              name="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={FIELD}
              wrapperClassName="[&>button]:right-0"
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        {/* ------------------------------------------------------ submit */}
        <Button
          type="submit"
          /*
           * THE BUTTON IS THE PANEL'S BLUE, not the site's navy.
           *
           * On every other screen the navy is right — it is the header, the
           * footer and the brand. Here it sat beside a bright blue panel two
           * shades away from it, close enough to read as the same colour
           * mis-mixed rather than as a deliberate pair. The reference makes
           * the button match its panel exactly, and that is what makes the
           * two halves read as one screen.
           */
          className="h-[3.75rem] w-full rounded-xl bg-blue-600 text-[1.3125rem] font-semibold text-white
                     shadow-[0_12px_26px_-12px_rgb(37_99_235/0.9)] transition-colors
                     hover:bg-blue-700 disabled:opacity-70"
          disabled={isLoading}
        >
          {isLoading ? 'Signing in…' : 'Sign in'}
        </Button>

      </form>

      {!forAdmins && (
      <>
      {/* ------------------------------------------- the other ways in
        GOOGLE, LINKEDIN AND FACEBOOK — the three the association uses.
        LinkedIn replaces Apple: this is a chamber of commerce, and the
        account a member already has in a professional network is the one
        they will reach for. */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-4 text-[1.125rem] font-normal text-slate-400">
            Or sign in with
          </span>
        </div>
      </div>

      <div className="flex justify-center gap-3">
        {([
          ['Google', <FaGoogle key="g" className="h-[1.375rem] w-[1.375rem] text-[#ea4335]" />],
          ['LinkedIn', <FaLinkedinIn key="l" className="h-[1.375rem] w-[1.375rem] text-[#0a66c2]" />],
          ['Facebook', <FaFacebookF key="f" className="h-[1.375rem] w-[1.375rem] text-[#1877f2]" />],
        ] as const).map(([name, icon]) => (
          <button
            key={name}
            type="button"
            onClick={() => handleSocialLogin(name)}
            aria-label={`Sign in with ${name}`}
            className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200
                       bg-white transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            {icon}
          </button>
        ))}
      </div>

      </>
      )}

      {/*
        WHAT WAS REMOVED, AND WHY — the social row is not part of it.

        This screen carried four blocks below Sign in: a terms sentence, a
        divider, the social buttons and the register link — on a form with two
        fields. Two of them went:

          - THE TERMS SENTENCE belongs on REGISTER, where somebody is agreeing
            to something. Signing in to an account you already have does not
            create an agreement, and the line was lifted from the register
            screen when this one was built.
          - THE ASSURANCE LINE ("your password is never shown…") was
            reassurance nobody asked for, under a password box that already
            has a reveal toggle.

        What is left is the two things a person who cannot get in actually
        needs: another way to sign in, and the fact that they may not have an
        account yet.
      */}
      {forAdmins ? (
        <p className="mt-7 text-center text-[1.25rem] font-normal text-slate-500">
          Not an administrator?{' '}
          <Link to="/login" className="font-semibold text-blue-700 transition-colors hover:text-blue-900">
            Member sign in
          </Link>
        </p>
      ) : (
        <p className="mt-7 text-center text-[1.25rem] font-normal text-slate-500">
          New to ACTIV?{' '}
          <Link to="/register" className="font-semibold text-blue-700 transition-colors hover:text-blue-900">
            Create an account
          </Link>
        </p>
      )}

      {/* The way to the admin sign-in: small, below everything a member
          needs, so it is findable without competing with the member form. */}
      {!forAdmins && (
        <div className="mt-5 flex justify-center">
          <Link
            to="/admin/login"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-1.5
                       text-[1rem] font-semibold text-slate-500 transition-colors
                       hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <ShieldCheck size={15} aria-hidden="true" /> Admin login
          </Link>
        </div>
      )}
    </AuthSplitLayout>
  );
}
