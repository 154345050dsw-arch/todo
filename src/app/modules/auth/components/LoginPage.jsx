import { useState, useEffect, useRef } from "react";
import { Check, Eye, EyeOff, Server, Settings2 } from "lucide-react";
import { AnimatedCharacters } from "./AnimatedCharacters";
import { InteractiveHoverButton } from "./InteractiveHoverButton";
import { api } from "../../../../api.js";
import { isDesktopApp, getApiBaseUrl, setApiBaseUrl, normalizeApiBase, isValidApiBaseUrl, setToken } from "../../../../app/shared/services/apiClient.js";

const labelClassName = "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70";
const inputClassName = "flex h-10 w-full rounded-full border border-input bg-background px-4 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm h-12 bg-background border-border/60 focus:border-primary";
const checkboxClassName = "peer h-4 w-4 shrink-0 rounded-[4px] border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground";

export default function LoginPage({ onAuthed }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(false);
  const [animationSeed, setAnimationSeed] = useState(0);
  const [isSurprised, setIsSurprised] = useState(false);
  const surpriseTimerRef = useRef(null);

  // Desktop server config
  const desktop = isDesktopApp();
  const [apiBaseUrl, setApiBaseUrlState] = useState(() => getApiBaseUrl());
  const [serverOpen, setServerOpen] = useState(false);
  const [serverForm, setServerForm] = useState(() => getApiBaseUrl());
  const [serverError, setServerError] = useState("");
  const [serverMessage, setServerMessage] = useState("");
  const [serverTesting, setServerTesting] = useState(false);
  const apiConfigured = !desktop || Boolean(apiBaseUrl);

  // Open server config if not configured on desktop
  useEffect(() => {
    if (desktop && !getApiBaseUrl()) {
      setServerOpen(true);
    }
  }, [desktop]);

  useEffect(() => {
    return () => window.clearTimeout(surpriseTimerRef.current);
  }, []);

  useEffect(() => {
    if (showPassword && isSurprised) {
      window.clearTimeout(surpriseTimerRef.current);
      setIsSurprised(false);
    }
  }, [showPassword, isSurprised]);

  function validateServerForm() {
    const normalized = normalizeApiBase(serverForm);
    if (!normalized) {
      return { error: "Please enter the server address." };
    }
    if (!isValidApiBaseUrl(normalized)) {
      return { error: "Server address must start with http:// or https://." };
    }
    return { normalized };
  }

  function saveServer() {
    const result = validateServerForm();
    setServerMessage("");
    if (result.error) {
      setServerError(result.error);
      return;
    }
    const saved = setApiBaseUrl(result.normalized);
    setApiBaseUrlState(saved);
    setServerForm(saved);
    setServerError("");
    setServerMessage("Server address saved.");
    setError("");
    setServerOpen(false);
  }

  async function testServer() {
    const result = validateServerForm();
    setServerMessage("");
    if (result.error) {
      setServerError(result.error);
      return;
    }
    setServerTesting(true);
    setServerError("");
    try {
      await api.health(result.normalized);
      setServerForm(result.normalized);
      setServerMessage("Connection successful. You can save and login.");
    } catch (err) {
      setServerError(err.message);
    } finally {
      setServerTesting(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!apiConfigured) {
      setError("请先配置服务器地址。");
      setServerOpen(true);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const data = await api.login({ username, password });
      setToken(data.token);
      onAuthed(data.user);
    } catch (err) {
      setError(err.message || "用户名或密码错误。");
      window.clearTimeout(surpriseTimerRef.current);
      if (showPassword) {
        setIsSurprised(false);
      } else {
        setIsSurprised(true);
        surpriseTimerRef.current = window.setTimeout(() => setIsSurprised(false), 1500);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function clearLoginFeedback() {
    window.clearTimeout(surpriseTimerRef.current);
    if (error) {
      setError("");
    }
    if (isSurprised) {
      setIsSurprised(false);
    }
  }

  function resetLoginAnimation() {
    setError("");
    setUsername("");
    setPassword("");
    setIsTyping(false);
    setShowPassword(false);
    window.clearTimeout(surpriseTimerRef.current);
    setIsSurprised(false);
    setAnimationSeed((seed) => seed + 1);
  }

  return (
    <div className="auth-reference-theme min-h-screen max-h-screen overflow-hidden grid font-sans antialiased lg:grid-cols-2">
      {/* Left Content Section with Animated Characters */}
      <div className="relative hidden lg:flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 dark:from-white/90 dark:via-white/80 dark:to-white/70 p-12 text-white dark:text-gray-900">
        <div className="relative z-20">
          <button
            type="button"
            onClick={resetLoginAnimation}
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <img
              src="https://i.postimg.cc/nLrDYrHW/icon.png"
              alt="FlowDesk logo"
              className="w-8 h-8 bg-white/10 backdrop-blur-sm p-1 rounded-[8px]"
            />
            <span>FlowDesk</span>
          </button>
        </div>

        <div className="relative z-20 flex items-end justify-center h-[500px]">
          <AnimatedCharacters
            key={animationSeed}
            isTyping={isTyping}
            showPassword={showPassword}
            passwordLength={password.length}
            isSurprised={isSurprised}
          />
        </div>

        <div className="relative z-20 flex items-center gap-8 text-sm text-gray-600 dark:text-gray-700">
          <a
            href="#"
            className="hover:text-gray-900 dark:hover:text-black transition-colors"
          >
            Privacy Policy
          </a>
          <a
            href="#"
            className="hover:text-gray-900 dark:hover:text-black transition-colors"
          >
            Terms of Service
          </a>
        </div>

        {/* Decorative elements */}
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
        <div className="absolute top-1/4 right-1/4 size-64 bg-gray-400/20 dark:bg-gray-300/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 size-96 bg-gray-300/20 dark:bg-gray-200/20 rounded-full blur-3xl" />
      </div>

      {/* Right Login Section */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <button
            type="button"
            onClick={resetLoginAnimation}
            className="lg:hidden mx-auto flex items-center justify-center gap-2 text-lg font-semibold mb-12"
          >
            <img
              src="https://i.postimg.cc/nLrDYrHW/icon.png"
              alt="FlowDesk logo"
              className="w-8 h-8 dark:bg-white dark:p-1 dark:rounded-[6px]"
            />
            <span>FlowDesk</span>
          </button>

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              Welcome back!
            </h1>
            <p className="text-muted-foreground text-sm">
              Please enter your details
            </p>
          </div>

          {/* Desktop Server Config */}
          {desktop && (
            <div className="mb-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Server className="size-4" />
                  <span className="font-medium">Server</span>
                  <span className={`text-xs ${apiBaseUrl ? "text-muted-foreground" : "text-destructive"}`}>
                    {apiBaseUrl || "Not configured"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setServerOpen(!serverOpen)}
                  className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-border px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <Settings2 className="size-4" />
                  Settings
                </button>
              </div>

              {serverOpen && (
                <div className="mt-4 space-y-3 rounded-[8px] border border-border p-4">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium">Django API Server</span>
                    <input
                      value={serverForm}
                      onChange={(e) => {
                        setServerForm(e.target.value);
                        setServerError("");
                        setServerMessage("");
                      }}
                      className="h-10 w-full rounded-[6px] border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="https://flowdesk.example.com"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveServer}
                      className="h-9 rounded-[6px] bg-primary px-4 text-sm font-medium text-primary-foreground"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={testServer}
                      disabled={serverTesting}
                      className="h-9 rounded-[6px] border border-border px-4 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      {serverTesting ? "Testing..." : "Test"}
                    </button>
                  </div>
                  {serverError && <p className="text-sm text-destructive">{serverError}</p>}
                  {serverMessage && <p className="text-sm text-emerald-600 dark:text-emerald-500">{serverMessage}</p>}
                </div>
              )}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="username" className={labelClassName}>
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  clearLoginFeedback();
                  setUsername(e.target.value);
                }}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                placeholder="Enter your username"
                autoComplete="off"
                className={inputClassName}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className={labelClassName}>
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    clearLoginFeedback();
                    setPassword(e.target.value);
                  }}
                  placeholder="••••••••"
                  className={`${inputClassName} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="size-5" />
                  ) : (
                    <Eye className="size-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  id="remember"
                  role="checkbox"
                  aria-checked={remember}
                  data-state={remember ? "checked" : "unchecked"}
                  onClick={() => setRemember((checked) => !checked)}
                  className={checkboxClassName}
                >
                  {remember && (
                    <span className="flex items-center justify-center text-current">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </button>
                <label
                  htmlFor="remember"
                  className={`${labelClassName} font-normal cursor-pointer`}
                >
                  Remember for 30 days
                </label>
              </div>
              <a
                href="#"
                className="text-sm text-primary hover:underline font-medium"
              >
                Forgot password?
              </a>
            </div>

            <div className="space-y-3">
              <InteractiveHoverButton
                type="submit"
                text={isLoading ? "Signing in..." : "Log in"}
                className="w-full h-12 text-base font-medium"
                disabled={isLoading || !apiConfigured}
              />

              {error && (
                <div className="flex min-h-10 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 px-4 text-center text-sm font-medium text-destructive">
                  {error}
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
