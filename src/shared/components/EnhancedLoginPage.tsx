import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FaGoogle, FaFacebook, FaApple } from "react-icons/fa";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { login, getMyApplication, errorMessage, getPaymentStatus } from "@/services/activApi";

const activLogo = "/logo_ACTIVian-removebg-preview.png";

export default function EnhancedLoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleSocialLogin = (provider: string) => {
    toast.info(`Social login with ${provider} coming soon!`);
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
      const result = await login(id, password);

      toast.success(`Welcome ${result.user?.fullName || 'back'}!`);

      // Members who have already paid land on the paid dashboard. A failure to
      // read the application must not block the sign-in that already succeeded.
      if (result.role === 'member') {
        // Payment is recorded on the member. The login response already carries
        // the profile, so prefer it and only ask the server if it is absent.
        const status = String(result.memberDetails?.membershipStatus || '').toLowerCase();
        const paid =
          status === 'approved' ||
          status === 'active' ||
          (!status && (await getPaymentStatus().catch(() => 'pending')) === 'completed');

        navigate(paid ? '/payment/member-dashboard' : '/member/dashboard');
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

  // if already logged in, redirect to dashboard
  useEffect(() => {
    const checkLoginAndRedirect = async () => {
      const logged = localStorage.getItem('isLoggedIn');
      if (logged === 'true') {
        const role = localStorage.getItem('role') || '';
        
        // Admin redirects
        if (role === 'district_admin') {
          navigate('/district-admin/dashboard');
          return;
        } else if (role === 'state_admin') {
          navigate('/state-admin/dashboard');
          return;
        } else if (role === 'super_admin') {
          navigate('/super-admin/dashboard');
          return;
        } else if (role === 'block_admin') {
          navigate('/block-admin/dashboard');
          return;
        }

        // Member: Check payment status
        const token = localStorage.getItem('token');
        if (token) {
          try {
            // Payment state comes from the member profile, not from an
            // application — the application only tracks the approval tiers.
            if ((await getPaymentStatus()) === 'completed') {
              navigate('/payment/member-dashboard');
              return;
            }
          } catch {
            // Payment status refines where to land; it does not gate sign-in.
            // If it cannot be read, the unpaid dashboard below is the safe answer.
          }
        }

        // Default to unpaid dashboard for unpaid members
        navigate('/member/dashboard');
      }
    };

    checkLoginAndRedirect();
  }, [navigate]);

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Left Panel - Blue Welcome Section */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 p-8 flex-col justify-between text-white relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full filter blur-3xl"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <img
              src={activLogo}
              alt="ACTIV logo"
              className="w-20 h-20 object-contain brightness-0 invert"
            />
          </div>

          <div className="space-y-4">
            <div>
              <h1 className="text-4xl font-bold mb-3">
                Welcome to <br />ACTIVian Platform! 👋
              </h1>
              <p className="text-lg text-blue-100 italic">
                "Empowering Communities, Simplifying Lives"
              </p>
            </div>

            <div className="text-blue-100 text-base">
              <p className="leading-relaxed">
                Our digital platform connects communities with essential services and resources.
                Whether you're managing applications, accessing member benefits, or exploring business
                opportunities, we're here to make your journey seamless and transparent.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-blue-100 text-xs">
          © Copyright 2024 - All rights Reserved
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-white overflow-auto">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Logo */}
          <div className="md:hidden text-center">
            <img
              src={activLogo}
              alt="ACTIV logo"
              className="w-20 h-20 object-contain mx-auto mb-3"
            />
          </div>

          {/* Logo and Title */}
          <div className="text-center space-y-3">
            <div className="hidden md:flex items-center justify-center gap-3 mb-3">
              <img
                src={activLogo}
                alt="ACTIV logo"
                className="w-14 h-14 object-contain"
              />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Log In to your Account</h2>
          </div>

          {/* Login Form */}
          <form onSubmit={handleUnifiedSubmit} className="space-y-4">
            {/* Email Input */}
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              {/*
                `username` + `current-password` below is what lets the browser
                offer a credential it has already SAVED for this site, and offer
                to save one after a successful sign-in. Both fields carried
                `autoComplete="off"`, which does the opposite of what it sounds
                like here: it suppressed the saved-password prompt entirely, so
                a returning user got no offer to fill and no offer to save.
                Nothing is filled in for someone who has never saved one.
              */}
              <Input
                id="login-email"
                name="email"
                type="email"
                placeholder="Enter your email address"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full h-11 px-4 rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                autoComplete="username"
                required
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <PasswordInput
                id="login-password"
                name="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-4 rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                autoComplete="current-password"
                required
              />
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700">
                Forgot Password?
              </Link>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Continue"}
            </Button>

            {/* Terms and Privacy */}
            <p className="text-xs text-center text-gray-500 leading-relaxed">
              By clicking on proceed, you have read and agree to the{" "}
              <Link to="/terms" className="text-blue-600 hover:underline">
                Terms of Use
              </Link>{" "}
              &{" "}
              <Link to="/privacy" className="text-blue-600 hover:underline">
                Privacy Policy
              </Link>
            </p>
          </form>

          {/* Social Login Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Or Login with</span>
            </div>
          </div>

          {/* Social Login Buttons */}
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => handleSocialLogin("Google")}
              className="w-11 h-11 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
            >
              <FaGoogle className="w-5 h-5 text-red-500" />
            </button>
            <button
              type="button"
              onClick={() => handleSocialLogin("Facebook")}
              className="w-11 h-11 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
            >
              <FaFacebook className="w-5 h-5 text-blue-600" />
            </button>
            <button
              type="button"
              onClick={() => handleSocialLogin("Apple")}
              className="w-11 h-11 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
            >
              <FaApple className="w-5 h-5 text-gray-900" />
            </button>
          </div>

          {/* Register Link */}
          <p className="text-center text-sm text-gray-600">
            Don't have an account?{" "}
            <Link to="/register" className="text-blue-600 hover:text-blue-700 font-semibold">
              Create new account now
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
